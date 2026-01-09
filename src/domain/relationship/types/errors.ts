/**
 * Relationship Error Types
 *
 * Tagged error classes for relationship operations.
 * Using Effect's Data.TaggedError for type-safe error handling.
 *
 * These are real, functional errors with helpful recovery information.
 * The humor is in the naming and documentation.
 *
 * Note: Unlike production errors, these cannot be silently swallowed.
 * They must be acknowledged and handled with emotional intelligence.
 *
 * @version 1.0.0-uncomplicate
 */

import { Data } from "effect";

/**
 * When you forgot an important date.
 *
 * Recovery difficulty increases exponentially with:
 * - Days late
 * - Importance of the occasion
 * - Whether you remembered last year
 */
export class ForgotAnniversaryError extends Data.TaggedError("Relationship/ForgotAnniversaryError")<{
  readonly date: Date;
  readonly type: "dating" | "first-kiss" | "first-date" | "monthly" | "yearly" | "wedding";
  readonly daysLate: number;
  readonly recoveryDifficulty: "high" | "extreme" | "legendary";
  readonly suggestedBudget: number;
}> {
  override get message(): string {
    return (
      `Anniversary forgotten: ${this.type} (${this.daysLate} days late). ` +
      `Recovery difficulty: ${this.recoveryDifficulty}. ` +
      `Suggested recovery budget: Rs ${this.suggestedBudget}`
    );
  }

  /**
   * Calculate recovery budget based on severity.
   * Formula: base * (1.5 ^ daysLate) * typeMutiplier
   */
  static calculateBudget(daysLate: number, type: string): number {
    const base = 1000;
    const typeMultipliers: Record<string, number> = {
      dating: 1,
      "first-kiss": 1.2,
      "first-date": 1.3,
      monthly: 0.5,
      yearly: 2,
      wedding: 5,
    };
    const multiplier = typeMultipliers[type] ?? 1;
    return Math.round(base * 1.5 ** Math.min(daysLate, 7) * multiplier);
  }
}

/**
 * When you said "calm down" or equivalent.
 *
 * This error is intentionally marked as non-recoverable through normal means.
 * Extended cooling-off period required.
 */
export class SaidCalmDownError extends Data.TaggedError("Relationship/SaidCalmDownError")<{
  readonly context: string;
  readonly wordsUsed: readonly string[];
  readonly timestamp: Date;
}> {
  /** This field exists to remind you: this error is not easily fixed */
  readonly recoverable = false as const;

  /** Minimum cooling-off period in milliseconds (2 hours) */
  readonly minimumCooldownMs = 2 * 60 * 60 * 1000;

  override get message(): string {
    return (
      `FATAL: Said "${this.wordsUsed.join(" ")}" at ${this.timestamp.toISOString()}. ` +
      `This error is not recoverable through normal means. ` +
      `Consider: flowers, extended silence, and time.`
    );
  }

  /**
   * Phrases that trigger this error.
   * Comprehensive but not exhaustive.
   */
  static readonly TRIGGER_PHRASES = [
    "calm down",
    "relax",
    "you're overreacting",
    "it's not a big deal",
    "why are you so",
    "you always",
    "you never",
    "my ex used to",
    "your mom",
    "whatever",
  ] as const;

  /** Recovery guide - memorize this */
  static readonly RECOVERY_GUIDE = "Step 1: Stop talking. Step 2: Keep not talking. Step 3: Flowers." as const;

  /** Time estimate - spoiler: it's long */
  static readonly ESTIMATED_RECOVERY = "Unknown. Check back in a week." as const;
}

/**
 * When your message was read but not replied to.
 *
 * Anxiety level correlates with time elapsed and message importance.
 */
export class LeftOnReadError extends Data.TaggedError("Relationship/LeftOnReadError")<{
  readonly messageContent: string;
  readonly readAt: Date;
  readonly stillWaiting: boolean;
  readonly anxietyLevel: 1 | 2 | 3 | 4 | 5;
}> {
  override get message(): string {
    const duration = Date.now() - this.readAt.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    return (
      `Message read ${hours}h ago. No response. Anxiety level: ${this.anxietyLevel}/5. ` +
      `Recommendation: Do NOT double text. Yet.`
    );
  }

  /**
   * Should you double text?
   * Usually no. But this provides guidance.
   */
  get canDoubleText(): boolean {
    const hoursWaited = (Date.now() - this.readAt.getTime()) / (1000 * 60 * 60);
    return hoursWaited >= 4 && this.anxietyLevel <= 3;
  }
}

