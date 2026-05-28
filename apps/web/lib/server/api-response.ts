import { NextResponse } from "next/server";

// Success payload shape is consistent across routes: { requestId, data }.
export function ok(data: unknown, requestId: string) {
  return NextResponse.json({ requestId, data });
}

// Error payload shape is consistent across routes and always includes a machine-readable code.
export function fail(status: number, code: string, message: string, requestId: string, details?: unknown) {
  return NextResponse.json({ requestId, error: { code, message, details } }, { status });
}

// Reuse inbound request IDs for tracing; generate one when callers do not provide it.
export function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
