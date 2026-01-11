/**
 * Communications Schema - Conversations and Events
 *
 * Unified communication model across all channels.
 * Uses Class Table Inheritance for event subtypes.
 */

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { channels } from "./channels";
import { parties } from "./parties";

// =============================================================================
// CONVERSATIONS
// =============================================================================

/**
 * Conversations - Communication threads across channels
 *
 * Represents 1:1 chats, group chats, email threads, etc.
 */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(), // UUID
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    externalId: text("external_id").notNull(), // Channel's conversation ID
    conversationType: text("conversation_type", {
      enum: ["direct", "group", "broadcast", "thread"],
    })
      .notNull()
      .default("direct"),
    title: text("title"), // Group name, email subject
    description: text("description"),
    isArchived: integer("is_archived", { mode: "boolean" }).default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    channelExternalIdx: index("idx_conversations_channel_external").on(table.channelId, table.externalId),
    lastActivityIdx: index("idx_conversations_last_activity").on(table.lastActivityAt),
    typeIdx: index("idx_conversations_type").on(table.conversationType),
  }),
);

// =============================================================================
// CONVERSATION PARTICIPANTS
// =============================================================================

/**
 * Conversation Participants - Who is in each conversation
 */
export const conversationParticipants = sqliteTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["member", "admin", "owner"] }).default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
    leftAt: integer("left_at", { mode: "timestamp" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.partyId] }),
    conversationIdx: index("idx_conversation_participants_conversation").on(table.conversationId),
    partyIdx: index("idx_conversation_participants_party").on(table.partyId),
  }),
);

// =============================================================================
// COMMUNICATION EVENTS (Base - Class Table Inheritance)
// =============================================================================

/**
 * Communication Events - All touchpoints (messages, calls, meetings)
 *
 * Base table for polymorphic events. Subtypes in separate tables.
 */
export const communicationEvents = sqliteTable(
  "communication_events",
  {
    id: text("id").primaryKey(), // UUID
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: ["message", "call", "meeting", "reaction", "system"],
    }).notNull(),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    fromPartyId: text("from_party_id")
      .notNull()
      .references(() => parties.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    externalId: text("external_id").notNull(), // Channel's event ID
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    isIndexed: integer("is_indexed", { mode: "boolean" }).default(false), // RAG indexed
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    conversationIdx: index("idx_communication_events_conversation").on(table.conversationId),
    occurredAtIdx: index("idx_communication_events_occurred_at").on(table.occurredAt),
    fromPartyIdx: index("idx_communication_events_from_party").on(table.fromPartyId),
    channelExternalIdx: index("idx_communication_events_channel_external").on(table.channelId, table.externalId),
    typeIdx: index("idx_communication_events_type").on(table.eventType),
    indexedIdx: index("idx_communication_events_indexed").on(table.isIndexed),
  }),
);

// =============================================================================
// MESSAGES (Subtype)
// =============================================================================

/**
 * Messages - Text and media messages
 */
export const messages = sqliteTable(
  "messages",
  {
    eventId: text("event_id")
      .primaryKey()
      .references(() => communicationEvents.id, { onDelete: "cascade" }),
    content: text("content"),
    contentType: text("content_type", {
      enum: ["text", "image", "video", "audio", "document", "sticker", "location", "contact"],
    })
      .notNull()
      .default("text"),
    mediaUrl: text("media_url"),
    mediaMimeType: text("media_mime_type"),
    quotedEventId: text("quoted_event_id").references(() => communicationEvents.id),
    forwardedFromPartyId: text("forwarded_from_party_id").references(() => parties.id),
    reactionEmoji: text("reaction_emoji"),
    isStarred: integer("is_starred", { mode: "boolean" }).default(false),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    rawMetadata: text("raw_metadata"), // JSON - original source data
  },
  (table) => ({
    quotedIdx: index("idx_messages_quoted").on(table.quotedEventId),
    starredIdx: index("idx_messages_starred").on(table.isStarred),
    contentTypeIdx: index("idx_messages_content_type").on(table.contentType),
  }),
);

// =============================================================================
// CALLS (Subtype)
// =============================================================================

/**
 * Calls - Voice and video calls
 */
export const calls = sqliteTable("calls", {
  eventId: text("event_id")
    .primaryKey()
    .references(() => communicationEvents.id, { onDelete: "cascade" }),
  callType: text("call_type", { enum: ["voice", "video"] }).notNull(),
  durationSeconds: integer("duration_seconds"),
  callStatus: text("call_status", {
    enum: ["completed", "missed", "declined", "failed", "ongoing"],
  }).notNull(),
  participantsCount: integer("participants_count").default(2),
});

// =============================================================================
// MEETINGS (Subtype)
// =============================================================================

/**
 * Meetings - Calendar events
 */
export const meetings = sqliteTable("meetings", {
  eventId: text("event_id")
    .primaryKey()
    .references(() => communicationEvents.id, { onDelete: "cascade" }),
  meetingTitle: text("meeting_title").notNull(),
  location: text("location"),
  durationMinutes: integer("duration_minutes"),
  attendeesCount: integer("attendees_count"),
  meetingUrl: text("meeting_url"), // Zoom/Meet link
  calendarEventId: text("calendar_event_id"), // External calendar ID
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
export type CommunicationEvent = typeof communicationEvents.$inferSelect;
export type NewCommunicationEvent = typeof communicationEvents.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
