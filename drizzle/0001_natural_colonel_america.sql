CREATE TABLE `player_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`selected_kinds` text NOT NULL,
	`legacy_imported_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `store_purchases` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purchased_kinds` text NOT NULL,
	`cost` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "store_purchases_cost_positive" CHECK("store_purchases"."cost" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_store_purchases_user_created` ON `store_purchases` (`user_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
