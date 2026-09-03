import { getPlayerProgress } from "../../../backend/progress";
import { authenticateRequest } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  const progress = await getPlayerProgress(authenticated.account.id);
  return apiJson(request, { progress, legacyImportDisabled: true });
}

export const OPTIONS = apiOptions;
