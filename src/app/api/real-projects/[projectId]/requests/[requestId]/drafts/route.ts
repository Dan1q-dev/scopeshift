import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ projectId: string; requestId: string }> };

export function GET(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ drafts: await service.listDrafts({ scope, projectId: params.projectId!, requestId: params.requestId! }) }));
}
export function POST(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ draft: await service.generateDraft({ scope, projectId: params.projectId!, requestId: params.requestId! }, await readRealJson(request)) }));
}
