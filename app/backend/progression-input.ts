import { isOperationId } from "../game/player-progress.ts";

export const MAX_PROGRESSION_REQUEST_LENGTH = 128 * 1024;

export function parseProgressionInput(body: string): Record<string, unknown> & { operationId: string } {
  if (body.length > MAX_PROGRESSION_REQUEST_LENGTH) throw new Error("input-too-large");
  const input = JSON.parse(body);
  if (!input || !isOperationId(input.operationId)) throw new Error("invalid-operation");
  return input;
}
