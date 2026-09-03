import type { D1Database } from "@cloudflare/workers-types";
import { validRoundCards } from "../game/round-progression.ts";
import { collectionById } from "../game/collections.ts";
import { awardExperience, canClaim, claimKey, PASS_REWARDS, ROUND_XP, roundExperience, type RewardTrack, type RoundOutcome } from "../game/element-progression.ts";
import { validateLibrary } from "../game/saved-decks.ts";
import { changeCoins, mutateElementProgress, type ProgressionContext } from "./element-progress.ts";

type ActionInput = Record<string, unknown>;
type ActionHandler = (context: ProgressionContext, input: ActionInput) => object;

const rewardHandlers = {
  currency: (context: ProgressionContext, amount: number) => changeCoins(context, amount, "element-pass-reward"),
};

const claim: ActionHandler = (context, input) => {
  const id = collectionById(String(input.collectionId)).id;
  const pass = context.state.passes[id];
  const level = Number(input.level);
  const track = input.track as RewardTrack;
  if (!canClaim(pass, level, track)) throw new Error("reward-unavailable");
  const rewards = PASS_REWARDS[level - 1].rewards[track];
  for (const reward of rewards) rewardHandlers[reward.type](context, reward.amount);
  pass.claimed.push(claimKey(level, track));
  return { claimed: claimKey(level, track) };
};

const activatePremium: ActionHandler = (context, input) => {
  const id = collectionById(String(input.collectionId)).id;
  context.state.passes[id].premium = true;
  return { activated: id };
};

const saveDecks: ActionHandler = (context, input) => {
  if (!validateLibrary(input.library, context.unlockedKinds)) throw new Error("invalid-deck-library");
  const library = input.library;
  context.state.deckLibrary = library;
  const active = library.decks.find((deck) => deck.id === library.activeId)!;
  context.statements.push(context.db.prepare("UPDATE player_progress SET selected_kinds = ?, updated_at = ? WHERE user_id = ?")
    .bind(JSON.stringify(active.kinds), context.now, context.userId));
  return { saved: active.id };
};

const recordRound: ActionHandler = (context, input) => {
  const outcome = input.outcome as RoundOutcome;
  if (!Object.hasOwn(ROUND_XP, outcome)) throw new Error("invalid-round-outcome");
  const cards = validRoundCards(input.mode, input.kinds, context.unlockedKinds);
  return { awards: awardExperience(context.state.passes, roundExperience(cards, outcome)) };
};

const actions: Record<string, ActionHandler> = {
  claim,
  "activate-test-premium": activatePremium,
  "save-decks": saveDecks,
  "record-round": recordRound,
};

export async function applyProgressionAction(db: D1Database, userId: string, operationId: string, input: ActionInput) {
  const handler = actions[String(input.type)];
  if (!Object.hasOwn(actions, String(input.type))) throw new Error("unknown-progression-action");
  return mutateElementProgress(db, userId, operationId, (context) => handler(context, input));
}