/**
 * When you compared your partner to someone else.
 *
 * Even favorable comparisons are dangerous.
 * The only winning move is not to play.
 */
export class ComparedToExError extends Data.TaggedError("Relationship/ComparedToExError")<{
  readonly comparisonType: "favorable" | "unfavorable" | "neutral";
  readonly comparedTo: "ex" | "friend" | "celebrity" | "family-member" | "colleague";
  readonly context: string;
}> {
  readonly severity = "nuclear" as const;

  override get message(): string {
    return (
      `Comparison to ${this.comparedTo} detected (${this.comparisonType}). ` +
      `Severity: ${this.severity}. All comparisons are inadvisable. ` +
      `The only winning move is not to play.`
    );
  }
}

/**
 * When you tried to solve instead of just listening.
 *
 * Sometimes people just want to be heard.
 * This error reminds you to ask first.
 */
export class TriedToFixError extends Data.TaggedError("Relationship/TriedToFixError")<{
  readonly topic: string;
  readonly solutionsOffered: number;
  readonly wasAskedForSolution: boolean;
}> {
  override get message(): string {
    return (
      `Offered ${this.solutionsOffered} solutions for "${this.topic}" ` +
      `but solution was ${this.wasAskedForSolution ? "" : "NOT "}requested. ` +
      `Consider: "That sounds really hard" instead of "You should just..."`
    );
  }

  /** The magic question to ask before offering solutions */
  static readonly ASK_FIRST = "Do you want me to help fix this, or do you just want me to listen?" as const;

  /** What to say instead of solutions */
  static readonly SAFE_RESPONSES = [
    "That sounds really hard.",
    "I'm sorry you're going through this.",
    "That must be frustrating.",
    "I'm here for you.",
  ] as const;
}

/**
 * When you used logic to explain why their feelings are wrong.
 *
 * Feelings don't follow logic. That's kind of the point.
 */
export class UsedLogicOnFeelingsError extends Data.TaggedError("Relationship/UsedLogicOnFeelingsError")<{
  readonly argumentMade: string;
  readonly wasLogicallySound: boolean;
  readonly wasEmotionallyHelpful: boolean;
}> {
  override get message(): string {
    return (
      `Argument "${this.argumentMade}" was ` +
      `logically ${this.wasLogicallySound ? "sound" : "unsound"} but ` +
      `emotionally ${this.wasEmotionallyHelpful ? "helpful" : "useless"}. ` +
      `Feelings don't have to make sense. Validate first, discuss later.`
    );
  }

  /** The fundamental theorem of emotional arguments */
  static readonly THEOREM = "Being right ≠ Being helpful" as const;

  /** Remember: feelings are not bugs to be fixed */
  static readonly REMINDER = "Feelings are features, not bugs." as const;
}

/**
 * Aggregate type for all relationship errors.
 * Use with Effect's error channel for exhaustive handling.
 */
export type RelationshipError =
  | ForgotAnniversaryError
  | SaidCalmDownError
  | LeftOnReadError
  | ComparedToExError
  | TriedToFixError
  | UsedLogicOnFeelingsError;

/**
 * Recovery time estimation for each error type.
 * Returns milliseconds.
 */
export const estimateRecoveryTime = (error: RelationshipError): number => {
  switch (error._tag) {
    case "Relationship/ForgotAnniversaryError":
      return error.daysLate * 2 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000;
    case "Relationship/SaidCalmDownError":
      return 7 * 24 * 60 * 60 * 1000; // Minimum 1 week
    case "Relationship/LeftOnReadError":
      return error.anxietyLevel * 2 * 60 * 60 * 1000;
    case "Relationship/ComparedToExError":
      return 14 * 24 * 60 * 60 * 1000; // 2 weeks
    case "Relationship/TriedToFixError":
      return error.wasAskedForSolution ? 0 : 4 * 60 * 60 * 1000;
    case "Relationship/UsedLogicOnFeelingsError":
      return 24 * 60 * 60 * 1000; // 1 day
  }
};
