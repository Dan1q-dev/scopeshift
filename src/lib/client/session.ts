import { z } from "zod";
import { historyEntrySchema, negotiateResponseSchema } from "@/types/scope";

const attemptSchema = z.object({
  id: z.string().min(1),
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

export function loadSession(scenarioId: string): Session {
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(window.localStorage.getItem(key(scenarioId)) ?? "null"));
    if (parsed.success && parsed.data.attempts.some((attempt) => attempt.id === parsed.data.activeId)) return parsed.data;
  } catch {
    // Unreadable or blocked storage: start a clean session.
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
