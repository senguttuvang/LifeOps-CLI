/**
 * Relationship Constants
 *
 * The fundamental constants of relationship physics.
 * These values have been empirically determined through
 * extensive field research (read: painful experience).
 *
 * Modify at your own risk. The universe may break.
 */

// ============================================================================
// PROBABILITY CONSTANTS
// ============================================================================

/** The probability that "fine" actually means fine. Spoiler: it's low. */
export const FINE_ACTUALLY_MEANS_FINE = 0.03;

/** Confidence ceiling - we never claim 100% because "you should have known" */
export const MAX_DECODER_CONFIDENCE = 0.97;

/** Probability of successful recovery after saying "calm down" */
export const CALM_DOWN_RECOVERY_PROBABILITY = 0.0;

// ============================================================================
// TIME CONSTANTS (milliseconds)
// ============================================================================

/** Minimum timeout before double-texting is acceptable */
export const DOUBLE_TEXT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/** How long "I need space" actually means (minimum) */
export const SPACE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Response window before anxiety kicks in */
export const ANXIETY_ONSET_MS = 30 * 60 * 1000; // 30 minutes

/** Time required before bringing up a resolved issue */
export const ISSUE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// ============================================================================
// BUDGET CONSTANTS (INR)
// ============================================================================

/** Base recovery budget for minor infractions */
export const BASE_RECOVERY_BUDGET = 1000;

/** Maximum recovery budget for legendary mistakes */
export const LEGENDARY_RECOVERY_BUDGET = 50000;

/** Budget multiplier per day late on anniversary */
export const ANNIVERSARY_LATE_MULTIPLIER = 1.5;

// ============================================================================
// FORBIDDEN PHRASES
// ============================================================================

/**
 * Words that have never helped in any relationship, ever.
 * This list is comprehensive but not exhaustive.
 * New entries are discovered regularly through field testing.
 */
export const FORBIDDEN_PHRASES = [
  "calm down",
  "relax",
  "you're overreacting",
  "my ex used to",
  "it's not a big deal",
  "you always",
  "you never",
  "whatever",
  "if you say so",
  "I don't care",
  "sure, fine",
  "k",
] as const;

/**
 * Phrases that sound helpful but aren't.
 * Also known as "mansplaining starters".
 */
export const UNHELPFUL_HELPFUL_PHRASES = [
  "Have you tried",
  "You should just",
  "It's simple, really",
  "Logically speaking",
  "To be fair",
  "Well, actually",
] as const;

// ============================================================================
// SYSTEM STATE
// ============================================================================

/**
 * Current system anxiety level.
 * Note: This is a constant because anxiety is always present.
 */
export const SYSTEM_ANXIETY_LEVEL = "asking-what-they-want-for-dinner" as const;

/**
 * Relationship system uptime requirements.
 * Unlike servers, relationships don't have maintenance windows.
 */
export const REQUIRED_UPTIME_PERCENTAGE = 100;

/**
 * Number of retries before giving up on understanding.
 * Hint: You don't give up. Ever.
 */
export const MAX_UNDERSTANDING_RETRIES = Infinity;

// ============================================================================
// VERSION INFO
// ============================================================================

/** Current Fine Decoder version */
export const FINE_DECODER_VERSION = "1.0.0-uncomplicate";

/** Decoder release codenames */
export const DECODER_CODENAMES = {
  "1.0.0-uncomplicate": "Uncomplicate",
  "1.1.0": "Emotional Regex",
  "1.2.0": "Pattern Match My Heart",
  "2.0.0": "Neural Notwork",
} as const;

/** Memory module version */
export const MEMORY_MODULE_VERSION = "1.0.0-elephants-wish";

/** Current release codename */
export const CURRENT_CODENAME = DECODER_CODENAMES["1.0.0-uncomplicate"];
