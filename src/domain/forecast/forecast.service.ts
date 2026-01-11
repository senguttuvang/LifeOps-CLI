/**
 * Breakup Forecast Service
 *
 * Main orchestrator for relationship health forecasting.
 * Combines Four Horsemen detection, ratio tracking, engagement metrics,
 * and connection analysis into a unified health score with trend forecasting.
 *
 * @see docs/breakup-forecasting.md
 */

import { Context, Effect, Layer } from "effect";
import { FourHorsemenDetectorLive, FourHorsemenDetectorTag, getAntidote } from "./four-horsemen.detector";
import { RatioAnalyzerLive, RatioAnalyzerTag } from "./ratio.analyzer";
import {
  type BreakupForecast,
  type ConnectionScore,
  type EngagementMetrics,
  type FourHorsemenScore,
  type RatioScore,
  type Recommendation,
  RISK_THRESHOLDS,
  type RiskLevel,
  SCORE_WEIGHTS,
  type TrendAnalysis,
  type Warning,
} from "./types";

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Input message for forecast analysis
 */
interface MessageInput {
  id: string;
  text: string;
  timestamp: Date;
  fromMe: boolean;
}

/**
 * Contact context for forecast
 */
interface ContactContext {
  id: string;
  name: string;
  relationshipType: "partner" | "family" | "friend";
}

/**
 * Historical health snapshots for trend analysis
 */
interface HistoricalSnapshot {
  date: Date;
  healthScore: number;
}

/**
 * Service interface for breakup forecasting
 */
interface ForecastService {
  /**
   * Generate complete forecast for a contact
   */
  generateForecast(
    contact: ContactContext,
    messages: MessageInput[],
    historicalSnapshots?: HistoricalSnapshot[],
  ): Effect.Effect<BreakupForecast>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Service tag for dependency injection
 */
export class ForecastServiceTag extends Context.Tag("ForecastService")<ForecastServiceTag, ForecastService>() {}

/**
 * Calculate engagement metrics from messages
 */
function calculateEngagement(messages: MessageInput[]): EngagementMetrics {
  if (messages.length === 0) {
    return {
      avgResponseTimeMinutes: 0,
      responseTimeP50: 0,
      responseTimeTrend: "stable",
      initiationRatio: 0.5,
      initiator: "balanced",
      avgMessageLength: 0,
      messageLengthTrend: "stable",
      conversationsPerWeek: 0,
      frequencyTrend: "stable",
      questionRate: 0,
      followupQuestionRate: 0,
      score: 50,
    };
  }

  // Sort by timestamp
  const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Calculate response times
  const responseTimes: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Only count if different sender (actual response)
    if (prev.fromMe !== curr.fromMe) {
      const diffMs = curr.timestamp.getTime() - prev.timestamp.getTime();
      const diffMinutes = diffMs / 1000 / 60;

      // Only count reasonable response times (< 24 hours)
      if (diffMinutes < 1440) {
        responseTimes.push(diffMinutes);
      }
    }
  }

