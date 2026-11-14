import { z } from "zod";
import { historyEntrySchema, idSchema, negotiateResponseSchema, type ServerAttempt } from "@/types/scope";

const attemptSchema = z.object({
  id: idSchema,
  createdAt: z.number(),
  history: z.array(historyEntrySchema).max(50),
  response: negotiateResponseSchema.nullable(),
});
export type Attempt = z.infer<typeof attemptSchema>;

const sessionSchema = z.object({ attempts: z.array(attemptSchema).min(1).max(20), activeId: z.string() });
export type Session = z.infer<typeof sessionSchema>;

const key = (scenarioId: string) => `scopeshift:v2:${scenarioId}`;

export function newAttempt(history: Attempt["history"] = []): Attempt {
  return { id: crypto.randomUUID(), createdAt: Date.now(), history, response: null };
}

export function mergeSavedAttempts(local: Session, remote: readonly ServerAttempt[]): Session {
  const attempts = new Map<string, Attempt>(remote.map((attempt) => [attempt.id, attempt]));
  for (const attempt of local.attempts) {
    const saved = attempts.get(attempt.id);
    // Retain browser-only drafts and any longer local history while loading a
    // server snapshot. Never discard an unsent branch on a history read.
    if (!saved || attempt.history.length > saved.history.length) attempts.set(attempt.id, attempt);
  }
  const merged = [...attempts.values()].sort((left, right) => left.createdAt - right.createdAt).slice(-20);
  return { attempts: merged, activeId: merged.some((attempt) => attempt.id === local.activeId) ? local.activeId : merged.at(-1)!.id };
}

export function loadSession(scenarioId: string, remote: readonly ServerAttempt[] = []): Session {
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(window.localStorage.getItem(key(scenarioId)) ?? "null"));
    if (parsed.success && parsed.data.attempts.some((attempt) => attempt.id === parsed.data.activeId)) return mergeSavedAttempts(parsed.data, remote);
  } catch {
    // Unreadable or blocked storage: start a clean session.
  }
  if (remote.length) {
    const attempts = [...remote].sort((left, right) => left.createdAt - right.createdAt).slice(-20);
    return { attempts, activeId: attempts.at(-1)!.id };
  }
  const attempt = newAttempt();
  return { attempts: [attempt], activeId: attempt.id };
}

export function saveSession(scenarioId: string, session: Session) {
  try {
    window.localStorage.setItem(key(scenarioId), JSON.stringify(session));
  } catch {
    // Storage may be full or disabled. The session still works in memory.
  }
}
