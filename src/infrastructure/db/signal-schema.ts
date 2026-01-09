/**
 * User Signals Schema - Behavioral Pattern Storage
 *
 * Stores extracted behavioral signals for RAG+Signals personalization.
 * Enables 75-80% style matching (vs 60-70% basic RAG).
 *
 * Signal Types:
 * - Response patterns: Timing, initiation rate
 * - Message structure: Length, word count, variance
 * - Expression style: Emoji usage, position, favorites
 * - Punctuation: Exclamation, question, period, ellipsis rates
 * - Common patterns: Greetings, endings, phrases, filler words
 * - Behavioral: Follow-up questions, voice notes, multi-send
 * - Temporal: Active hours, weekend vs weekday patterns
 *
 * Related: docs/implementation-plan-rag-signals.md
 */

import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { contacts } from "./schema";

/**
 * User Signals - Extracted behavioral patterns for personalization
 *
 * One row per contact. Signals are computed from historical message data
 * and used to enforce style consistency in AI-generated drafts.
 *
 * Computation: Run extract-signals CLI command or auto-refresh on draft generation.
 * Usage: Signal-aware prompt builder + post-processing enforcement.
 */
export const userSignals = sqliteTable(
  "user_signals",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => contacts.id, { onDelete: "cascade" }),

    // =========================================================================
    // RESPONSE PATTERNS
    // =========================================================================

    /** Average response time in minutes */
    avgResponseTimeMinutes: real("avg_response_time_minutes"),

    /** Median (p50) response time in minutes */
    responseTimeP50: real("response_time_p50"),

    /** 95th percentile response time in minutes */
    responseTimeP95: real("response_time_p95"),

    /** Rate at which user initiates conversations (0-1) */
    initiationRate: real("initiation_rate"),

    // =========================================================================
    // MESSAGE STRUCTURE
    // =========================================================================

    /** Average message length in characters */
    avgMessageLength: real("avg_message_length"),

    /** Standard deviation of message length */
    messageLengthStd: real("message_length_std"),

    /** Median message length in characters */
    medianMessageLength: real("median_message_length"),

    /** Average words per message */
    avgWordsPerMessage: real("avg_words_per_message"),

    // =========================================================================
    // EXPRESSION STYLE (EMOJIS)
    // =========================================================================

    /** Average emojis per message */
    emojiPerMessage: real("emoji_per_message"),

    /** Variance in emoji usage */
    emojiVariance: real("emoji_variance"),

    /** Top emojis with frequencies - JSON: [{"emoji": "❤️", "freq": 0.4}, ...] */
    topEmojis: text("top_emojis"),

    /** Emoji position preference - JSON: {"start": 0.1, "middle": 0.2, "end": 0.7} */
    emojiPosition: text("emoji_position"),

    // =========================================================================
    // PUNCTUATION PATTERNS
    // =========================================================================

    /** Percentage of messages with exclamation marks (0-1) */
    exclamationRate: real("exclamation_rate"),

    /** Percentage of messages with question marks (0-1) */
    questionRate: real("question_rate"),

    /** Percentage of messages with periods (0-1) */
    periodRate: real("period_rate"),

    /** Percentage of messages with ellipsis (0-1) */
    ellipsisRate: real("ellipsis_rate"),

    // =========================================================================
    // COMMON PATTERNS (PHRASES)
    // =========================================================================

    /** Common greetings - JSON: ["hey jaan", "hey love", ...] */
    commonGreetings: text("common_greetings"),

    /** Common endings - JSON: ["❤️", "love you", ...] */
    commonEndings: text("common_endings"),

    /** Common phrases with frequencies - JSON: [{"phrase": "want to talk", "freq": 0.3}, ...] */
    commonPhrases: text("common_phrases"),

    /** Filler words - JSON: ["like", "just", "basically", ...] */
    fillerWords: text("filler_words"),

    // =========================================================================
    // BEHAVIORAL PATTERNS
    // =========================================================================

    /** Percentage of messages that ask follow-up questions (0-1) */
    asksFollowupQuestions: real("asks_followup_questions"),

    /** Percentage of voice notes vs text messages (0-1) */
    usesVoiceNotes: real("uses_voice_notes"),

    /** Percentage of times user sends 2+ messages in a row (0-1) */
    sendsMultipleMessages: real("sends_multiple_messages"),

    /** Percentage of messages that were edited (0-1) */
    editsMessages: real("edits_messages"),

    // =========================================================================
    // TEMPORAL PATTERNS
    // =========================================================================

    /** Active hours - JSON: {"peak": [18, 22], "low": [2, 6]} */
    activeHours: text("active_hours"),

    /** Communication difference between weekends and weekdays (ratio) */
    weekendVsWeekdayDiff: real("weekend_vs_weekday_diff"),

    // =========================================================================
    // QUALITY METRICS
    // =========================================================================

    /** Total messages analyzed for signal extraction */
    messageCount: integer("message_count").notNull().default(0),

    /** Confidence score (0-1) based on sample size and quality */
    confidence: real("confidence").notNull().default(0),

    /** Timestamp of last signal computation */
    lastComputedAt: integer("last_computed_at", { mode: "timestamp" }).default(sql`(unixepoch())`),

    // =========================================================================
    // METADATA
    // =========================================================================

    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_signals_user_id").on(table.userId),
    confidenceIdx: index("idx_signals_confidence").on(table.confidence),
    lastComputedIdx: index("idx_signals_last_computed").on(table.lastComputedAt),
  }),
);

/**
 * Type inference for userSignals table
 */
export type UserSignal = typeof userSignals.$inferSelect;
export type NewUserSignal = typeof userSignals.$inferInsert;
