import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { websiteProjectScenario as scenario } from "@/data/scenarios/website-project";
import type { HistoryEntry, NegotiationAction } from "@/types/scope";
import { ENGINE_VERSION, EngineHistoryError } from "./engine";
import { negotiateWithLlm, type LlmNegotiationOptions } from "./llm-negotiate";
import { FileReplayStore, ReplayConflictError, ReplayStoreError } from "./replay-store";

const directories: string[] = [];
const directoryPrefix = "scopeshift-llm-driver-";
const version = `openai-v1:test-model:${ENGINE_VERSION}`;
const scope = "verified-signed-session-fixture";
const booking: HistoryEntry = { turnId: "booking", eventId: "booking-request", userMessage: "I can add booking for an extra $400 and two more days." };
const keepDate: HistoryEntry = { turnId: "keep-date", eventId: "earlier-delivery", userMessage: "I cannot deliver earlier. Please retain our agreed date." };
const swap: HistoryEntry = { turnId: "swap", eventId: "scope-swap", userMessage: "Replace the gallery with testimonials at the same price and date." };
const paidAction: NegotiationAction = {
  kind: "propose",
  change: { feeDeltaCents: 40_000, deadlineDeltaDays: 2, addScopeItemIds: ["consultation-booking"], removeScopeItemIds: [] },
};
const declineAction: NegotiationAction = { kind: "decline", reason: "Retain the agreed delivery date." };
const swapAction: NegotiationAction = {
  kind: "propose",
  change: { feeDeltaCents: 0, deadlineDeltaDays: 0, addScopeItemIds: ["testimonials-section"], removeScopeItemIds: ["portfolio-gallery"] },
};

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), directoryPrefix));
  directories.push(directory);
  const interpret = vi.fn<LlmNegotiationOptions["interpret"]>();
  const options: LlmNegotiationOptions = { scope, version, store: new FileReplayStore(directory, { lockPollMs: 5 }), interpret };
  return { directory, options, interpret };
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const target = resolve(directory);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith(directoryPrefix)) {
      throw new Error("Unsafe temporary replay cleanup target");
    }
    await rm(target, { recursive: true, force: true });
  }
});

