import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ projectId: string }> };

export function GET(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ project: await service.getProject(scope, params.projectId!) }));
}
export function PATCH(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => ({ project: await service.updateProject(scope, params.projectId!, await readRealJson(request)) }));
}
export function DELETE(request: Request, context: RouteContext) {
  return realHttp(request, context.params, async ({ service, scope, params }) => {
    await service.deleteProject(scope, params.projectId!);
    return { deleted: true };
  });
}
