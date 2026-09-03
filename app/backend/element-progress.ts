import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { STARTER_SELECTED_KINDS, type CardKind } from "../game/cards.ts";
import { initialPasses, type ElementPasses } from "../game/element-progression.ts";
import { initialDeckLibrary, type DeckLibrary } from "../game/saved-decks.ts";
import { normalizeUnlockedKinds, parseStoredKinds } from "../game/player-progress.ts";

export type ProgressionState = { passes: ElementPasses; deckLibrary: DeckLibrary };
export type ProgressionContext = {
  state: ProgressionState;
  coins: number;
  unlockedKinds: CardKind[];
  statements: D1PreparedStatement[];
  db: D1Database;
  userId: string;
  operationId: string;
  now: number;
};

export async function readElementProgress(db: D1Database, userId: string): Promise<{ state: ProgressionState; revision: number }> {
  const legacy = await db.prepare("SELECT selected_kinds FROM player_progress WHERE user_id = ?").bind(userId).first<{ selected_kinds: string }>();
  const kinds = parseStoredKinds(legacy?.selected_kinds ?? null);
  const initial: ProgressionState = { passes: initialPasses(), deckLibrary: initialDeckLibrary(kinds.length >= 5 ? kinds : STARTER_SELECTED_KINDS) };
  await db.prepare("INSERT INTO element_progress (user_id, state, revision) VALUES (?, ?, 0) ON CONFLICT DO NOTHING")
    .bind(userId, JSON.stringify(initial)).run();
  const row = await db.prepare("SELECT state, revision FROM element_progress WHERE user_id = ?").bind(userId).first<{ state: string; revision: number }>();
  if (!row) throw new Error("progress-unavailable");
  const state = JSON.parse(row.state) as ProgressionState;
  state.passes = { ...initialPasses(), ...state.passes };
  return { state, revision: row.revision };
}

async function previousOperation<T>(db: D1Database, userId: string, operationId: string): Promise<T | null> {
  const row = await db.prepare("SELECT result FROM progression_operations WHERE user_id = ? AND operation_id = ?")
    .bind(userId, operationId).first<{ result: string }>();
  return row ? JSON.parse(row.result) as T : null;
}

async function operationContext(db: D1Database, userId: string, operationId: string, state: ProgressionState): Promise<ProgressionContext> {
  const [wallet, items] = await Promise.all([
    db.prepare("SELECT coins FROM wallets WHERE user_id = ?").bind(userId).first<{ coins: number }>(),
    db.prepare("SELECT item_id FROM inventory WHERE user_id = ?").bind(userId).all<{ item_id: string }>(),
  ]);
  if (!wallet) throw new Error("progress-unavailable");
  return { db, userId, operationId, state, coins: wallet.coins, now: Date.now(), statements: [], unlockedKinds: normalizeUnlockedKinds(items.results.map((item) => item.item_id)) };
}

export async function mutateElementProgress<T>(db: D1Database, userId: string, operationId: string, apply: (context: ProgressionContext) => T): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const previous = await previousOperation<T>(db, userId, operationId);
    if (previous !== null) return previous;
    const { state, revision } = await readElementProgress(db, userId);
    const context = await operationContext(db, userId, operationId, state);
    const result = apply(context);
    try {
      await db.batch([
        db.prepare("INSERT INTO progression_operations (user_id, operation_id, revision, result, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(userId, operationId, revision + 1, JSON.stringify(result), context.now),
        ...context.statements,
        db.prepare("UPDATE element_progress SET state = ?, revision = ? WHERE user_id = ?")
          .bind(JSON.stringify(state), revision + 1, userId),
      ]);
      return result;
    } catch (error) {
      const replay = await previousOperation<T>(db, userId, operationId);
      if (replay !== null) return replay;
      const latest = await readElementProgress(db, userId);
      if (latest.revision === revision) throw error;
    }
  }
  throw new Error("progress-busy");
}

export function changeCoins(context: ProgressionContext, amount: number, reason: string): void {
  if (context.coins + amount < 0) throw new Error("insufficient-coins");
  const { db, userId, operationId, now, statements } = context;
  statements.push(
    db.prepare("UPDATE wallets SET coins = coins + ?, updated_at = ? WHERE user_id = ?").bind(amount, now, userId),
    db.prepare("INSERT INTO reward_ledger (id, operation_id, user_id, currency, amount, balance_after, reason, created_at) SELECT ?, ?, ?, 'coins', ?, coins, ?, ? FROM wallets WHERE user_id = ?")
      .bind(crypto.randomUUID(), operationId, userId, amount, reason, now, userId),
  );
  context.coins += amount;
}
