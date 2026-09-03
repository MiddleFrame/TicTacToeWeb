CREATE TABLE `account_deletion_tickets` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_deletion_tickets_user` ON `account_deletion_tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_deletion_tickets_expiry` ON `account_deletion_tickets` (`expires_at`);