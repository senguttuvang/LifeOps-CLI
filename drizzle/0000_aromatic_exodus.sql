CREATE TABLE `relationship_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`last_analysis_at` integer,
	`mood_score` integer,
	`notes` text,
	FOREIGN KEY (`chat_id`) REFERENCES `whatsapp_chats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `whatsapp_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`is_group` integer NOT NULL,
	`unread_count` integer DEFAULT 0,
	`last_message_at` integer,
	`participant_count` integer DEFAULT 0,
	`archived` integer DEFAULT false,
	`pinned` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_chats_last_message` ON `whatsapp_chats` (`last_message_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`from_me` integer NOT NULL,
	`content` text,
	`message_type` text,
	`timestamp` integer NOT NULL,
	`media_url` text,
	`media_key` text,
	`media_mime_type` text,
	`raw_json` text,
	`is_indexed` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`chat_id`) REFERENCES `whatsapp_chats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_chat` ON `whatsapp_messages` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_timestamp` ON `whatsapp_messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_messages_indexed` ON `whatsapp_messages` (`is_indexed`);--> statement-breakpoint
CREATE TABLE `whatsapp_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`last_sync_at` integer
);
