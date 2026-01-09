/**
 * Four Horsemen Detector Service
 *
 * Detects Gottman's Four Horsemen of relationship apocalypse in messages:
 * - Criticism: Attacking character instead of behavior
 * - Contempt: Superiority, mockery (THE #1 PREDICTOR - weighted 2x)
 * - Defensiveness: Counter-attacks, victimhood
 * - Stonewalling: Withdrawal, shutting down
 *
 * @see docs/breakup-forecasting.md
 */

import { Context, Effect, Layer } from "effect";
import type {
  FourHorsemenScore,
  Horseman,
  HorsemanDetection,
  HorsemanPattern,
} from "./types";

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

/**
 * Criticism patterns - attacking character, not specific behavior
 */
const CRITICISM_PATTERNS: HorsemanPattern = {
  horseman: "criticism",
  patterns: [
    // "You always" / "You never" generalizations
    /\byou always\b/i,
    /\byou never\b/i,

    // Character attacks
    /\bwhat'?s wrong with you\b/i,
    /\bwhy can'?t you\b/i,
    /\byou'?re so (lazy|selfish|stupid|annoying|useless)\b/i,
    /\byou'?re (the worst|impossible|ridiculous)\b/i,

    // Global accusations
    /\bevery single time\b/i,
    /\byou just don'?t care\b/i,
    /\bnothing ever changes\b/i,
    /\byou'?re incapable\b/i,

    // "You should" criticisms
    /\byou should (know|understand|be)\b/i,
  ],
  severity: 3,
  antidote: "Express feelings about specific behavior using 'I feel... about [specific situation]... I need...'",
};

/**
 * Contempt patterns - THE #1 DIVORCE PREDICTOR (weighted 2x)
 * Superiority, mockery, disrespect
 */
const CONTEMPT_PATTERNS: HorsemanPattern = {
  horseman: "contempt",
  patterns: [
    // Dismissive responses
    /\bwhatever\b/i,
    /\bsure\.+$/im, // Dismissive "sure..."
    /\bfine\.+$/im, // Dismissive "fine..."
    /\bright\.+$/im, // Sarcastic "right..."
    /\bif you say so\b/i,
    /\byeah,? right\b/i,

    // Superiority
    /\bi'?m not surprised\b/i,
    /\btypical\b/i,
    /\bof course you (would|did)\b/i,
    /\bthat'?s (so )?(like|typical of) you\b/i,

    // Mockery
    /\boh really\b/i,
    /\bwow,? so (smart|clever|original)\b/i,
    /\bnice (try|one)\b/i,
    /\bgood luck with that\b/i,

    // Name-calling / belittling
    /\bidiot\b/i,
    /\bstupid\b/i,
    /\bpathetic\b/i,
    /\bjoke\b/i, // "You're a joke"
    /\bgrow up\b/i,
    /\bget over (it|yourself)\b/i,
  ],
  severity: 5, // Highest severity
  antidote: "Build a culture of appreciation. Express respect and admiration regularly.",
};

/**
 * Defensiveness patterns - counter-attacks, victimhood
 */
const DEFENSIVENESS_PATTERNS: HorsemanPattern = {
  horseman: "defensiveness",
  patterns: [
    // Victimhood
    /\bit'?s not my fault\b/i,
    /\byou made me\b/i,
    /\bi had no choice\b/i,
    /\bwhat was i supposed to\b/i,
    /\bi didn'?t (do anything|mean to)\b/i,

    // Counter-attacks
    /\bbut you\b/i,
    /\bwhat about when you\b/i,
    /\byou do it too\b/i,
    /\byou'?re one to talk\b/i,
    /\blook who'?s talking\b/i,

    // Deflection
    /\bthat'?s not the point\b/i,
    /\byou'?re overreacting\b/i,
    /\bcalm down\b/i,
    /\bwhy are you making this a big deal\b/i,
    /\byou'?re being (dramatic|crazy|ridiculous)\b/i,

    // Justification without accountability
    /\bi was just\b/i,
    /\bi only\b/i,
  ],
  severity: 3,
  antidote: "Take responsibility for your part in the conflict, even if small. Say 'You're right about...'",
};

/**
 * Stonewalling patterns - withdrawal, shutting down
 * Note: Also detected via response time analysis
 */
