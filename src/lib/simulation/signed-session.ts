import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE } from "./session-store";

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export interface SignedSession { id: string; token: string; established: boolean }

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function signedSession(cookieHeader: string | null, secret: string, now = Date.now()): SignedSession {
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const match = value?.match(/^([0-9a-f-]{36})\.(\d{13})\.([0-9a-f]{64})$/i);
  if (match) {
    const [, id, expires, signature] = match;
    const expected = sign(`${id}.${expires}`, secret);
    if (Number(expires) > now && Number(expires) <= now + SESSION_LIFETIME_MS && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      return { id, token: value!, established: true };
    }
  }
  const id = randomUUID();
  const payload = `${id}.${now + SESSION_LIFETIME_MS}`;
  return { id, token: `${payload}.${sign(payload, secret)}`, established: false };
}

export function signedSessionCookie(session: SignedSession, secure: boolean) {
  return `${SESSION_COOKIE}=${session.token}; Path=/api; Max-Age=${SESSION_LIFETIME_MS / 1000}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