  const avgResponseTime =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p50 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.5)] : 0;

  // Calculate initiation ratio
  const userMessages = messages.filter((m) => m.fromMe);
  const initiationRatio = messages.length > 0 ? userMessages.length / messages.length : 0.5;

  let initiator: "user" | "partner" | "balanced" = "balanced";
  if (initiationRatio > 0.6) {
    initiator = "user";
  } else if (initiationRatio < 0.4) {
    initiator = "partner";
  }

  // Calculate message lengths
  const userLengths = userMessages.filter((m) => m.text).map((m) => m.text.length);
  const avgMessageLength = userLengths.length > 0 ? userLengths.reduce((a, b) => a + b, 0) / userLengths.length : 0;

  // Calculate question rate
  const questionsAsked = userMessages.filter((m) => m.text && m.text.includes("?")).length;
  const questionRate = userMessages.length > 0 ? questionsAsked / userMessages.length : 0;

  // Estimate conversations per week
  const windowDays =
    messages.length > 0
      ? (sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime()) / 1000 / 60 / 60 / 24
      : 7;
  const conversationsPerWeek = windowDays > 0 ? (messages.length / windowDays) * 7 : 0;

  // Calculate engagement score (0-100)
  // Based on: response time, balance, activity level
  let score = 50;

  // Response time component (faster = better, up to +25)
  if (avgResponseTime < 30) score += 25;
  else if (avgResponseTime < 60) score += 20;
  else if (avgResponseTime < 120) score += 10;
  else if (avgResponseTime > 480) score -= 15;

  // Balance component (balanced = better, up to +15)
  const balanceDeviation = Math.abs(initiationRatio - 0.5);
  if (balanceDeviation < 0.1) score += 15;
  else if (balanceDeviation < 0.2) score += 10;
  else if (balanceDeviation > 0.3) score -= 10;

  // Activity component (more = better, up to +10)
  if (conversationsPerWeek > 50) score += 10;
  else if (conversationsPerWeek > 20) score += 5;
  else if (conversationsPerWeek < 5) score -= 10;

  return {
    avgResponseTimeMinutes: avgResponseTime,
    responseTimeP50: p50,
    responseTimeTrend: "stable", // Would need historical data
    initiationRatio,
    initiator,
    avgMessageLength,
    messageLengthTrend: "stable",
    conversationsPerWeek,
    frequencyTrend: "stable",
    questionRate,
    followupQuestionRate: 0,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Calculate connection score
 */
function calculateConnection(messages: MessageInput[]): ConnectionScore {
  if (messages.length === 0) {
    return {
      daysSinceDeepConvo: 30,
      targetFrequency: 3,
      currentDebt: 27,
      deepConvoCount: 0,
      deepConvoTrend: "decreasing",
      status: "disconnected",
      score: 0,
    };
  }

  // Identify "deep" conversations (longer messages, questions, emotional content)
  const deepMarkers = [
    /\bfeel\b/i,
    /\bthink\b/i,
    /\bworried\b/i,
    /\bexcited\b/i,
    /\bscared\b/i,
    /\bdream\b/i,
    /\bhope\b/i,
    /\bfuture\b/i,
    /\btalk about\b/i,
  ];

  const deepMessages = messages.filter((m) => {
    if (!m.text) return false;
    const isLong = m.text.length > 200;
    const hasMarkers = deepMarkers.some((p) => p.test(m.text));
    const hasQuestions = (m.text.match(/\?/g) || []).length >= 2;
    return isLong || hasMarkers || hasQuestions;
  });

  const deepConvoCount = deepMessages.length;

  // Calculate days since last deep conversation
  const sorted = [...deepMessages].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const now = new Date();
  const daysSinceDeepConvo =
    sorted.length > 0 ? (now.getTime() - sorted[0].timestamp.getTime()) / 1000 / 60 / 60 / 24 : 30;

  // Target: deep convo every 3-4 days
  const targetFrequency = 3.5;
  const currentDebt = daysSinceDeepConvo - targetFrequency;

  // Determine status
  let status: "connected" | "drifting" | "disconnected" = "connected";
  if (currentDebt > 7) {
    status = "disconnected";
  } else if (currentDebt > 3) {
    status = "drifting";
  }

  // Calculate score
  let score = 80;
  if (status === "disconnected") score = 30;
  else if (status === "drifting") score = 55;

  // Adjust for deep convo frequency
  if (deepConvoCount > 10) score += 10;
  else if (deepConvoCount < 3) score -= 15;

  return {
    daysSinceDeepConvo,
    targetFrequency,
    currentDebt,
    deepConvoCount,
    deepConvoTrend: "stable",
    status,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Calculate overall health score from components
 */
function calculateHealthScore(
  horsemen: FourHorsemenScore,
  ratio: RatioScore,
  engagement: EngagementMetrics,
  connection: ConnectionScore,
): number {
  return (
    horsemen.score * SCORE_WEIGHTS.fourHorsemen +
    ratio.score * SCORE_WEIGHTS.ratio +
    engagement.score * SCORE_WEIGHTS.engagement +
    connection.score * SCORE_WEIGHTS.connection +
    // Growth weight uses average of other scores for now
    ((horsemen.score + ratio.score + engagement.score + connection.score) / 4) * SCORE_WEIGHTS.growth
  );
}

/**
 * Determine risk level from health score
 */
function determineRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.LOW.min) return "LOW";
  if (score >= RISK_THRESHOLDS.MODERATE.min) return "MODERATE";
  if (score >= RISK_THRESHOLDS.HIGH.min) return "HIGH";
  return "CRITICAL";
}

/**
 * Calculate trend from historical data
 */
function calculateTrend(currentScore: number, historical: HistoricalSnapshot[]): TrendAnalysis {
  if (historical.length < 2) {
    return {
      direction: "stable",
      velocity: 0,
      acceleration: 0,
      predictedScoreIn30Days: currentScore,
    };
  }

  // Sort by date
  const sorted = [...historical].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate week-over-week changes
  const weeklyChanges: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 1000 / 60 / 60 / 24;
    const scoreDiff = sorted[i].healthScore - sorted[i - 1].healthScore;
    const weeklyChange = (scoreDiff / daysDiff) * 7;
    weeklyChanges.push(weeklyChange);
  }

  // Average velocity (points per week)
  const velocity = weeklyChanges.length > 0 ? weeklyChanges.reduce((a, b) => a + b, 0) / weeklyChanges.length : 0;

  // Calculate acceleration (change in velocity)
  let acceleration = 0;
  if (weeklyChanges.length >= 2) {
    const recentVelocity = weeklyChanges[weeklyChanges.length - 1];
    const olderVelocity = weeklyChanges[Math.floor(weeklyChanges.length / 2)];
    acceleration = recentVelocity - olderVelocity;
  }

  // Determine direction
  let direction: "improving" | "stable" | "declining" = "stable";
  if (velocity > 2) {
    direction = "improving";
  } else if (velocity < -2) {
    direction = "declining";
  }

  // Predict 30-day score (4.3 weeks)
  const predictedScoreIn30Days = Math.max(0, Math.min(100, currentScore + velocity * 4.3));

  return {
    direction,
    velocity,
    acceleration,
    predictedScoreIn30Days,
  };
}

