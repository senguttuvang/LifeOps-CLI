/**
 * LifeOps Database Schema v2 - Domain-Driven Design
 *
 * IMPORTANT: This is the new schema (2026-01-04) that replaces WhatsApp-coupled v1.
 *
 * Key Principles:
 * - Source-agnostic entities (contacts, conversations, interactions)
 * - Anti-corruption layer (contact_identifiers, source fields)
 * - Polymorphic interactions (base table + subtypes)
 * - Proper domain modeling (relationships, not protocols)
 *
 * Migration: See src/cli/commands/migrate.command.ts
 * ADR: docs/adr/003-domain-model-redesign.md
 */

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

// =============================================================================
// CORE PEOPLE DOMAIN
// =============================================================================

/**
 * Contacts - People, businesses, or groups across all channels
 *
 * Domain entity representing a person, not a WhatsApp user or email address.
 * External identifiers (WhatsApp JID, email, phone) stored in contact_identifiers.
 */
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(), // UUID generated
  displayName: text('display_name').notNull(),
  preferredName: text('preferred_name'), // Nickname, short name
  type: text('type', { enum: ['person', 'business', 'group'] }).notNull().default('person'),
  notes: text('notes'), // User-written notes
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

/**
 * Contact Identifiers - Anti-Corruption Layer
 *
 * Maps external identities (WhatsApp JID, email, phone) to domain Contact entity.
 * Protects domain from external ID format changes.
 *
 * Example:
 *   contact_id: uuid-abc-123
 *   source: 'whatsapp'
 *   identifier: '919876543210' (normalized from JID)
 */
export const contactIdentifiers = sqliteTable(
  'contact_identifiers',
  {
    id: text('id').primaryKey(), // UUID
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['whatsapp', 'email', 'phone', 'telegram', 'linkedin'] }).notNull(),
    identifier: text('identifier').notNull(), // External ID (normalized)
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    verifiedAt: integer('verified_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    sourceIdentifierIdx: index('idx_contact_identifiers_source_identifier').on(table.source, table.identifier),
    contactIdx: index('idx_contact_identifiers_contact').on(table.contactId),
  })
);

/**
 * Relationships - Analyzed relationship metadata
 *
 * Stores computed relationship insights (not raw interactions).
 * Think "contact profile" in Salesforce or "account health" in HubSpot.
 */
export const relationships = sqliteTable(
  'relationships',
  {
    id: text('id').primaryKey(), // UUID
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    relationshipType: text('relationship_type', {
      enum: ['partner', 'family', 'friend', 'colleague', 'acquaintance']
    }).notNull(),

    // Computed metrics (denormalized for performance)
    strengthScore: integer('strength_score').default(0), // 0-100
    lastInteractionAt: integer('last_interaction_at', { mode: 'timestamp' }),
    firstInteractionAt: integer('first_interaction_at', { mode: 'timestamp' }),
    interactionCount: integer('interaction_count').default(0), // Cache

    // User annotations
    notes: text('notes'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    contactIdx: index('idx_relationships_contact').on(table.contactId),
    lastInteractionIdx: index('idx_relationships_last_interaction').on(table.lastInteractionAt),
  })
);

// =============================================================================
// COMMUNICATION DOMAIN
// =============================================================================

/**
 * Conversations - Communication threads across all channels
 *
 * Represents a 1:1 chat, group chat, email thread, etc.
 * Source-agnostic: works for WhatsApp, Email, SMS, Telegram.
 */
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(), // UUID
    title: text('title'), // Group name, email subject, null for 1:1
    conversationType: text('conversation_type', {
      enum: ['1:1', 'group', 'broadcast']
    }).notNull().default('1:1'),

    // Anti-corruption: track origin without coupling
    source: text('source', { enum: ['whatsapp', 'email', 'sms', 'telegram'] }).notNull(),
    sourceConversationId: text('source_conversation_id').notNull(), // External chat ID (JID, thread ID)

    // Metadata
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
  },
  (table) => ({
    sourceConversationIdx: index('idx_conversations_source_conversation')
      .on(table.source, table.sourceConversationId),
    lastActivityIdx: index('idx_conversations_last_activity').on(table.lastActivityAt),
  })
);

/**
 * Conversation Participants - Group membership
 *
 * Who is in this conversation? Supports group chats, email threads, etc.
 */
export const conversationParticipants = sqliteTable(
  'conversation_participants',
  {
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['member', 'admin', 'owner'] }),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
    leftAt: integer('left_at', { mode: 'timestamp' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.contactId] }),
    conversationIdx: index('idx_participants_conversation').on(table.conversationId),
    contactIdx: index('idx_participants_contact').on(table.contactId),
  })
);

// =============================================================================
// INTERACTIONS DOMAIN (Polymorphic Base)
// =============================================================================

/**
 * Interactions - All touchpoints (messages, calls, meetings)
 *
 * Polymorphic base table using Class Table Inheritance pattern.
 * Subtables: messages, calls, meetings (share this ID as FK).
 *
 * Enables: "Show me all interactions with Priya" across channels.
 */