const STONEWALLING_PATTERNS: HorsemanPattern = {
  horseman: "stonewalling",
  patterns: [
    // Dismissive short responses
    /^k$/i,
    /^ok\.?$/i,
    /^fine\.?$/i,
    /^sure\.?$/i,
    /^whatever\.?$/i,
    /^idk\.?$/i,
    /^nm\.?$/i,
    /^nothing\.?$/i,

    // Explicit withdrawal
    /\bi don'?t (want to|wanna) (talk|discuss)\b/i,
    /\bleave me alone\b/i,
    /\bi'?m done (talking|discussing)\b/i,
    /\bi (need|want) space\b/i,
    /\bforget it\b/i,
    /\bnever ?mind\b/i,

    // Shutdown signals
    /\bi can'?t (do this|deal)\b/i,
    /\bi give up\b/i,
  ],
  severity: 4,
  antidote: "Take a 20-minute break to calm down physiologically, then return to the conversation.",
};

/**
 * Contempt emojis that indicate eye-roll, dismissiveness
 */
const CONTEMPT_EMOJI_SET = new Set(["🙄", "😒", "🤡", "💀", "😤", "🤮"]);

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Input message for detection
 */
interface MessageInput {
  id: string;
  text: string;
  timestamp: Date;
  fromMe: boolean;
}

/**
 * Service interface for Four Horsemen detection
 */
interface FourHorsemenDetector {
  /**
   * Detect horsemen patterns in a single message
   */
  detectInMessage(message: MessageInput): Effect.Effect<HorsemanDetection[]>;

  /**
   * Analyze a batch of messages and return aggregated score
   */
  analyzeMessages(
    messages: MessageInput[],
    previousScore?: FourHorsemenScore,
  ): Effect.Effect<FourHorsemenScore>;