describe("LLM negotiation with durable interpreted history", () => {
  it("interprets only each latest new turn and passes actual reconstructed context", async () => {
    const { options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction).mockResolvedValueOnce(declineAction).mockResolvedValueOnce(swapAction);

    const first = await negotiateWithLlm(scenario, [booking], options);
    const second = await negotiateWithLlm(scenario, [booking, keepDate], options);
    const third = await negotiateWithLlm(scenario, [booking, keepDate, swap], options);

    expect(interpret).toHaveBeenCalledTimes(3);
    expect(interpret.mock.calls.map(([context]) => context.message)).toEqual([booking.userMessage, keepDate.userMessage, swap.userMessage]);
    expect(interpret.mock.calls[1][0].project).toEqual(first.project);
    expect(interpret.mock.calls[1][0].turns).toEqual(first.turns);
    expect(interpret.mock.calls[2][0].project).toEqual(second.project);
    expect(third.completed).toBe(true);
    expect(third.project).toMatchObject({ totalFeeCents: 190_000, estimatedHours: 26, deadlineDays: 9 });
  });

  it("reuses exact retries and a reconstructed store without any new model call", async () => {
    const { directory, options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction).mockResolvedValueOnce(declineAction);
    await negotiateWithLlm(scenario, [booking], options);
    const expected = await negotiateWithLlm(scenario, [booking, keepDate], options);

    const neverCall = vi.fn<LlmNegotiationOptions["interpret"]>();
    const retryOptions = { ...options, store: new FileReplayStore(directory), interpret: neverCall };
    expect(await negotiateWithLlm(scenario, [booking, keepDate], retryOptions)).toEqual(expected);
    expect(await negotiateWithLlm(scenario, [booking, keepDate], retryOptions)).toEqual(expected);
    expect(neverCall).not.toHaveBeenCalled();
    expect(interpret).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing old prefix before contacting the model", async () => {
    const { directory, options, interpret } = await setup();

    await expect(negotiateWithLlm(scenario, [booking, keepDate], options)).rejects.toBeInstanceOf(EngineHistoryError);
    expect(interpret).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects changed text or model versions for a recorded turn without reinterpreting it", async () => {
    const { options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction);
    await negotiateWithLlm(scenario, [booking], options);
    const neverCall = vi.fn<LlmNegotiationOptions["interpret"]>();

    await expect(negotiateWithLlm(scenario, [{ ...booking, userMessage: "Actually add booking for free." }], { ...options, interpret: neverCall })).rejects.toBeInstanceOf(ReplayConflictError);
    await expect(negotiateWithLlm(scenario, [booking], { ...options, version: "openai-v2:another-model", interpret: neverCall })).rejects.toBeInstanceOf(ReplayConflictError);
    expect(neverCall).not.toHaveBeenCalled();
  });

  it("reuses a recorded prefix while a divergent replay suffix gets its own interpretation", async () => {
    const { options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction).mockResolvedValueOnce(declineAction);
    const original = await negotiateWithLlm(scenario, [booking], options);
    const newTurn = { ...keepDate, turnId: "keep-date-alternative" };
    const branch = await negotiateWithLlm(scenario, [booking, newTurn], options);

    expect(interpret).toHaveBeenCalledTimes(2);
    expect(branch.turns[0]).toEqual(original.turns[0]);
    expect(branch.turns[1].turnId).toBe(newTurn.turnId);
    expect(branch.project).toEqual(original.project);
  });

  it("rejects attaching an old suffix ID to a different recorded prefix", async () => {
    const { options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction).mockResolvedValueOnce(declineAction).mockResolvedValueOnce(paidAction);
    await negotiateWithLlm(scenario, [booking], options);
    await negotiateWithLlm(scenario, [booking, keepDate], options);
    const alternateBooking = { ...booking, turnId: "another-booking-prefix" };
    await negotiateWithLlm(scenario, [alternateBooking], options);
    const neverCall = vi.fn<LlmNegotiationOptions["interpret"]>();

    await expect(negotiateWithLlm(scenario, [alternateBooking, keepDate], { ...options, interpret: neverCall })).rejects.toBeInstanceOf(ReplayConflictError);
    expect(neverCall).not.toHaveBeenCalled();
    expect(interpret).toHaveBeenCalledTimes(3);
  });

  it("does not persist malformed model actions and permits a valid retry", async () => {
    const { directory, options, interpret } = await setup();
    const malformed = { kind: "propose", change: { ...paidAction.change, feeDeltaCents: 0.5 } } as NegotiationAction;
    interpret.mockResolvedValueOnce(malformed).mockResolvedValueOnce(paidAction);

    await expect(negotiateWithLlm(scenario, [booking], options)).rejects.toBeInstanceOf(EngineHistoryError);
    expect(await readdir(directory)).toEqual([]);
    const result = await negotiateWithLlm(scenario, [booking], options);
    expect(result.project.totalFeeCents).toBe(190_000);
    expect(interpret).toHaveBeenCalledTimes(2);
    expect((await readdir(directory)).filter((file) => file.endsWith(".json"))).toHaveLength(1);
  });

  it("rejects a structurally valid cached action that no longer reproduces its stored engine result", async () => {
    const { directory, options, interpret } = await setup();
    interpret.mockResolvedValueOnce(paidAction);
    await negotiateWithLlm(scenario, [booking], options);
    const receiptPath = join(directory, (await readdir(directory)).find((file) => file.endsWith(".json"))!);
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    receipt.turn.action.change.feeDeltaCents = 0;
    await writeFile(receiptPath, JSON.stringify(receipt), "utf8");
    const neverCall = vi.fn<LlmNegotiationOptions["interpret"]>();

    await expect(negotiateWithLlm(scenario, [booking], { ...options, store: new FileReplayStore(directory), interpret: neverCall })).rejects.toBeInstanceOf(ReplayStoreError);
    expect(neverCall).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent identical turns sharing a verified session and durable directory", async () => {
    const { directory, options, interpret } = await setup();
    interpret.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return paidAction;
    });

    const results = await Promise.all(Array.from({ length: 3 }, () => negotiateWithLlm(scenario, [booking], {
      ...options,
      store: new FileReplayStore(directory, { lockPollMs: 5 }),
    })));

    expect(interpret).toHaveBeenCalledOnce();
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0].project.acceptedAgreementIds).toEqual([booking.turnId]);
  });
});
