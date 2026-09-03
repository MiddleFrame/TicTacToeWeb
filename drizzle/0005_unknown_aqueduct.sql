CREATE TABLE `element_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progression_operations` (
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`revision` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `operation_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_progression_user_revision` ON `progression_operations` (`user_id`,`revision`);