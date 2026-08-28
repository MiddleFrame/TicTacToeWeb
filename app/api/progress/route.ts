import { authenticateRequest } from "../../backend/request-session";
import { apiJson, apiOptions } from "../../backend/responses";
import { getPlayerProgress, updatePlayerProfile } from "../../backend/progress";

export async function GET(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  return apiJson(request, {
    progress: await getPlayerProgress(authenticated.account.id),
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  let input: { nickname?: unknown; selectedKinds?: unknown };
  try {
    input = await request.json();
  } catch {
    return apiJson(request, { error: "invalid-json" }, { status: 400 });
  }
  const progress = await updatePlayerProfile(authenticated.account.id, input);
  return apiJson(request, { progress });
}

export const OPTIONS = apiOptions;
