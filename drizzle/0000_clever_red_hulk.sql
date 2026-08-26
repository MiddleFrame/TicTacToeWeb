CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "identities_provider_valid" CHECK("identities"."provider" IN ('guest', 'google', 'discord'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_identities_provider_user` ON `identities` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE INDEX `idx_identities_user_id` ON `identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`acquired_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_quantity_positive" CHECK("inventory"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`public_code` text NOT NULL,
	`nickname` text NOT NULL,
	`avatar_id` text,
	`frame_id` text,
	`title_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_public_code` ON `profiles` (`public_code`);--> statement-breakpoint
CREATE INDEX `idx_profiles_nickname` ON `profiles` (`nickname`);--> statement-breakpoint
CREATE TABLE `reward_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reward_ledger_amount_non_zero" CHECK("reward_ledger"."amount" <> 0),
	CONSTRAINT "reward_ledger_currency_valid" CHECK("reward_ledger"."currency" IN ('coins', 'cosmetic')),
	CONSTRAINT "reward_ledger_balance_non_negative" CHECK("reward_ledger"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reward_ledger_operation_id` ON `reward_ledger` (`operation_id`);--> statement-breakpoint
CREATE INDEX `idx_reward_ledger_user_created` ON `reward_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_status_valid" CHECK("users"."status" IN ('active', 'banned', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`cosmetic_currency` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "wallets_coins_non_negative" CHECK("wallets"."coins" >= 0),
	CONSTRAINT "wallets_cosmetic_currency_non_negative" CHECK("wallets"."cosmetic_currency" >= 0)
);
