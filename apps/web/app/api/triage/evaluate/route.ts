import { triageInputSchema, evaluateTriage } from "@asibi/shared";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const body = await request.json().catch(() => null);
  const parse = triageInputSchema.safeParse(body);
  if (!parse.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parse.error.flatten());

  const result = evaluateTriage(parse.data);
  return ok(result, requestId);
}

