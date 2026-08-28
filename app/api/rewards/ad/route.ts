import { grantRewardedAdCoins } from "../../../backend/progress";
import { authenticateRequest } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";
import { isOperationId } from "../../../game/player-progress";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  let input: { operationId?: unknown };
  try {
    input = await request.json();
  } catch {
    return apiJson(request, { error: "invalid-json" }, { status: 400 });
  }
  if (!isOperationId(input.operationId)) {
    return apiJson(request, { error: "invalid-reward" }, { status: 400 });
  }
  try {
    const progress = await grantRewardedAdCoins(authenticated.account.id, input.operationId);
    return apiJson(request, { progress });
  } catch (error) {
    const code = error instanceof Error ? error.message : "reward-failed";
    return apiJson(request, { error: code }, { status: code === "reward-rate-limited" ? 429 : 400 });
  }
}

export const OPTIONS = apiOptions;
