import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ projectId: string }> };

export function GET(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ requests: await service.listRequests(scope, params.projectId!) }));
}
export function POST(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ request: await service.analyze(scope, params.projectId!, await readRealJson(request)) }));
}
