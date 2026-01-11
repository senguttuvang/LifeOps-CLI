/**
 * Breakup Forecasting Domain
 *
 * Science-backed relationship health prediction using Gottman's research.
 *
 * @module domain/forecast
 */

// Forecast Repository
export {
  type ContactRecord,
  ForecastRepositoryLive,
  ForecastRepositoryTag,
  type MessageRecord,
  type RelationshipRecord,
} from "./forecast.repository";
// Forecast Service
export {
  calculateConnection,
  calculateEngagement,
  calculateHealthScore,
  calculateTrend,
  determineRiskLevel,
  ForecastServiceLive,
  ForecastServiceTag,
  generateRecommendations,
  generateWarnings,
} from "./forecast.service";
// Four Horsemen Detector
export {
  CONTEMPT_PATTERNS,
  CRITICISM_PATTERNS,
  calculateScore as calculateHorsemenScore,
  DEFENSIVENESS_PATTERNS,
  detectInMessage,
  FourHorsemenDetectorLive,
  FourHorsemenDetectorTag,
  getAntidote,
  STONEWALLING_PATTERNS,
} from "./four-horsemen.detector";
// Ratio Analyzer
export {
  analyzeMessage as analyzeSentiment,
  calculateRatio,
  NEGATIVE_EMOJIS,
  NEGATIVE_PATTERNS,
  POSITIVE_EMOJIS,
  POSITIVE_PATTERNS,
  RatioAnalyzerLive,
  RatioAnalyzerTag,
} from "./ratio.analyzer";
// Types
export * from "./types";