/**
 * Generate warnings based on analysis
 */
function generateWarnings(
  horsemen: FourHorsemenScore,
  ratio: RatioScore,
  engagement: EngagementMetrics,
  connection: ConnectionScore,
): Warning[] {
  const warnings: Warning[] = [];
  const now = new Date();

  // Contempt warning (HIGHEST PRIORITY)
  if (horsemen.contemptCount > 0) {
    const contemptDetection = horsemen.recentDetections.find((d) => d.horseman === "contempt");
    warnings.push({
      id: "contempt-detected",
      severity: "critical",
      title: "CONTEMPT DETECTED",
      description: `Contempt was detected ${horsemen.contemptCount} time(s). This is the #1 predictor of relationship failure.`,
      horseman: "contempt",
      evidence: contemptDetection ? [contemptDetection.excerpt] : undefined,
      detectedAt: now,
    });
  }

  // Criticism warning
  if (horsemen.criticismCount >= 3) {
    warnings.push({
      id: "criticism-pattern",
      severity: "warning",
      title: "Criticism Pattern Detected",
      description: `${horsemen.criticismCount} instances of criticism detected. Focus on specific behaviors, not character.`,
      horseman: "criticism",
      detectedAt: now,
    });
  }

  // Ratio warning
  if (ratio.status === "danger") {
    warnings.push({
      id: "ratio-danger",
      severity: "critical",
      title: "RATIO IN DANGER ZONE",
      description: `Positive:negative ratio is ${ratio.ratio.toFixed(1)}:1. Healthy relationships maintain 5:1.`,
      detectedAt: now,
    });
  } else if (ratio.status === "borderline") {
    warnings.push({
      id: "ratio-declining",
      severity: "warning",
      title: "Ratio Declining",
      description: `Ratio at ${ratio.ratio.toFixed(1)}:1 (target: 5:1). Increase positive interactions.`,
      detectedAt: now,
    });
  }

  // Connection debt
  if (connection.status === "disconnected") {
    warnings.push({
      id: "connection-debt-high",
      severity: "critical",
      title: "CONNECTION DEBT HIGH",
      description: `${Math.round(connection.daysSinceDeepConvo)} days since meaningful conversation.`,
      detectedAt: now,
    });
  } else if (connection.status === "drifting") {
    warnings.push({
      id: "connection-drifting",
      severity: "warning",
      title: "Connection Drifting",
      description: `${Math.round(connection.daysSinceDeepConvo)} days since deep conversation (target: ${connection.targetFrequency} days).`,
      detectedAt: now,
    });
  }

  // Engagement imbalance
  if (engagement.initiator !== "balanced" && Math.abs(engagement.initiationRatio - 0.5) > 0.25) {
    const who = engagement.initiator === "user" ? "You" : "Partner";
    warnings.push({
      id: "initiation-imbalance",
      severity: "info",
      title: "Initiation Imbalance",
      description: `${who} initiates ${Math.round(Math.max(engagement.initiationRatio, 1 - engagement.initiationRatio) * 100)}% of conversations.`,
      detectedAt: now,
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  warnings: Warning[],
  horsemen: FourHorsemenScore,
  ratio: RatioScore,
  connection: ConnectionScore,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Contempt requires immediate attention
  const hasContempt = warnings.some((w) => w.horseman === "contempt");
  if (hasContempt) {
    recommendations.push({
      id: "address-contempt",
      priority: "high",
      title: "Address the Contempt",
      description: "Contempt signals deep resentment and must be addressed immediately.",
      action: "Have an honest conversation about underlying frustrations. Express appreciation daily.",
      source: "Gottman's 'The Seven Principles for Making Marriage Work'",
    });
  }

  // Ratio recommendations
  if (ratio.status === "danger" || ratio.status === "borderline") {
    recommendations.push({
      id: "increase-positives",
      priority: ratio.status === "danger" ? "high" : "medium",
      title: "Increase Positive Interactions",
      description: `Your ratio is ${ratio.ratio.toFixed(1)}:1, target is 5:1.`,
      action: "Send appreciation messages, give compliments, share small kindnesses daily.",
      source: "Gottman's Magic Ratio Research",
    });
  }

  // Connection recommendations
  if (connection.status !== "connected") {
    recommendations.push({
      id: "schedule-quality-time",
      priority: connection.status === "disconnected" ? "high" : "medium",
      title: "Schedule Quality Time",
      description: `${Math.round(connection.daysSinceDeepConvo)} days without deep connection.`,
      action: "Plan uninterrupted time. Use conversation starters. Put phones away.",
      source: "A.R.E. Framework (Sue Johnson)",
    });
  }

  // Horsemen-specific antidotes
  for (const detection of horsemen.recentDetections.slice(0, 3)) {
    const existing = recommendations.find((r) => r.id === `antidote-${detection.horseman}`);
    if (!existing && detection.horseman !== "contempt") {
      // Contempt already handled
      recommendations.push({
        id: `antidote-${detection.horseman}`,
        priority: "medium",
        title: `Counter ${detection.horseman.charAt(0).toUpperCase() + detection.horseman.slice(1)}`,
        description: `${detection.horseman} pattern detected.`,
        action: getAntidote(detection.horseman),
        source: "Gottman's Four Horsemen Research",
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// =============================================================================
// LAYER (DEPENDENCY INJECTION)
// =============================================================================

/**
 * Create the forecast service with dependencies
 */
const make = Effect.gen(function* () {
  const horsemenDetector = yield* FourHorsemenDetectorTag;
  const ratioAnalyzer = yield* RatioAnalyzerTag;

  return ForecastServiceTag.of({
    generateForecast: (
      contact: ContactContext,
      messages: MessageInput[],
      historicalSnapshots: HistoricalSnapshot[] = [],
    ) =>
      Effect.gen(function* () {
        const now = new Date();

        // Determine analysis window
        const sortedMessages = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const windowStart =
          sortedMessages.length > 0 ? sortedMessages[0].timestamp : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const windowEnd = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].timestamp : now;
        const windowDays = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 1000 / 60 / 60 / 24);

        // Run Four Horsemen analysis
        const horsemenScore = yield* horsemenDetector.analyzeMessages(messages);

        // Run ratio analysis
        const ratioScore = yield* ratioAnalyzer.calculateRatio(messages);

        // Calculate engagement metrics
        const engagementScore = calculateEngagement(messages);

        // Calculate connection score
        const connectionScore = calculateConnection(messages);

        // Calculate overall health score
        const healthScore = calculateHealthScore(horsemenScore, ratioScore, engagementScore, connectionScore);

        // Determine risk level
        const riskLevel = determineRiskLevel(healthScore);

        // Calculate trend
        const trend = calculateTrend(healthScore, historicalSnapshots);

        // Generate warnings
        const warnings = generateWarnings(horsemenScore, ratioScore, engagementScore, connectionScore);

        // Generate recommendations
        const recommendations = generateRecommendations(warnings, horsemenScore, ratioScore, connectionScore);

        // Calculate confidence based on message count
        const confidence = Math.min(0.95, 0.5 + messages.length * 0.005);

        const forecast: BreakupForecast = {
          contactId: contact.id,
          contactName: contact.name,
          healthScore,
          riskLevel,
          trend,
          components: {
            fourHorsemen: horsemenScore,
            ratio: ratioScore,
            engagement: engagementScore,
            connection: connectionScore,
          },
          warnings,
          recommendations,
          analysisWindow: {
            start: windowStart,
            end: windowEnd,
            days: windowDays,
          },
          messageCount: messages.length,
          confidence,
          generatedAt: now,
        };

        return forecast;
      }),
  });
});

/**
 * Live layer with all dependencies
 */
export const ForecastServiceLive = Layer.effect(ForecastServiceTag, make).pipe(
  Layer.provide(FourHorsemenDetectorLive),
  Layer.provide(RatioAnalyzerLive),
);

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateEngagement,
  calculateConnection,
  calculateHealthScore,
  determineRiskLevel,
  calculateTrend,
  generateWarnings,
  generateRecommendations,
};
