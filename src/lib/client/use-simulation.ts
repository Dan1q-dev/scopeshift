"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getScenario, getScenarios, negotiate } from "@/lib/client/api";
import { describeError } from "@/lib/client/negotiation";
import { loadSession, newAttempt, saveSession, type Attempt, type Session } from "@/lib/client/session";
import type { HistoryEntry, PublicScenario } from "@/types/scope";

type Pending = { attemptId: string; history: HistoryEntry[]; message: string | null };

export function useSimulation() {
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<(Pending & { error: string }) | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const scenarioRef = useRef<PublicScenario | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [first] = await getScenarios(controller.signal);
        if (!first) throw new Error("No scenarios are available.");
        const loaded = await getScenario(first.id, controller.signal);
        scenarioRef.current = loaded;
        setScenario(loaded);
        setSession(loadSession(loaded.id));
        setLoadError(null);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(describeError(error));
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  const update = useCallback((next: Session) => {
    setSession(next);
    if (scenarioRef.current) saveSession(scenarioRef.current.id, next);
  }, []);

  const submit = useCallback(async (base: Session, job: Pending) => {
    const current = scenarioRef.current;
    if (!current) return;
    setSending(true);
    setFailed(null);
    setPending(job);
    try {
      const response = await negotiate({ scenarioId: current.id, history: job.history });
      update({ ...base, attempts: base.attempts.map((attempt) => (attempt.id === job.attemptId ? { ...attempt, history: job.history, response } : attempt)) });
    } catch (error) {
      setFailed({ ...job, error: describeError(error) });
    } finally {
      setPending(null);
      setSending(false);
    }
  }, [update]);

  const active = session?.attempts.find((attempt) => attempt.id === session.activeId) ?? null;
  const currentEventId = active?.response ? active.response.currentEventId : scenario?.events[0]?.id ?? null;

  const send = useCallback((message: string) => {
    if (!session || !active || !currentEventId || sending) return;
    const entry: HistoryEntry = { turnId: crypto.randomUUID(), eventId: currentEventId, userMessage: message };
    void submit(session, { attemptId: active.id, history: [...active.history, entry], message });
  }, [session, active, currentEventId, sending, submit]);

  const retry = useCallback(() => {
    if (session && failed && !sending) void submit(session, { attemptId: failed.attemptId, history: failed.history, message: failed.message });
  }, [session, failed, sending, submit]);

  /** Replay: a new attempt that keeps the history before the chosen turn. The server recomputes that prefix. */
  const replayFrom = useCallback((turnIndex: number) => {
    if (!session || !active || sending) return;
    const attempt: Attempt = newAttempt(active.history.slice(0, turnIndex));
    const next: Session = { attempts: [...session.attempts, attempt].slice(-20), activeId: attempt.id };
    update(next);
    setFailed(null);
    if (attempt.history.length > 0) void submit(next, { attemptId: attempt.id, history: attempt.history, message: null });
  }, [session, active, sending, update, submit]);

  const selectAttempt = useCallback((attemptId: string) => {
    if (session && !sending) {
      setFailed(null);
      update({ ...session, activeId: attemptId });
    }
  }, [session, sending, update]);

  return {
    scenario, session, active, currentEventId, loadError, sending, failed,
    pendingMessage: pending && pending.attemptId === active?.id ? pending.message : null,
    send, retry, replayFrom, selectAttempt,
    startOver: () => replayFrom(0),
    reload: () => setReloadKey((value) => value + 1),
  };
}
