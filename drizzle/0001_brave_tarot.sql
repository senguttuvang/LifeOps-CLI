CREATE TABLE `user_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`avg_response_time_minutes` real,
	`response_time_p50` real,
	`response_time_p95` real,
	`initiation_rate` real,
	`avg_message_length` real,
	`message_length_std` real,
	`median_message_length` real,
	`avg_words_per_message` real,
	`emoji_per_message` real,
	`emoji_variance` real,
	`top_emojis` text,
	`emoji_position` text,
	`exclamation_rate` real,
	`question_rate` real,
	`period_rate` real,
	`ellipsis_rate` real,
	`common_greetings` text,
	`common_endings` text,
	`common_phrases` text,
	`filler_words` text,
	`asks_followup_questions` real,
	`uses_voice_notes` real,
	`sends_multiple_messages` real,
	`edits_messages` real,
	`active_hours` text,
	`weekend_vs_weekday_diff` real,
	`message_count` integer DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`last_computed_at` integer DEFAULT (unixepoch()),
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_signals_user_id_unique` ON `user_signals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_signals_user_id` ON `user_signals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_signals_confidence` ON `user_signals` (`confidence`);--> statement-breakpoint
CREATE INDEX `idx_signals_last_computed` ON `user_signals` (`last_computed_at`);