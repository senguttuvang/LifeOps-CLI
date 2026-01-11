/**
 * Analytics Schema - Insights, Signals, and AI Analysis
 *
 * Stores computed analytics and AI-generated insights.
 */

import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { communicationEvents } from "./communications";
import { parties } from "./parties";

// =============================================================================
// BEHAVIOR SIGNALS
// =============================================================================

/**
 * Behavior Signals - Per-party communication patterns
 *
 * Extracted patterns for personalization and analysis.
 * One row per party. Computed from message history.
 */
export const behaviorSignals = sqliteTable(
  "behavior_signals",
  {
    id: text("id").primaryKey(), // UUID
    partyId: text("party_id")
      .notNull()
      .unique()
      .references(() => parties.id, { onDelete: "cascade" }),

    // All signal data stored as JSON for flexibility
    signalData: text("signal_data").notNull(), // JSON with all computed patterns

    // Quality metrics
    sampleSize: integer("sample_size").notNull().default(0),
    confidence: real("confidence").notNull().default(0), // 0-1

    computedAt: integer("computed_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    validUntil: integer("valid_until", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    partyIdx: index("idx_behavior_signals_party").on(table.partyId),
    confidenceIdx: index("idx_behavior_signals_confidence").on(table.confidence),
  }),
);

// =============================================================================
// AI INSIGHTS
// =============================================================================

/**
 * AI Insights - Generated analysis, recommendations, forecasts
 *
 * Polymorphic: can be linked to parties, relationships, or conversations.
 */
export const aiInsights = sqliteTable(
  "ai_insights",
  {
    id: text("id").primaryKey(), // UUID
    entityType: text("entity_type", {
      enum: ["party", "relationship", "conversation"],
    }).notNull(),
    entityId: text("entity_id").notNull(), // UUID of the entity

    insightType: text("insight_type", {
      enum: ["pattern", "forecast", "recommendation", "warning", "milestone"],
    }).notNull(),
    insightKey: text("insight_key").notNull(), // "drift_warning", "optimal_time", etc.
    insightData: text("insight_data").notNull(), // JSON with structured insight

    confidence: real("confidence").notNull().default(0), // 0-1
    severity: text("severity", { enum: ["low", "medium", "high"] }),

    modelVersion: text("model_version"), // Which AI model generated
    generatedAt: integer("generated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    validUntil: integer("valid_until", { mode: "timestamp" }),

    isRead: integer("is_read", { mode: "boolean" }).default(false),
    isDismissed: integer("is_dismissed", { mode: "boolean" }).default(false),

    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    entityIdx: index("idx_ai_insights_entity").on(table.entityType, table.entityId),
    typeIdx: index("idx_ai_insights_type").on(table.insightType),
    keyIdx: index("idx_ai_insights_key").on(table.insightKey),
    generatedIdx: index("idx_ai_insights_generated").on(table.generatedAt),
    unreadIdx: index("idx_ai_insights_unread").on(table.isRead, table.isDismissed),
  }),
);

// =============================================================================
// INTERACTION TOPICS
// =============================================================================

/**
 * Interaction Topics - Extracted themes from messages
 *
 * Auto-generated using embeddings + clustering.
 */
export const interactionTopics = sqliteTable(
  "interaction_topics",
  {
    id: text("id").primaryKey(), // UUID
    eventId: text("event_id")
      .notNull()
      .references(() => communicationEvents.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    confidence: real("confidence").notNull(), // 0-1
    extractedAt: integer("extracted_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    eventIdx: index("idx_interaction_topics_event").on(table.eventId),
    topicIdx: index("idx_interaction_topics_topic").on(table.topic),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type BehaviorSignal = typeof behaviorSignals.$inferSelect;
export type NewBehaviorSignal = typeof behaviorSignals.$inferInsert;
export type AiInsight = typeof aiInsights.$inferSelect;
export type NewAiInsight = typeof aiInsights.$inferInsert;
export type InteractionTopic = typeof interactionTopics.$inferSelect;
export type NewInteractionTopic = typeof interactionTopics.$inferInsert;
