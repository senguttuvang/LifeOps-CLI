/**
 * Breakup Forecasting Domain Types
 *
 * Type definitions for relationship health forecasting based on
 * Gottman's divorce prediction research (90% accuracy).
 *
 * @see docs/breakup-forecasting.md for architecture details
 */

// =============================================================================
// FOUR HORSEMEN TYPES
// =============================================================================

/**
 * The Four Horsemen of relationship apocalypse (Gottman)
 * - Criticism: Attacking character instead of behavior
 * - Contempt: Superiority, mockery (THE #1 PREDICTOR - weighted 2x)
 * - Defensiveness: Counter-attacks, victimhood
 * - Stonewalling: Withdrawal, shutting down
 */
export type Horseman = "criticism" | "contempt" | "defensiveness" | "stonewalling";

/**
 * Single detection of a Horseman pattern in a message
 */
export interface HorsemanDetection {
  /** Which horseman was detected */
  horseman: Horseman;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Severity level (1-5, 5 being most severe) */
  severity: number;
  /** Source message ID */
  messageId: string;
  /** Relevant excerpt from message */
  excerpt: string;
  /** Pattern that matched */
  matchedPattern: string;
  /** When the message was sent */
  timestamp: Date;
  /** Who sent it: 'user' or 'partner' */
  sender: "user" | "partner";
}

/**
 * Aggregated Four Horsemen score for a time period
 */
export interface FourHorsemenScore {
  /** Count of criticism instances */
  criticismCount: number;
  /** Count of contempt instances (weighted 2x in scoring) */
  contemptCount: number;
  /** Count of defensiveness instances */
  defensivenessCount: number;
  /** Count of stonewalling instances */
  stonewallingCount: number;

  /** Overall horsemen score (0-100, higher = healthier) */
  score: number;

  /** Trend compared to previous period */
  trend: "improving" | "stable" | "worsening";
  /** Week-over-week change in score */
  weekOverWeekDelta: number;

  /** Recent detections for evidence */
  recentDetections: HorsemanDetection[];

  /** Who exhibits more horsemen behavior */
  primaryExhibitor: "user" | "partner" | "balanced";
}

// =============================================================================
// SENTIMENT & RATIO TYPES
// =============================================================================

/**
 * Sentiment classification for a single message
 */
export type Valence = "positive" | "neutral" | "negative";

/**
 * Sentiment analysis result for a message
 */
export interface MessageValence {
  messageId: string;
  /** Positive, neutral, or negative */
  valence: Valence;
  /** Score from -1 (negative) to +1 (positive) */
  score: number;
  /** Detection confidence */
  confidence: number;
  /** Who sent the message */
  sender: "user" | "partner";
}

/**
 * The Magic Ratio score (Gottman's 5:1 research)
 *
 * Healthy relationships maintain 5 positive for every 1 negative interaction.
 * During conflict, dropping below 2:1 is "danger zone".
 */
export interface RatioScore {
  /** Count of positive interactions */
  positiveCount: number;
  /** Count of negative interactions */
  negativeCount: number;
  /** Count of neutral interactions */
  neutralCount: number;

  /** Calculated ratio (positive:negative) */
  ratio: number;

  /** Health interpretation */
  status: "healthy" | "borderline" | "danger";

  /** Normalized score (0-100) */
  score: number;

  /** Trend */
  trend: "improving" | "stable" | "worsening";
  weekOverWeekDelta: number;

  /** Breakdown by sender */
  userPositiveRate: number;
  partnerPositiveRate: number;
}

// =============================================================================
// ENGAGEMENT TYPES
// =============================================================================

/**
 * Engagement metrics tracking response patterns and investment
 */
export interface EngagementMetrics {
  // Response patterns
  /** Average response time in minutes */
  avgResponseTimeMinutes: number;
  /** Median response time */
  responseTimeP50: number;
  /** Response time trend */
  responseTimeTrend: "faster" | "stable" | "slower";

  // Initiation balance
  /** Ratio of who initiates (0.5 = balanced) */
  initiationRatio: number;
  /** Who initiates more */
  initiator: "user" | "partner" | "balanced";

  // Message depth
  /** Average message length (characters) */
  avgMessageLength: number;
  /** Message length trend */
  messageLengthTrend: "longer" | "stable" | "shorter";