export const interactions = sqliteTable(
  'interactions',
  {
    id: text('id').primaryKey(), // UUID
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    interactionType: text('interaction_type', {
      enum: ['message', 'call', 'meeting', 'email']
    }).notNull(),
    direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
    fromContactId: text('from_contact_id').notNull().references(() => contacts.id),

    occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),

    // Anti-corruption: track origin
    source: text('source', { enum: ['whatsapp', 'email', 'phone', 'telegram', 'calendar'] }).notNull(),
    sourceInteractionId: text('source_interaction_id').notNull(), // External message/call ID

    // RAG status
    isIndexed: integer('is_indexed', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    conversationIdx: index('idx_interactions_conversation').on(table.conversationId),
    occurredAtIdx: index('idx_interactions_occurred_at').on(table.occurredAt),
    fromContactIdx: index('idx_interactions_from_contact').on(table.fromContactId),
    indexedIdx: index('idx_interactions_indexed').on(table.isIndexed),
    sourceInteractionIdx: index('idx_interactions_source_interaction')
      .on(table.source, table.sourceInteractionId),
  })
);

// =============================================================================
// INTERACTION SUBTYPES (Class Table Inheritance)
// =============================================================================

/**
 * Messages - Text and media messages
 *
 * Subtype of interactions (interaction_id is FK to interactions.id).
 * Works for WhatsApp, SMS, Telegram, Email body, etc.
 */
