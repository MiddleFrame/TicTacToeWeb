import { purchaseCardPack } from "../../../backend/progress";
import { authenticateRequest } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";
import { isOperationId } from "../../../game/player-progress";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  let input: { operationId?: unknown; count?: unknown; collectionId?: unknown };
  try {
    input = await request.json();
  } catch {
    return apiJson(request, { error: "invalid-json" }, { status: 400 });
  }
  if (!input || !isOperationId(input.operationId) || typeof input.count !== "number" || typeof input.collectionId !== "string") {
    return apiJson(request, { error: "invalid-purchase" }, { status: 400 });
  }
  try {
    return apiJson(
      request,
      await purchaseCardPack(authenticated.account.id, input.operationId, input.count, input.collectionId),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "purchase-failed";
    const status = code === "insufficient-coins" || code === "insufficient-locked-cards" ? 409 : 400;
    return apiJson(request, { error: code }, { status });
  }
}

export const OPTIONS = apiOptions;
