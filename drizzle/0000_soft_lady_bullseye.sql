CREATE TABLE `calls` (
	`interaction_id` text PRIMARY KEY NOT NULL,
	`call_type` text NOT NULL,
	`duration_seconds` integer,
	`call_status` text NOT NULL,
	`participants_count` integer DEFAULT 2,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `communication_streaks` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`streak_type` text NOT NULL,
	`current_streak_days` integer DEFAULT 0,
	`longest_streak_days` integer DEFAULT 0,
	`last_interaction_at` integer,
	`streak_broken_at` integer,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contact_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`source` text NOT NULL,
	`identifier` text NOT NULL,
	`is_primary` integer DEFAULT false,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_contact_identifiers_source_identifier` ON `contact_identifiers` (`source`,`identifier`);--> statement-breakpoint
CREATE INDEX `idx_contact_identifiers_contact` ON `contact_identifiers` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`preferred_name` text,
	`type` text DEFAULT 'person' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `conversation_participants` (
	`conversation_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	PRIMARY KEY(`conversation_id`, `contact_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_participants_conversation` ON `conversation_participants` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_contact` ON `conversation_participants` (`contact_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`conversation_type` text DEFAULT '1:1' NOT NULL,
	`source` text NOT NULL,
	`source_conversation_id` text NOT NULL,
	`is_archived` integer DEFAULT false,
	`is_pinned` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`last_activity_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_source_conversation` ON `conversations` (`source`,`source_conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_last_activity` ON `conversations` (`last_activity_at`);--> statement-breakpoint
CREATE TABLE `interaction_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`topic` text NOT NULL,
	`confidence` real NOT NULL,
	`extracted_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_topics_interaction` ON `interaction_topics` (`interaction_id`);--> statement-breakpoint
CREATE INDEX `idx_topics_topic` ON `interaction_topics` (`topic`);--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`interaction_type` text NOT NULL,
	`direction` text NOT NULL,
	`from_contact_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`source` text NOT NULL,
	`source_interaction_id` text NOT NULL,
	`is_indexed` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_interactions_conversation` ON `interactions` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_interactions_occurred_at` ON `interactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_interactions_from_contact` ON `interactions` (`from_contact_id`);--> statement-breakpoint
CREATE INDEX `idx_interactions_indexed` ON `interactions` (`is_indexed`);--> statement-breakpoint
CREATE INDEX `idx_interactions_source_interaction` ON `interactions` (`source`,`source_interaction_id`);--> statement-breakpoint
CREATE TABLE `location_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`location_name` text,
	`shared_by_contact_id` text NOT NULL,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`interaction_id` text PRIMARY KEY NOT NULL,
	`meeting_title` text NOT NULL,
	`location` text,
	`duration_minutes` integer,
	`attendees_count` integer,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`interaction_id` text PRIMARY KEY NOT NULL,
	`content` text,
	`content_type` text DEFAULT 'text' NOT NULL,
	`media_url` text,
	`media_mime_type` text,
	`quoted_interaction_id` text,
	`forwarded_from_contact_id` text,
	`reaction_emoji` text,
	`is_starred` integer DEFAULT false,
	`edited_at` integer,
	`deleted_at` integer,
	`raw_metadata` text,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quoted_interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`forwarded_from_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_quoted` ON `messages` (`quoted_interaction_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_starred` ON `messages` (`is_starred`);--> statement-breakpoint
CREATE TABLE `milestone_events` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`description` text,
	`linked_interaction_id` text,
	`is_auto_detected` integer DEFAULT false,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`option_text` text NOT NULL,
	`vote_count` integer DEFAULT 0,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`poll_option_id` text NOT NULL,
	`voter_contact_id` text NOT NULL,
	`voted_at` integer DEFAULT (unixepoch()),
	PRIMARY KEY(`poll_option_id`, `voter_contact_id`),
	FOREIGN KEY (`poll_option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`question` text NOT NULL,
	`created_by_contact_id` text NOT NULL,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relationship_health_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`snapshot_date` integer NOT NULL,
	`health_score` integer NOT NULL,
	`factors` text NOT NULL,
	`alerts` text,
	`calculated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_health_relationship_date` ON `relationship_health_snapshots` (`relationship_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `relationship_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`insight_type` text NOT NULL,
	`insight_data` text NOT NULL,
	`generated_at` integer DEFAULT (unixepoch()),
	`valid_until` integer,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_insights_relationship` ON `relationship_insights` (`relationship_id`);--> statement-breakpoint
CREATE INDEX `idx_insights_type` ON `relationship_insights` (`insight_type`);--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`strength_score` integer DEFAULT 0,
	`last_interaction_at` integer,
	`first_interaction_at` integer,
	`interaction_count` integer DEFAULT 0,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_relationships_contact` ON `relationships` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_relationships_last_interaction` ON `relationships` (`last_interaction_at`);--> statement-breakpoint
CREATE TABLE `response_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_id` text NOT NULL,
	`avg_response_time_minutes` integer,
	`avg_your_response_time_minutes` integer,
	`response_time_variance` real,
	`calculated_at` integer DEFAULT (unixepoch()),
	`sample_size` integer NOT NULL,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`cursor` text,
	`last_sync_at` integer,
	`last_sync_status` text,
	`error_message` text
);
