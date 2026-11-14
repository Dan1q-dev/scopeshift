import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NegotiationTurn } from "@/types/scope";
import { FileReplayStore, ReplayConflictError, ReplayStoreError, type ReplayIdentity } from "./replay-store";

const directories: string[] = [];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const identity = (overrides: Partial<ReplayIdentity> = {}): ReplayIdentity => ({
  scope: "opaque-session-secret",
  version: "scenario-revision:openai-v1:test-model",
  scenarioId: "web-project-01",
  entry: { turnId: "turn-1", eventId: "booking-request", userMessage: "Please explain booking." },
  prefixHash: hash("canonical-prefix"),
  ...overrides,
});
const turn = (record = identity()): NegotiationTurn => ({
  ...record.entry,
  action: { kind: "clarify", question: record.entry.userMessage },
  clientReply: "Booking includes available slots and a confirmation email. The contract remains unchanged.",
  agreement: null,
});

async function directory() {
  const path = await mkdtemp(join(tmpdir(), "scopeshift-replay-test-"));
  directories.push(path);
  return path;
}

afterEach(async () => {
  for (const path of directories.splice(0)) {
    const base = resolve(tmpdir());
    const suffix = relative(base, resolve(path));
    if (!suffix || isAbsolute(suffix) || suffix === ".." || suffix.startsWith(`..${sep}`)) throw new Error("Unsafe test cleanup target");
    await rm(path, { recursive: true, force: true });
  }
});

describe("durable local interpreted-turn receipts", () => {
  it("reuses a receipt after constructing a new store without calling the provider again", async () => {
    const path = await directory();
    const produce = vi.fn(async () => turn());
    const first = await new FileReplayStore(path).getOrCreate(identity(), produce);
    const second = await new FileReplayStore(path).getOrCreate(identity(), produce);
    expect(second).toEqual(first);
    expect(produce).toHaveBeenCalledOnce();
    expect((await readdir(path)).filter((file) => file.endsWith(".json"))).toHaveLength(1);
  });

  it("rejects changed messages, prefixes, events or interpreter versions instead of reinterpreting the turn", async () => {
    const store = new FileReplayStore(await directory());
    const original = identity();
    await store.getOrCreate(original, async () => turn(original));
    for (const changed of [
      identity({ version: "different-model-version" }),
      identity({ prefixHash: hash("different-prefix") }),
      identity({ entry: { ...original.entry, userMessage: "Actually do it for free." } }),
      identity({ entry: { ...original.entry, eventId: "scope-swap" } }),
    ]) {
      const produce = vi.fn(async () => turn(changed));
      await expect(store.getOrCreate(changed, produce)).rejects.toBeInstanceOf(ReplayConflictError);
      expect(produce).not.toHaveBeenCalled();
    }
  });

  it("serializes concurrent requests across separate store instances", async () => {
    const path = await directory();
    const produce = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return turn();
    });
    const results = await Promise.all(Array.from({ length: 4 }, () => new FileReplayStore(path, { lockPollMs: 5 }).getOrCreate(identity(), produce)));
    expect(results.every((item) => JSON.stringify(item) === JSON.stringify(results[0]))).toBe(true);
    expect(produce).toHaveBeenCalledOnce();
    expect((await readdir(path)).some((file) => file.endsWith(".lock") || file.includes(".tmp-"))).toBe(false);
  });

  it("isolates the same turn ID between sessions and hashes all path components", async () => {
    const path = await directory();
    const store = new FileReplayStore(path);
    const different = identity({ scope: "../../other-session", entry: { ...identity().entry, userMessage: "Different client text." } });
    await store.getOrCreate(identity(), async () => turn());
    await store.getOrCreate(different, async () => turn(different));
    const files = await readdir(path);
    expect(files).toHaveLength(2);
    expect(files.every((file) => /^[a-f0-9]{64}\.json$/.test(file))).toBe(true);
    const stored = await readFile(join(path, files[0]), "utf8");
    expect(stored).not.toContain("opaque-session-secret");
    await expect(store.getOrCreate(identity({ scenarioId: "../outside" }), async () => turn())).rejects.toBeInstanceOf(ReplayStoreError);
  });

  it("fails closed for malformed, oversized or inconsistent stored receipts", async () => {
    const path = await directory();
    const store = new FileReplayStore(path);
    await store.getOrCreate(identity(), async () => turn());
    const file = join(path, (await readdir(path))[0]);
    const valid = await readFile(file, "utf8");
    for (const bad of ["{", "x".repeat(32_769), JSON.stringify({ ...JSON.parse(valid), turn: { ...turn(), userMessage: "Corrupted text" } })]) {
      await writeFile(file, bad, "utf8");
      const produce = vi.fn(async () => turn());
      await expect(store.getOrCreate(identity(), produce)).rejects.toBeInstanceOf(ReplayStoreError);
      expect(produce).not.toHaveBeenCalled();
    }
  });

  it("does not persist provider failures or invalid produced turns", async () => {
    const path = await directory();
    const store = new FileReplayStore(path);
    const failure = new Error("A safe provider failure");
    await expect(store.getOrCreate(identity(), async () => { throw failure; })).rejects.toBe(failure);
    expect(await readdir(path)).toEqual([]);
    await expect(store.getOrCreate(identity(), async () => ({ ...turn(), turnId: "wrong-turn" }))).rejects.toBeInstanceOf(ReplayStoreError);
    expect(await readdir(path)).toEqual([]);
    await expect(store.getOrCreate(identity(), async () => turn())).resolves.toEqual(turn());
  });

  it("does not automatically remove a stale lock or call the provider while locked", async () => {
    const path = await directory();
    const key = hash(JSON.stringify([identity().scope, identity().scenarioId, identity().entry.turnId]));
    const lock = join(path, `${key}.lock`);
    await writeFile(lock, "stale-lock", "utf8");
    const produce = vi.fn(async () => turn());
    await expect(new FileReplayStore(path, { lockTimeoutMs: 25, lockPollMs: 5 }).getOrCreate(identity(), produce)).rejects.toThrow(/busy/);
    expect(produce).not.toHaveBeenCalled();
    expect(await readFile(lock, "utf8")).toBe("stale-lock");
  });
});