export const messages = sqliteTable(
  'messages',
  {
    interactionId: text('interaction_id').primaryKey().references(() => interactions.id, { onDelete: 'cascade' }),

    // Content
    content: text('content'), // Text (null for media-only)
    contentType: text('content_type', {
      enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact']
    }).notNull().default('text'),

    // Media
    mediaUrl: text('media_url'),
    mediaMimeType: text('media_mime_type'),

    // Engagement
    quotedInteractionId: text('quoted_interaction_id').references(() => interactions.id), // Thread replies
    forwardedFromContactId: text('forwarded_from_contact_id').references(() => contacts.id),
    reactionEmoji: text('reaction_emoji'), // User reactions
    isStarred: integer('is_starred', { mode: 'boolean' }).default(false),

    // Lifecycle
    editedAt: integer('edited_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete

    // Raw source data (for debugging, archival)
    rawMetadata: text('raw_metadata'), // JSON
  },
  (table) => ({
    quotedIdx: index('idx_messages_quoted').on(table.quotedInteractionId),
    starredIdx: index('idx_messages_starred').on(table.isStarred),
  })
);

/**
 * Calls - Voice and video calls
 *
 * Subtype of interactions. High-signal relationship data (calls > texts for closeness).
 */
export const calls = sqliteTable('calls', {
  interactionId: text('interaction_id').primaryKey().references(() => interactions.id, { onDelete: 'cascade' }),

  callType: text('call_type', { enum: ['voice', 'video'] }).notNull(),
  durationSeconds: integer('duration_seconds'), // null if unanswered
  callStatus: text('call_status', {
    enum: ['completed', 'missed', 'declined', 'failed']
  }).notNull(),
  participantsCount: integer('participants_count').default(2), // Group calls
});

/**
 * Meetings - Calendar events (future integration)
 *
 * Subtype of interactions. Google Calendar, Outlook, etc.
 */
export const meetings = sqliteTable('meetings', {
  interactionId: text('interaction_id').primaryKey().references(() => interactions.id, { onDelete: 'cascade' }),

  meetingTitle: text('meeting_title').notNull(),
  location: text('location'),
  durationMinutes: integer('duration_minutes'),
  attendeesCount: integer('attendees_count'),
});

// =============================================================================
// ANALYSIS & INSIGHTS DOMAIN
// =============================================================================

/**
 * Interaction Topics - Extracted themes from RAG
 *
 * Auto-generated from message content using embeddings + clustering.
 * Example: "travel plans", "work stress", "health concern"
 */
export const interactionTopics = sqliteTable(
  'interaction_topics',
  {
    id: text('id').primaryKey(), // UUID
    interactionId: text('interaction_id').notNull().references(() => interactions.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(), // Short label
    confidence: real('confidence').notNull(), // 0-1
    extractedAt: integer('extracted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    interactionIdx: index('idx_topics_interaction').on(table.interactionId),
    topicIdx: index('idx_topics_topic').on(table.topic),
  })
);

/**
 * Relationship Insights - AI-generated analysis
 *
 * Stores computed insights (not re-computed on every query).
 * Example: "Communication frequency declining", "Responds faster on weekends"
 */
export const relationshipInsights = sqliteTable(
  'relationship_insights',
  {
    id: text('id').primaryKey(), // UUID
    relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
    insightType: text('insight_type', {
      enum: ['communication_pattern', 'mood_trend', 'topic_frequency', 'drift_warning']
    }).notNull(),
    insightData: text('insight_data').notNull(), // JSON payload
    generatedAt: integer('generated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    validUntil: integer('valid_until', { mode: 'timestamp' }), // Cache expiration
  },
  (table) => ({
    relationshipIdx: index('idx_insights_relationship').on(table.relationshipId),
    typeIdx: index('idx_insights_type').on(table.insightType),
  })
);

// =============================================================================
// ENGAGEMENT METRICS (Derived Data)
// =============================================================================

/**
 * Communication Streaks - Daily/weekly engagement tracking
 *
 * Gamification + health monitoring. Example: "10-day message streak with girlfriend"
 */
export const communicationStreaks = sqliteTable('communication_streaks', {
  id: text('id').primaryKey(), // UUID
  relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
  streakType: text('streak_type', {
    enum: ['daily_message', 'weekly_call', 'monthly_meetup']
  }).notNull(),
  currentStreakDays: integer('current_streak_days').default(0),
  longestStreakDays: integer('longest_streak_days').default(0),
  lastInteractionAt: integer('last_interaction_at', { mode: 'timestamp' }),
  streakBrokenAt: integer('streak_broken_at', { mode: 'timestamp' }),
});

/**
 * Response Patterns - Communication reciprocity metrics
 *
 * "How fast do they reply to me vs how fast I reply to them?"
 */
export const responsePatterns = sqliteTable('response_patterns', {
  id: text('id').primaryKey(), // UUID
  relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),

  avgResponseTimeMinutes: integer('avg_response_time_minutes'), // Their response to you
  avgYourResponseTimeMinutes: integer('avg_your_response_time_minutes'), // Your response to them
  responseTimeVariance: real('response_time_variance'), // Consistency

  calculatedAt: integer('calculated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  sampleSize: integer('sample_size').notNull(), // How many messages analyzed
});

/**
 * Relationship Health Snapshots - Point-in-time health scores
 *
 * Time-series data for trend analysis. "Is this relationship improving or declining?"
 */
export const relationshipHealthSnapshots = sqliteTable(
  'relationship_health_snapshots',
  {
    id: text('id').primaryKey(), // UUID
    relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
    snapshotDate: integer('snapshot_date', { mode: 'timestamp' }).notNull(),

    healthScore: integer('health_score').notNull(), // 0-100
    factors: text('factors').notNull(), // JSON: { response_time: 80, frequency: 60, ... }
    alerts: text('alerts'), // JSON array: [{ type: 'declining_frequency', severity: 'medium' }]

    calculatedAt: integer('calculated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    relationshipDateIdx: index('idx_health_relationship_date').on(table.relationshipId, table.snapshotDate),
  })
);

// =============================================================================
// SPECIAL EVENTS
// =============================================================================

/**
 * Milestone Events - Important moments in relationships
 *
 * User-curated or auto-detected. Example: first message, birthday, conflict, reconciliation
 */
export const milestoneEvents = sqliteTable('milestone_events', {
  id: text('id').primaryKey(), // UUID
  relationshipId: text('relationship_id').notNull().references(() => relationships.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: ['first_message', 'birthday', 'anniversary', 'conflict', 'reconciliation', 'emergency']
  }).notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  description: text('description'),
  linkedInteractionId: text('linked_interaction_id').references(() => interactions.id),
  isAutoDetected: integer('is_auto_detected', { mode: 'boolean' }).default(false),
});

// =============================================================================
// CONTEXT ENRICHMENT
// =============================================================================

/**
 * Location Shares - Shared locations from messages
 *
 * Safety feature: track travel, detect late-night location shares.
 */
export const locationShares = sqliteTable('location_shares', {
  id: text('id').primaryKey(), // UUID
  interactionId: text('interaction_id').notNull().references(() => interactions.id, { onDelete: 'cascade' }),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  locationName: text('location_name'), // "Home", "Office", extracted place name
  sharedByContactId: text('shared_by_contact_id').notNull().references(() => contacts.id),
});

/**
 * Polls - WhatsApp polls (future: Telegram, Slack polls)
 */
export const polls = sqliteTable('polls', {
  id: text('id').primaryKey(), // UUID
  interactionId: text('interaction_id').notNull().references(() => interactions.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  createdByContactId: text('created_by_contact_id').notNull().references(() => contacts.id),
});

export const pollOptions = sqliteTable('poll_options', {
  id: text('id').primaryKey(), // UUID
  pollId: text('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  voteCount: integer('vote_count').default(0),
});

export const pollVotes = sqliteTable(
  'poll_votes',
  {
    pollOptionId: text('poll_option_id').notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
    voterContactId: text('voter_contact_id').notNull().references(() => contacts.id),
    votedAt: integer('voted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pollOptionId, table.voterContactId] }),
  })
);

// =============================================================================
// SYNC STATE (Per Source)
// =============================================================================

/**
 * Sync State - Track sync progress per data source
 *
 * Enables incremental sync (fetch only new data since last sync).
 */
export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(), // Source name: 'whatsapp', 'email'
  source: text('source', { enum: ['whatsapp', 'email', 'calendar', 'sms'] }).notNull(),
  cursor: text('cursor'), // Pagination cursor
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSyncStatus: text('last_sync_status', { enum: ['success', 'partial', 'failed'] }),
  errorMessage: text('error_message'),
});
