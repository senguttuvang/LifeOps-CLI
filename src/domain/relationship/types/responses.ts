/**
 * Relationship Response Types
 *
 * The fundamental types that every developer in a relationship must understand.
 * These types have been battle-tested across thousands of relationships.
 *
 * Note: These are real types that compile to normal TypeScript.
 * The humor is in the documentation and naming, not in complexity.
 */

/**
 * What "fine" actually means.
 *
 * Determined through advanced NLP analysis of message history,
 * context signals, and the current phase of the moon.
 */
export type DecodedMeaning =
  | "ACTUALLY_FINE" // P(0.03) - Rarer than you'd hope
  | "NOT_FINE_INVESTIGATE" // P(0.45) - Most common
  | "FINAL_WARNING" // P(0.25) - Tread carefully
  | "SHOULD_ALREADY_KNOW" // P(0.20) - Historical context required
  | "TEST_IN_PROGRESS"; // P(0.07) - Your response is being evaluated

/**
 * When she says "It's fine", this is the probability distribution.
 * Based on empirical data (read: painful experience).
 *
 * Your mileage WILL vary. That's the point.
 */
export const FINE_PROBABILITY_DISTRIBUTION: Record<DecodedMeaning, number> = {
  ACTUALLY_FINE: 0.03,
  NOT_FINE_INVESTIGATE: 0.45,
  FINAL_WARNING: 0.25,
  SHOULD_ALREADY_KNOW: 0.2,
  TEST_IN_PROGRESS: 0.07,
} as const;

/**
 * The result of decoding an ambiguous response.
 *
 * Contains the literal text, what it actually means,
 * and actionable intelligence for recovery.
 */
export interface FineResponse {
  /** What was literally said */
  readonly literal: "fine" | "okay" | "nothing" | "whatever" | "k" | "sure";

  /**
   * What was actually meant.
   * Determined through context analysis and pattern matching.
   */
  readonly decoded: DecodedMeaning;

  /**
   * How confident we are in this decoding.
   * Note: Even 99% confidence leaves room for "you should have known" scenarios.
   * Max value is 0.97 because humility is important.
   */
  readonly confidence: number;

  /**
   * Recommended maximum response time in milliseconds.
   * Exceeding this may trigger escalation.
   */
  readonly responseWindowMs: number;

  /**
   * Actions that will definitely make it worse.
   * This list is comprehensive but not exhaustive.
   * New entries are discovered regularly.
   */
  readonly doNotDo: readonly string[];

  /**
   * Suggested recovery actions, sorted by effectiveness.
   */
  readonly suggestedActions: readonly string[];
}

/**
 * Contextual signals that influence decoding.
 *
 * The same "fine" at 11am vs 11pm means very different things.
 */
export interface DecodingContext {
  /** Time of the message */
  readonly timestamp: Date;

  /** Recent message length trend (shorter = concerning) */
  readonly messageLengthTrend: "increasing" | "stable" | "decreasing";

  /** Recent response time trend */
  readonly responseTimeTrend: "faster" | "stable" | "slower";

  /** What happened before this message */
  readonly precedingTopic?: string;

  /** Whether similar messages led to conflict before */
  readonly historicalConflictRate: number;
}

/**
 * Memory categories for the remember command.
 *
 * These help organize things to remember about your partner.
 */
export type MemoryCategory =
  | "gift" // Things they mentioned wanting
  | "preference" // What they like/dislike
  | "date" // Important dates to remember
  | "boundary" // Things NOT to do
  | "context"; // General context/background

/**
 * A captured memory for later retrieval.
 */
export interface Memory {
  readonly id: string;
  readonly content: string;
  readonly category: MemoryCategory;
  readonly mentionedAt: Date;
  readonly source: "manual" | "extracted" | "whatsapp";
  readonly relationshipId?: string;
  readonly tags: readonly string[];
}

/**
 * Situation context for recurring topics.
 *
 * Helps understand patterns in how certain conversations go.
 */
export interface SituationContext {
  readonly topic: string;
  readonly occurrences: readonly SituationOccurrence[];
  readonly patterns: readonly string[];
  readonly whatWorks: readonly string[];
  readonly whatDoesnt: readonly string[];
}

/**
 * A single occurrence of a situation/topic.
 */
export interface SituationOccurrence {
  readonly date: Date;
  readonly summary: string;
  readonly tensionPoints: readonly string[];
  readonly resolution?: string;
  readonly notes?: string;
}

/**
 * Relationship health metrics.
 * Like system monitoring, but for feelings.
 */
export interface RelationshipHealthMetrics {
  /** Overall communication score (0-100) */
  readonly communicationScore: number;

  /** Quality time invested */
  readonly qualityTimeScore: number;

  /** Surprise/thoughtfulness factor (often neglected) */
  readonly surpriseFactor: number;

  /** How accurate your memory is for important things */
  readonly memoryAccuracy: number;

  /** Days without a significant disagreement */
  readonly dramaFreeStreak: number;

  /** Last time metrics were computed */
  readonly lastSync: Date;
}
