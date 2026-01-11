/**
 * Positive/Negative Ratio Analyzer
 *
 * Implements Gottman's "Magic Ratio" tracking:
 * - Healthy relationships: 5 positive for every 1 negative interaction
 * - Happy couples: 86% turn-toward rate
 * - Divorced couples: 33% turn-toward rate
 *
 * @see docs/breakup-forecasting.md
 */

import { Context, Effect, Layer } from "effect";
import type { MessageValence, RatioScore, Valence } from "./types";

// =============================================================================
// SENTIMENT PATTERNS
// =============================================================================

/**
 * Positive sentiment indicators
 */
const POSITIVE_PATTERNS = {
  // Affection
  affection: [
    /\blove you\b/i,
    /\bmiss you\b/i,
    /\bthinking of you\b/i,
    /\bproud of you\b/i,
    /\bcare about you\b/i,
    /\bhere for you\b/i,
  ],

  // Appreciation
  appreciation: [/\bthank(s| you)\b/i, /\bappreciate\b/i, /\bgrateful\b/i, /\blucky to have\b/i, /\bmeans a lot\b/i],

  // Support
  support: [
    /\bi('?m| am) here\b/i,
    /\byou got this\b/i,
    /\bbelieve in you\b/i,
    /\byou can do\b/i,
    /\bwe('?ll| will) (figure|work) (it|this) out\b/i,
    /\bi understand\b/i,
  ],

  // Interest & engagement
  engagement: [
    /\bhow (are|was|did)\b/i,
    /\btell me (more|about)\b/i,
    /\bwhat happened\b/i,
    /\bthat('?s| is) (great|amazing|awesome|wonderful)\b/i,
    /\bi('?m| am) (happy|glad|excited)\b/i,
  ],

  // Humor & playfulness
  humor: [/\bhaha\b/i, /\blol\b/i, /\blmao\b/i, /\b(😂|🤣|😆|😄)\b/, /\bjk\b/i, /\bjust kidding\b/i],

  // Agreement & validation
  validation: [
    /\byou('?re| are) right\b/i,
    /\bi agree\b/i,
    /\bgood (point|idea)\b/i,
    /\bthat makes sense\b/i,
    /\bi see what you mean\b/i,
  ],
};

/**
 * Negative sentiment indicators
 */
const NEGATIVE_PATTERNS = {
  // Frustration
  frustration: [
    /\bi('?m| am) (frustrated|annoyed|irritated)\b/i,
    /\bthis is (frustrating|annoying)\b/i,
    /\bi can('?t| not) (believe|stand)\b/i,
    /\bsick of\b/i,
    /\btired of\b/i,
  ],

  // Anger
  anger: [/\bi('?m| am) (mad|angry|upset)\b/i, /\bstop (it|doing)\b/i, /\bi hate\b/i, /\bpissed off\b/i],

  // Disappointment
  disappointment: [/\bi('?m| am) disappointed\b/i, /\bi expected\b/i, /\blet me down\b/i, /\bi thought you\b/i],

  // Hurt
  hurt: [
    /\bthat hurt\b/i,
    /\bi('?m| am) hurt\b/i,
    /\bthat was mean\b/i,
    /\bhow could you\b/i,
    /\bi can('?t| not) believe you\b/i,
  ],

  // Dismissal
  dismissal: [
    /\bi don('?t| not) care\b/i,
    /\bwhatever\b/i,
    /\bforget it\b/i,
    /\bnevermind\b/i,
    /\bnot (worth|important)\b/i,
  ],

  // Blame
  blame: [/\bit('?s| is) your fault\b/i, /\byou ruined\b/i, /\bbecause of you\b/i, /\byou made this\b/i],
};

/**
 * Positive emojis
 */
const POSITIVE_EMOJIS = new Set([
  "❤️",
  "💕",
  "💗",
  "💖",
  "💝",
  "😍",
  "🥰",
  "😘",
  "😊",
  "😄",
  "😁",
  "🥺",
  "✨",
  "🎉",
  "👏",
  "💪",
  "🙏",
  "❤️‍🔥",
  "💯",
  "🤗",
  "😌",
  "🌹",
  "💐",
  "🤩",
  "😇",
  "💓",
  "💞",
]);

/**
 * Negative emojis
 */
const NEGATIVE_EMOJIS = new Set([
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "💔",
  "😞",
  "😔",
  "😒",
  "😑",
  "🙄",
  "😪",
  "😩",
  "😫",
  "😰",
  "😥",
  "🤬",
  "👎",
]);

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Input message for sentiment analysis
 */
interface MessageInput {
  id: string;
  text: string;
  timestamp: Date;
  fromMe: boolean;
}

/**
 * Service interface for ratio analysis
 */
interface RatioAnalyzer {
  /**
   * Analyze sentiment of a single message
   */
  analyzeMessage(message: MessageInput): Effect.Effect<MessageValence>;

  /**
   * Calculate ratio score from messages
   */
  calculateRatio(messages: MessageInput[], previousScore?: RatioScore): Effect.Effect<RatioScore>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Service tag for dependency injection
 */
export class RatioAnalyzerTag extends Context.Tag("RatioAnalyzer")<RatioAnalyzerTag, RatioAnalyzer>() {}

/**
 * Count pattern matches in text
 */
function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * Count emoji occurrences
 */
function countEmojis(text: string, emojiSet: Set<string>): number {
  let count = 0;
  for (const emoji of emojiSet) {
    if (text.includes(emoji)) {
      count++;
    }
  }
  return count;
}

/**
 * Analyze sentiment of a single message
 */
function analyzeMessage(message: MessageInput): MessageValence {
  if (!message.text || message.text.trim().length === 0) {
    return {
      messageId: message.id,
      valence: "neutral",
      score: 0,
      confidence: 0.5,
      sender: message.fromMe ? "user" : "partner",
    };
  }

  const text = message.text;

  // Count positive signals
  let positiveSignals = 0;
  for (const patterns of Object.values(POSITIVE_PATTERNS)) {
    positiveSignals += countPatternMatches(text, patterns);
  }
  positiveSignals += countEmojis(text, POSITIVE_EMOJIS);

  // Count negative signals
  let negativeSignals = 0;
  for (const patterns of Object.values(NEGATIVE_PATTERNS)) {
    negativeSignals += countPatternMatches(text, patterns);
  }
  negativeSignals += countEmojis(text, NEGATIVE_EMOJIS);

  // Calculate score (-1 to +1)
  const totalSignals = positiveSignals + negativeSignals;
  let score = 0;
  let confidence = 0.5;

  if (totalSignals > 0) {
    score = (positiveSignals - negativeSignals) / totalSignals;
    // Higher signal count = higher confidence
    confidence = Math.min(0.9, 0.5 + totalSignals * 0.1);
  }

  // Determine valence
  let valence: Valence = "neutral";
  if (score > 0.2) {
    valence = "positive";
  } else if (score < -0.2) {
    valence = "negative";
  }

  return {
    messageId: message.id,
    valence,
    score,
    confidence,
    sender: message.fromMe ? "user" : "partner",
  };
}

/**
 * Calculate ratio score from analyzed messages
 */
function calculateRatio(valences: MessageValence[], previousScore?: RatioScore): RatioScore {
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  let userPositive = 0;
  let userTotal = 0;
  let partnerPositive = 0;
  let partnerTotal = 0;

  for (const v of valences) {
    if (v.valence === "positive") {
      positiveCount++;
      if (v.sender === "user") {
        userPositive++;
      } else {
        partnerPositive++;
      }
    } else if (v.valence === "negative") {
      negativeCount++;
    } else {
      neutralCount++;
    }

    if (v.sender === "user") {
      userTotal++;
    } else {
      partnerTotal++;
    }
  }

  // Calculate ratio (avoid division by zero)
  const ratio =
    negativeCount > 0
      ? positiveCount / negativeCount
      : positiveCount > 0
        ? 10 // Cap at 10:1 if no negatives
        : 5; // Default to 5:1 if all neutral

  // Determine status based on Gottman's thresholds
  let status: "healthy" | "borderline" | "danger" = "healthy";
  if (ratio < 2) {
    status = "danger";
  } else if (ratio < 4) {
    status = "borderline";
  }

  // Calculate normalized score (0-100)
  // 5:1 ratio = 100 score
  // 0:1 ratio = 0 score
  const score = Math.min(100, Math.max(0, (ratio / 5) * 100));

  // Calculate trend
  let trend: "improving" | "stable" | "worsening" = "stable";
  let weekOverWeekDelta = 0;

  if (previousScore) {
    weekOverWeekDelta = score - previousScore.score;
    if (weekOverWeekDelta > 5) {
      trend = "improving";
    } else if (weekOverWeekDelta < -5) {
      trend = "worsening";
    }
  }

  // Calculate per-sender positive rates
  const userPositiveRate = userTotal > 0 ? userPositive / userTotal : 0;
  const partnerPositiveRate = partnerTotal > 0 ? partnerPositive / partnerTotal : 0;

  return {
    positiveCount,
    negativeCount,
    neutralCount,
    ratio,
    status,
    score,
    trend,
    weekOverWeekDelta,
    userPositiveRate,
    partnerPositiveRate,
  };
}

// =============================================================================
// LAYER (DEPENDENCY INJECTION)
// =============================================================================

/**
 * Live implementation layer
 */
export const RatioAnalyzerLive = Layer.succeed(
  RatioAnalyzerTag,
  RatioAnalyzerTag.of({
    analyzeMessage: (message: MessageInput) => Effect.sync(() => analyzeMessage(message)),

    calculateRatio: (messages: MessageInput[], previousScore?: RatioScore) =>
      Effect.sync(() => {
        // Analyze all messages
        const valences = messages.map(analyzeMessage);
        return calculateRatio(valences, previousScore);
      }),
  }),
);

// =============================================================================
// EXPORTS
// =============================================================================

export { POSITIVE_PATTERNS, NEGATIVE_PATTERNS, POSITIVE_EMOJIS, NEGATIVE_EMOJIS, analyzeMessage, calculateRatio };