  /**
   * Get antidote for a specific horseman
   */
  getAntidote(horseman: Horseman): string;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Service tag for dependency injection
 */
export class FourHorsemenDetectorTag extends Context.Tag("FourHorsemenDetector")<
  FourHorsemenDetectorTag,
  FourHorsemenDetector
>() {}

const ALL_PATTERNS: HorsemanPattern[] = [
  CRITICISM_PATTERNS,
  CONTEMPT_PATTERNS,
  DEFENSIVENESS_PATTERNS,
  STONEWALLING_PATTERNS,
];

/**
 * Detect horsemen in a single message
 */
function detectInMessage(message: MessageInput): HorsemanDetection[] {
  if (!message.text || message.text.trim().length === 0) {
    return [];
  }

  const detections: HorsemanDetection[] = [];
  const text = message.text;
  const sender = message.fromMe ? "user" : "partner";

  // Check each pattern category
  for (const patternDef of ALL_PATTERNS) {
    for (const pattern of patternDef.patterns) {
      const match = text.match(pattern);
      if (match) {
        detections.push({
          horseman: patternDef.horseman,
          confidence: calculateConfidence(text, pattern, patternDef.horseman),
          severity: patternDef.severity,
          messageId: message.id,
          excerpt: extractExcerpt(text, match.index ?? 0),
          matchedPattern: pattern.source,
          timestamp: message.timestamp,
          sender,
        });
        // Only one detection per pattern category per message
        break;
      }
    }
  }

  // Check for contempt emojis separately
  for (const emoji of CONTEMPT_EMOJI_SET) {
    if (text.includes(emoji)) {
      detections.push({
        horseman: "contempt",
        confidence: 0.8, // Emoji is fairly clear indicator
        severity: 3,
        messageId: message.id,
        excerpt: extractExcerpt(text, text.indexOf(emoji)),
        matchedPattern: `emoji:${emoji}`,
        timestamp: message.timestamp,
        sender,
      });
      break; // Only one emoji detection per message
    }
  }

  return detections;
}

/**
 * Calculate detection confidence based on context
 */
function calculateConfidence(text: string, pattern: RegExp, horseman: Horseman): number {
  // Base confidence
  let confidence = 0.7;

  // Longer messages with pattern = higher confidence (more context)
  if (text.length > 100) {
    confidence += 0.1;
  }

  // Exclamation marks increase confidence for emotional patterns
  if (horseman !== "stonewalling" && text.includes("!")) {
    confidence += 0.1;
  }

  // Caps increase confidence (yelling)
  const capsRatio = (text.match(/[A-Z]/g)?.length || 0) / text.length;
  if (capsRatio > 0.5) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Extract relevant excerpt around the match
 */
function extractExcerpt(text: string, matchIndex: number): string {
  const contextWindow = 50;
  const start = Math.max(0, matchIndex - contextWindow);
  const end = Math.min(text.length, matchIndex + contextWindow);

  let excerpt = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) excerpt = `...${excerpt}`;
  if (end < text.length) excerpt = `${excerpt}...`;

  return excerpt.trim();
}

/**
 * Calculate aggregated horsemen score from detections
 */
function calculateScore(
  detections: HorsemanDetection[],
  messageCount: number,
  previousScore?: FourHorsemenScore,
): FourHorsemenScore {
  // Count by horseman type
  const counts = {
    criticism: 0,
    contempt: 0,
    defensiveness: 0,
    stonewalling: 0,
  };

  const userCounts = { ...counts };
  const partnerCounts = { ...counts };

  for (const d of detections) {
    counts[d.horseman]++;
    if (d.sender === "user") {
      userCounts[d.horseman]++;
    } else {
      partnerCounts[d.horseman]++;
    }
  }

  // Calculate weighted total (contempt weighted 2x)
  const weightedTotal =
    counts.criticism * 1 +
    counts.contempt * 2 + // CONTEMPT IS THE #1 PREDICTOR
    counts.defensiveness * 1 +
    counts.stonewalling * 1.5;

  // Score: 100 = no horsemen, 0 = high horsemen frequency
  // Normalized per 100 messages
  const normalizedRate = messageCount > 0 ? (weightedTotal / messageCount) * 100 : 0;

  // Convert to 0-100 score (inverse - lower horsemen = higher score)
  // Rate of 0 = 100 score, Rate of 20+ = 0 score
  const score = Math.max(0, Math.min(100, 100 - normalizedRate * 5));

  // Calculate trend if previous score available
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

  // Determine who exhibits more horsemen
  const userTotal = Object.values(userCounts).reduce((a, b) => a + b, 0);
  const partnerTotal = Object.values(partnerCounts).reduce((a, b) => a + b, 0);
  let primaryExhibitor: "user" | "partner" | "balanced" = "balanced";
  if (userTotal > partnerTotal * 1.5) {
    primaryExhibitor = "user";
  } else if (partnerTotal > userTotal * 1.5) {
    primaryExhibitor = "partner";
  }

  // Get most recent detections (last 5)
  const recentDetections = detections
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  return {
    criticismCount: counts.criticism,
    contemptCount: counts.contempt,
    defensivenessCount: counts.defensiveness,
    stonewallingCount: counts.stonewalling,
    score,
    trend,
    weekOverWeekDelta,
    recentDetections,
    primaryExhibitor,
  };
}

/**
 * Get the antidote for a specific horseman
 */
function getAntidote(horseman: Horseman): string {
  const antidotes: Record<Horseman, string> = {
    criticism: CRITICISM_PATTERNS.antidote,
    contempt: CONTEMPT_PATTERNS.antidote,
    defensiveness: DEFENSIVENESS_PATTERNS.antidote,
    stonewalling: STONEWALLING_PATTERNS.antidote,
  };
  return antidotes[horseman];
}

// =============================================================================
// LAYER (DEPENDENCY INJECTION)
// =============================================================================

/**
 * Live implementation layer
 */
export const FourHorsemenDetectorLive = Layer.succeed(
  FourHorsemenDetectorTag,
  FourHorsemenDetectorTag.of({
    detectInMessage: (message: MessageInput) =>
      Effect.sync(() => detectInMessage(message)),

    analyzeMessages: (
      messages: MessageInput[],
      previousScore?: FourHorsemenScore,
    ) =>
      Effect.sync(() => {
        // Detect in all messages
        const allDetections: HorsemanDetection[] = [];
        for (const msg of messages) {
          allDetections.push(...detectInMessage(msg));
        }

        return calculateScore(allDetections, messages.length, previousScore);
      }),

    getAntidote: (horseman: Horseman) => getAntidote(horseman),
  }),
);

// =============================================================================
// EXPORTS
// =============================================================================

export {
  CRITICISM_PATTERNS,
  CONTEMPT_PATTERNS,
  DEFENSIVENESS_PATTERNS,
  STONEWALLING_PATTERNS,
  detectInMessage,
  calculateScore,
  getAntidote,
};
