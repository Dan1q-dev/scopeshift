import { ScopeShiftApiError } from "@/lib/client/api";

/** Turns an API failure into a message for the user. Failures are never replaced with made-up results. */
export function describeError(error: unknown) {
  if (error instanceof ScopeShiftApiError) {
    if (error.code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
    if (error.code === "AI_UNAVAILABLE") return "The client is temporarily unavailable. Your message was not lost - try again.";
    if (error.code === "NOT_IMPLEMENTED") return "The negotiation service is not available on this server yet.";
    return error.message;
  }
  return "Could not reach the server. Check your connection and try again.";
}
