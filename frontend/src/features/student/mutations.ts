import { apiRequest } from "../../api/client";
import type * as C from "./contracts";
const root = "/api/v1";
export async function mutate<T>(
  path: string,
  method: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const token = await apiRequest<C.CsrfTokenResponse>(`${root}/auth/csrf`, {
    cache: "no-store",
  });
  const headers: Record<string, string> = { "X-CSRF-Token": token.csrfToken };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return apiRequest<T>(`${root}${path}`, {
    method,
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
    cache: "no-store",
  });
}
