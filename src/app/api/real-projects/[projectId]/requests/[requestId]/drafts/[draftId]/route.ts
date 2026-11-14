import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ projectId: string; requestId: string; draftId: string }> };

export function PATCH(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ draft: await service.editDraft({ scope, projectId: params.projectId!, requestId: params.requestId!, draftId: params.draftId! }, await readRealJson(request)) }));
}
