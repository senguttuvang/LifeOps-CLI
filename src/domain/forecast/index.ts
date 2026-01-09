/**
 * Breakup Forecasting Domain
 *
 * Science-backed relationship health prediction using Gottman's research.
 *
 * @module domain/forecast
 */

// Types
export * from "./types";

// Four Horsemen Detector
export {
  FourHorsemenDetectorTag,
  FourHorsemenDetectorLive,
  detectInMessage,
  calculateScore as calculateHorsemenScore,
  getAntidote,
  CRITICISM_PATTERNS,
  CONTEMPT_PATTERNS,
  DEFENSIVENESS_PATTERNS,
  STONEWALLING_PATTERNS,
} from "./four-horsemen.detector";

// Ratio Analyzer
export {
  RatioAnalyzerTag,
  RatioAnalyzerLive,
  analyzeMessage as analyzeSentiment,
  calculateRatio,
  POSITIVE_PATTERNS,
  NEGATIVE_PATTERNS,
  POSITIVE_EMOJIS,
  NEGATIVE_EMOJIS,
} from "./ratio.analyzer";

// Forecast Service
export {
  ForecastServiceTag,
  ForecastServiceLive,
  calculateEngagement,
  calculateConnection,
  calculateHealthScore,
  determineRiskLevel,
  calculateTrend,
  generateWarnings,
  generateRecommendations,
} from "./forecast.service";

// Forecast Repository
export {
  ForecastRepositoryTag,
  ForecastRepositoryLive,
  type ContactRecord,
  type RelationshipRecord,
  type MessageRecord,
} from "./forecast.repository";
