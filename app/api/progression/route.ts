import { getRawDb } from "../../../db";
import { applyProgressionAction } from "../../backend/progression-actions";
import { parseProgressionInput } from "../../backend/progression-input";
import { getPlayerProgress } from "../../backend/progress";
import { authenticateRequest } from "../../backend/request-session";
import { apiJson, apiOptions } from "../../backend/responses";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  try {
    const input = parseProgressionInput(await request.text());
    const userId = authenticated.account.id;
    if (input.accountId !== undefined && input.accountId !== userId) throw new Error("account-changed");
    const result = await applyProgressionAction(getRawDb(), userId, input.operationId, input);
    return apiJson(request, { ...result, progress: await getPlayerProgress(userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "progression-failed";
    const publicErrors = ["account-changed", "invalid-operation", "input-too-large", "unknown-collection", "reward-unavailable", "invalid-deck-library", "invalid-round-outcome", "invalid-round-deck", "invalid-round-mode", "unknown-progression-action", "progress-busy", "unsupported-progression-version"];
    return apiJson(request, { error: publicErrors.includes(message) ? message : "progression-failed" }, { status: 400 });
  }
}

export const OPTIONS = apiOptions;
