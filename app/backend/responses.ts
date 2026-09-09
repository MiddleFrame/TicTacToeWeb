import { progressionResponse } from "./progression-response.ts";

const ANDROID_ORIGINS = new Set([
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !ANDROID_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-TTTP-Client, X-TTTP-Progression",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Retry-After",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function apiJson(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return Response.json(progressionResponse(body, request.headers.get("X-TTTP-Progression")), {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders(request),
      ...init.headers,
    },
  });
}

export function apiEmpty(request: Request, status = 204): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders(request),
    },
  });
}

export function apiOptions(request: Request): Response {
  return apiEmpty(request);
}
