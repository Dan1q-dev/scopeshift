import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { historyEntrySchema, idSchema, negotiationTurnSchema, type HistoryEntry, type NegotiationTurn } from "@/types/scope";

export const MAX_RECEIPT_BYTES = 32_768;
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identitySchema = z.object({
  scope: z.string().min(1).max(512),
  version: z.string().min(1).max(512),
  scenarioId: idSchema,
  entry: historyEntrySchema,
  prefixHash: digestSchema,
}).strict();

const receiptSchema = z.object({
  formatVersion: z.literal(1),
  scopeHash: digestSchema,
  scenarioId: idSchema,
  version: z.string().min(1).max(512),
  prefixHash: digestSchema,
  entry: historyEntrySchema,
  turn: negotiationTurnSchema,
}).strict();

const recordIdentitySchema = receiptSchema.omit({ formatVersion: true, turn: true });

export interface ReplayIdentity {
  scope: string;
  version: string;
  scenarioId: string;
  entry: HistoryEntry;
  prefixHash: string;
}

export interface ReplayStore {
  getOrCreate(identity: ReplayIdentity, produce: () => Promise<NegotiationTurn>): Promise<NegotiationTurn>;
}

export class ReplayConflictError extends Error {
  constructor() {
    super("A turn ID was reused with a different interpreter version, message or history. Use a new turn ID for the changed branch.");
    this.name = "ReplayConflictError";
  }
}

export class ReplayStoreError extends Error {
  constructor(message = "Replay persistence is unavailable. Please retry the request.") {
    super(message);
    this.name = "ReplayStoreError";
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isCode(cause: unknown, code: string) {
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

function matchesEntry(turn: NegotiationTurn, entry: HistoryEntry) {
  return turn.turnId === entry.turnId && turn.eventId === entry.eventId && turn.userMessage === entry.userMessage;
}

export function parseReplayIdentity(input: ReplayIdentity): ReplayIdentity {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) throw new ReplayStoreError("Replay record identity is invalid.");
  return parsed.data;
}

/** Version stays in the identity so a changed model cannot reuse a turn ID. */
export function replayKey(identity: ReplayIdentity) {
  return digest(JSON.stringify([identity.scope, identity.scenarioId, identity.entry.turnId]));
}

/** Persist a scope digest, never the anonymous session identifier itself. */
export function replayRecordIdentity(identity: ReplayIdentity) {
  return {
    scopeHash: digest(identity.scope),
    scenarioId: identity.scenarioId,
    version: identity.version,
    prefixHash: identity.prefixHash,
    entry: identity.entry,
  };
}

export function assertReplayRecordIdentity(value: unknown, identity: ReplayIdentity): void {
  const parsed = recordIdentitySchema.safeParse(value);
  if (!parsed.success) throw new ReplayStoreError("The stored replay identity is invalid.");
  const record = parsed.data;
  if (record.scopeHash !== digest(identity.scope) || record.scenarioId !== identity.scenarioId
    || record.version !== identity.version || record.prefixHash !== identity.prefixHash
    || record.entry.turnId !== identity.entry.turnId || record.entry.eventId !== identity.entry.eventId
    || record.entry.userMessage !== identity.entry.userMessage) throw new ReplayConflictError();
}

function checkReceiptSize(value: unknown) {
  let contents: string | undefined;
  try { contents = JSON.stringify(value); } catch { throw new ReplayStoreError("The replay receipt is invalid."); }
  if (!contents || Buffer.byteLength(contents, "utf8") > MAX_RECEIPT_BYTES) {
    throw new ReplayStoreError("The replay receipt exceeds the supported size.");
  }
}

export function createReplayReceipt(identity: ReplayIdentity, turn: NegotiationTurn) {
  const validated = negotiationTurnSchema.safeParse(turn);
  if (!validated.success || !matchesEntry(validated.data, identity.entry)) {
    throw new ReplayStoreError("The produced turn does not match its replay identity.");
  }
  const receipt = receiptSchema.parse({ formatVersion: 1, ...replayRecordIdentity(identity), turn: validated.data });
  checkReceiptSize(receipt);
  return receipt;
}

export function readReplayReceipt(value: unknown, identity: ReplayIdentity): NegotiationTurn {
  checkReceiptSize(value);
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || !matchesEntry(parsed.data.turn, parsed.data.entry)) {
    throw new ReplayStoreError("The stored replay receipt is invalid.");
  }
  assertReplayRecordIdentity(recordIdentitySchema.strip().parse(parsed.data), identity);
  return parsed.data.turn;
}

/** Local durable receipts for validated, server-created turns.
 * Receipts are written before returning a result. A shared persistent volume is
 * required across instances; an ephemeral serverless directory is not durable.
 * Stale lock files intentionally fail closed and need operator investigation.
 */
export class FileReplayStore implements ReplayStore {
  private readonly directory: string;
  private readonly lockTimeoutMs: number;
  private readonly lockPollMs: number;

