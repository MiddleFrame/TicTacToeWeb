import { importLegacyProgress } from "../../../backend/progress";
import { authenticateRequest } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";
import type { LocalProgressSnapshot } from "../../../game/player-progress";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  let input: LocalProgressSnapshot;
  try {
    input = await request.json();
  } catch {
    return apiJson(request, { error: "invalid-json" }, { status: 400 });
  }
  const progress = await importLegacyProgress(authenticated.account.id, input);
  return apiJson(request, { progress });
}

export const OPTIONS = apiOptions;