  // Conversation frequency
  /** Conversations per week */
  conversationsPerWeek: number;
  /** Frequency trend */
  frequencyTrend: "increasing" | "stable" | "decreasing";

  // Questions & engagement markers
  /** Rate of asking questions */
  questionRate: number;
  /** Rate of followup questions */
  followupQuestionRate: number;

  /** Overall engagement score (0-100) */
  score: number;
}

// =============================================================================
// CONNECTION TYPES
// =============================================================================

/**
 * Connection metrics tracking depth and frequency of meaningful interaction
 */
export interface ConnectionScore {
  /** Days since last deep conversation */
  daysSinceDeepConvo: number;
  /** Target frequency based on history */
  targetFrequency: number;
  /** Current debt (positive = overdue) */
  currentDebt: number;

  /** Deep conversations in analysis window */
  deepConvoCount: number;
  /** Trend */
  deepConvoTrend: "increasing" | "stable" | "decreasing";

  /** Status */
  status: "connected" | "drifting" | "disconnected";

  /** Overall connection score (0-100) */
  score: number;
}

// =============================================================================
// FORECAST TYPES
// =============================================================================

/**
 * Risk levels for relationship health
 */
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/**
 * Warning signal detected in analysis
 */
export interface Warning {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  /** If horseman-related */
  horseman?: Horseman;
  /** Evidence (message excerpts) */
  evidence?: string[];
  /** When detected */
  detectedAt: Date;
}

/**
 * Recommended intervention based on research
 */
export interface Recommendation {
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  /** Specific action to take */
  action: string;
  /** Research source */
  source: string;
}

/**
 * Trend analysis for forecasting
 */
export interface TrendAnalysis {
  /** Direction of change */
  direction: "improving" | "stable" | "declining";
  /** Points change per week */
  velocity: number;
  /** Change in velocity (acceleration) */
  acceleration: number;
  /** Predicted score in 30 days if trends continue */
  predictedScoreIn30Days: number;
}

/**
 * Complete breakup forecast result
 */
export interface BreakupForecast {
  /** Contact being analyzed */
  contactId: string;
  contactName: string;

  // Core metrics
  /** Overall health score (0-100) */
  healthScore: number;
  /** Risk level */
  riskLevel: RiskLevel;

  // 30-day trend analysis
  trend: TrendAnalysis;

  // Component scores
  components: {
    fourHorsemen: FourHorsemenScore;
    ratio: RatioScore;
    engagement: EngagementMetrics;
    connection: ConnectionScore;
  };

  // Warning signals (sorted by severity)
  warnings: Warning[];

  // Recommended interventions
  recommendations: Recommendation[];

  // Analysis metadata
  analysisWindow: {
    start: Date;
    end: Date;
    days: number;
  };
  messageCount: number;
  confidence: number;
  generatedAt: Date;
}

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

/**
 * Pattern definition for horseman detection
 */
export interface HorsemanPattern {
  horseman: Horseman;
  patterns: RegExp[];
  /** Some patterns are more severe */
  severity: number;
  /** Antidote from Gottman research */
  antidote: string;
}

/**
 * Emoji indicators for contempt detection
 */
export const CONTEMPT_EMOJIS = ["🙄", "😒", "🤡", "💀", "😤", "🤮"] as const;

/**
 * Score thresholds for risk levels
 */
export const RISK_THRESHOLDS = {
  LOW: { min: 70, max: 100 },
  MODERATE: { min: 50, max: 69 },
  HIGH: { min: 30, max: 49 },
  CRITICAL: { min: 0, max: 29 },
} as const;

/**
 * Weight configuration for health score calculation
 */
export const SCORE_WEIGHTS = {
  fourHorsemen: 0.25,
  ratio: 0.25,
  engagement: 0.2,
  connection: 0.15,
  growth: 0.15,
} as const;

/**
 * Ratio thresholds based on Gottman's research
 * - 5:1 is the "magic ratio" for healthy relationships
 * - Below 2:1 is the "danger zone"
 */
export const RATIO_THRESHOLDS = {
  healthy: 5.0,
  borderline: 3.0,
  danger: 2.0,
  critical: 1.0,
} as const;