  constructor(directory: string, options: { lockTimeoutMs?: number; lockPollMs?: number } = {}) {
    if (!directory.trim()) throw new ReplayStoreError("A replay storage directory is required.");
    this.directory = resolve(directory);
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
    this.lockPollMs = options.lockPollMs ?? 50;
    if (!Number.isInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 1 || this.lockTimeoutMs > 60_000
      || !Number.isInteger(this.lockPollMs) || this.lockPollMs < 1 || this.lockPollMs > 1_000) {
      throw new ReplayStoreError("Replay lock timing configuration is invalid.");
    }
  }

  async getOrCreate(input: ReplayIdentity, produce: () => Promise<NegotiationTurn>): Promise<NegotiationTurn> {
    const identity = parseReplayIdentity(input);
    // Version is checked inside the record, so changing models cannot silently
    // reinterpret the same turn ID. Every path component comes from a digest.
    const key = replayKey(identity);
    const file = resolve(this.directory, `${key}.json`);
    const lock = resolve(this.directory, `${key}.lock`);
    try {
      const cached = await this.load(file, identity);
      if (cached) return cached;
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const nonce = await this.acquireLock(lock);
      try {
        const existing = await this.load(file, identity);
        if (existing) return existing;
        // Provider errors propagate without persisting a partial interpretation.
        const produced = await produce();
        const receipt = createReplayReceipt(identity, produced);
        const contents = JSON.stringify(receipt);
        await this.writeAtomic(file, contents);
        return receipt.turn;
      } finally {
        await this.releaseLock(lock, nonce);
      }
    } catch (cause) {
      if (cause instanceof ReplayConflictError || cause instanceof ReplayStoreError) throw cause;
      // Do not wrap errors from produce: the caller handles provider failures.
      if (!isCode(cause, "EACCES") && !isCode(cause, "EPERM") && !isCode(cause, "EROFS")
        && !isCode(cause, "ENOSPC") && !isCode(cause, "ENOTDIR") && !isCode(cause, "ENOENT")
        && !isCode(cause, "EIO") && !isCode(cause, "EMFILE")) throw cause;
      throw new ReplayStoreError();
    }
  }

  private async load(file: string, identity: ReplayIdentity): Promise<NegotiationTurn | null> {
    let handle;
    try {
      handle = await open(file, "r");
    } catch (cause) {
      if (isCode(cause, "ENOENT")) return null;
      throw cause;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_RECEIPT_BYTES) throw new ReplayStoreError("The stored replay receipt is invalid.");
      const bytes = Buffer.alloc(MAX_RECEIPT_BYTES + 1);
      let size = 0;
      while (size < bytes.byteLength) {
        const chunk = await handle.read(bytes, size, bytes.byteLength - size, size);
        if (chunk.bytesRead === 0) break;
        size += chunk.bytesRead;
      }
      if (size > MAX_RECEIPT_BYTES) throw new ReplayStoreError("The stored replay receipt is invalid.");
      let json: unknown;
      try {
        json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
      } catch {
        throw new ReplayStoreError("The stored replay receipt is invalid.");
      }
      return readReplayReceipt(json, identity);
    } finally {
      await handle.close();
    }
  }

  private async acquireLock(lock: string): Promise<string> {
    const deadline = performance.now() + this.lockTimeoutMs;
    while (true) {
      let handle;
      try {
        handle = await open(lock, "wx", 0o600);
      } catch (cause) {
        if (!isCode(cause, "EEXIST")) throw cause;
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw new ReplayStoreError("Replay persistence is busy. Please retry the request.");
        await delay(Math.min(remaining, this.lockPollMs));
        continue;
      }
      const nonce = randomUUID();
      try {
        await handle.writeFile(nonce, "utf8");
      } catch (cause) {
        await handle.close();
        await unlink(lock).catch(() => {});
        throw cause;
      }
      await handle.close();
      return nonce;
    }
  }

  private async releaseLock(lock: string, nonce: string) {
    const contents = await readFile(lock, "utf8");
    if (contents !== nonce) throw new ReplayStoreError("Replay lock ownership changed unexpectedly.");
    await unlink(lock);
  }

  private async writeAtomic(file: string, contents: string) {
    const temporary = `${file}.tmp-${randomUUID()}`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      try {
        await handle.writeFile(contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch((cause: unknown) => { if (!isCode(cause, "ENOENT")) throw cause; });
    }
  }
}
