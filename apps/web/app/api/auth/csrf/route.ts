import { ok, requestIdFrom } from "@/lib/server/api-response";
import { issueCsrfToken } from "@/lib/server/security";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const response = ok({ csrfReady: true }, requestId);
  await issueCsrfToken(response);
  return response;
}

