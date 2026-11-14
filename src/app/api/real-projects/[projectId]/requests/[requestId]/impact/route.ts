import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ projectId: string; requestId: string }> };

export function POST(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => service.calculate({ scope, projectId: params.projectId!, requestId: params.requestId! }, await readRealJson(request)));
}
