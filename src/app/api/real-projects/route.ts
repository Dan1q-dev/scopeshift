import { realHttp, readRealJson } from "@/lib/real-projects/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request) {
  return realHttp(request, {}, async ({ service, scope }) => ({ projects: await service.listProjects(scope) }));
}
export function POST(request: Request) {
  return realHttp(request, {}, async ({ service, scope }) => ({ project: await service.createProject(scope, await readRealJson(request)) }), 201);
}
