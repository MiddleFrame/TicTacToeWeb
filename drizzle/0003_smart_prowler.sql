CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`target_user_id` text,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_log_target_created` ON `admin_audit_log` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_audit_log_actor` ON `admin_audit_log` (`actor_user_id`);--> statement-breakpoint
CREATE TABLE `api_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_rate_limits_reset_at` ON `api_rate_limits` (`reset_at`);