import { buildProposedChangeOrder } from "@/lib/real-projects/change-order";
import { realClientRequestSchema, type ChangeOrder } from "@/types/real-project";

/** Rebuild a saved proposal from its historical source, without changing the project. */
export function restoreSavedChangeOrder(value: unknown): ChangeOrder | null {
  try {
    const parsed = realClientRequestSchema.safeParse(value);
    if (!parsed.success) return null;
    const request = parsed.data;
    if (!request.impact || !request.impactHash) return null;
    return buildProposedChangeOrder(request.projectSnapshot, request, request.impact, request.impactHash);
  } catch {
    // Incomplete or inconsistent history must not interrupt the workspace render.
    return null;
  }
}
