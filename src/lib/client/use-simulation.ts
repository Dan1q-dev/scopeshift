"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getScenario, getScenarios, getSessionInfo, getSavedAttempts, negotiate, type InterpreterMode } from "@/lib/client/api";
import { describeError } from "@/lib/client/negotiation";
import { hideAttempt, loadSession, newAttempt, removeAttempt, saveSession, type Attempt, type Session } from "@/lib/client/session";
import type { HistoryEntry, PublicScenario, ServerAttempt } from "@/types/scope";

type Pending = { attemptId: string; history: HistoryEntry[]; message: string | null };

export function useSimulation() {
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [interpreterMode, setInterpreterMode] = useState<InterpreterMode | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<(Pending & { error: string }) | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const scenarioRef = useRef<PublicScenario | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const serverHistoryRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [scenarios, info] = await Promise.all([getScenarios(controller.signal), getSessionInfo(controller.signal)]);
        const [first] = scenarios;
        if (!first) throw new Error("No scenarios are available.");
        const loaded = await getScenario(first.id, controller.signal);
        let saved: ServerAttempt[] = [];
        let warning: string | null = null;
        if (info.historyStorage === "postgres") {
          try {
            saved = await getSavedAttempts(loaded.id, controller.signal);
          } catch {
            if (controller.signal.aborted) return;
            warning = "Saved server history could not be loaded. Browser attempts are still available; reload to retry.";
          }
        }
        if (controller.signal.aborted) return;
        scenarioRef.current = loaded;
        serverHistoryRef.current = info.historyStorage === "postgres";
        setScenario(loaded);
        setInterpreterMode(info.mode);
        setHistoryWarning(warning);
        const restored = loadSession(loaded.id, saved);
        setSession(restored);
        saveSession(loaded.id, restored);
        setLoadError(null);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(describeError(error));
      }
    })();
    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
  }, [reloadKey]);

  const update = useCallback((next: Session) => {
    setSession(next);
    if (scenarioRef.current) saveSession(scenarioRef.current.id, next);
  }, []);

  const submit = useCallback(async (base: Session, job: Pending) => {
    const current = scenarioRef.current;
    if (!current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    setFailed(null);
    setPending(job);
    try {
      const response = await negotiate({ scenarioId: current.id, history: job.history, ...(serverHistoryRef.current ? { attemptId: job.attemptId } : {}) }, controller.signal);
      if (controller.signal.aborted) return;
      update({ ...base, attempts: base.attempts.map((attempt) => (attempt.id === job.attemptId ? { ...attempt, history: job.history, response } : attempt)) });
    } catch (error) {
      if (!controller.signal.aborted) setFailed({ ...job, error: describeError(error) });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) {
        setPending(null);
        setSending(false);
      }
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

  /** Deletes an attempt from this browser. A server snapshot, if one exists, is hidden here but not erased. */
  const deleteAttempt = useCallback((attemptId: string) => {
    if (!session || sending || !scenarioRef.current) return;
    hideAttempt(scenarioRef.current.id, attemptId);
    setFailed(null);
    update(removeAttempt(session, attemptId));
  }, [session, sending, update]);

  return {
    deleteAttempt,
    scenario, interpreterMode, historyWarning, session, active, currentEventId, loadError, sending, failed,
    // A reply that failed to send stays visible next to the error until it is sent again.
    pendingMessage: [pending, failed].find((job) => job && job.attemptId === active?.id)?.message ?? null,
    send, retry, replayFrom, selectAttempt,
    startOver: () => replayFrom(0),
    reload: () => setReloadKey((value) => value + 1),
  };
}
