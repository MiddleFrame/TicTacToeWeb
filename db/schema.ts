import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: ["active", "banned", "deleted"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "users_status_valid",
      sql`${table.status} IN ('active', 'banned', 'deleted')`,
    ),
  ],
);

export const identities = sqliteTable(
  "identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["guest", "google", "discord"] })
      .notNull(),
    providerUserId: text("provider_user_id").notNull(),
    providerEmail: text("provider_email"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_identities_provider_user")
      .on(table.provider, table.providerUserId),
    index("idx_identities_user_id").on(table.userId),
    check(
      "identities_provider_valid",
      sql`${table.provider} IN ('guest', 'google', 'discord')`,
    ),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    publicCode: text("public_code").notNull(),
    nickname: text("nickname").notNull(),
    avatarId: text("avatar_id"),
    frameId: text("frame_id"),
    titleId: text("title_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_profiles_public_code").on(table.publicCode),
    index("idx_profiles_nickname").on(table.nickname),
  ],
);

export const wallets = sqliteTable(
  "wallets",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    coins: integer("coins").notNull().default(0),
    cosmeticCurrency: integer("cosmetic_currency").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("wallets_coins_non_negative", sql`${table.coins} >= 0`),
    check(
      "wallets_cosmetic_currency_non_negative",
      sql`${table.cosmeticCurrency} >= 0`,
    ),
  ],
);

export const inventory = sqliteTable(
  "inventory",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    acquiredAt: integer("acquired_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.itemId] }),
    check("inventory_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const playerProgress = sqliteTable("player_progress", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  selectedKinds: text("selected_kinds").notNull(),
  legacyImportedAt: integer("legacy_imported_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const storePurchases = sqliteTable(
  "store_purchases",
  {
    operationId: text("operation_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purchasedKinds: text("purchased_kinds").notNull(),
    cost: integer("cost").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_store_purchases_user_created").on(table.userId, table.createdAt),
    check("store_purchases_cost_positive", sql`${table.cost} > 0`),
  ],
);

export const rewardLedger = sqliteTable(
  "reward_ledger",
  {
    id: text("id").primaryKey(),
    operationId: text("operation_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency", { enum: ["coins", "cosmetic"] }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_reward_ledger_operation_id").on(table.operationId),
    index("idx_reward_ledger_user_created").on(table.userId, table.createdAt),
    check("reward_ledger_amount_non_zero", sql`${table.amount} <> 0`),
    check(
      "reward_ledger_currency_valid",
      sql`${table.currency} IN ('coins', 'cosmetic')`,
    ),
    check(
      "reward_ledger_balance_non_negative",
      sql`${table.balanceAfter} >= 0`,
    ),
  ],
);

export const apiRateLimits = sqliteTable(
  "api_rate_limits",
  {
    key: text("key").primaryKey(),
    hits: integer("hits").notNull(),
    resetAt: integer("reset_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_api_rate_limits_reset_at").on(table.resetAt)],
);

export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_admin_audit_log_target_created").on(table.targetUserId, table.createdAt),
    index("idx_admin_audit_log_actor").on(table.actorUserId),
  ],
);
