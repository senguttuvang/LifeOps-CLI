/**
 * UI Components Index
 *
 * Re-exports all Ink components for easy importing.
 */

// Layout components
export { StyledBox, LabeledValue, SectionHeader } from "./StyledBox.js";
export type { StyledBoxProps, LabeledValueProps, SectionHeaderProps } from "./StyledBox.js";

// Progress components
export { ProgressBar, MetricRow } from "./ProgressBar.js";
export type { ProgressBarProps, MetricRowProps } from "./ProgressBar.js";

// Alert components
export {
  Alert,
  Success,
  Warning,
  ErrorAlert,
  Info,
  Hint,
  FineDetectedAlert,
  ShortResponseAlert,
  RatioWarning,
} from "./Alert.js";
export type { AlertProps, FineAlertProps, ShortResponseAlertProps, RatioWarningProps } from "./Alert.js";

// Spinner components
export { Spinner, TaskSpinner } from "./Spinner.js";
export type { SpinnerProps, TaskSpinnerProps } from "./Spinner.js";

// Fine analysis
export { FineAnalysis } from "./FineAnalysis.js";
export type { FineAnalysisProps, FineResponse, DecodedMeaning } from "./FineAnalysis.js";

// Health dashboard
export { HealthDashboard, HealthSummary } from "./HealthDashboard.js";
export type { HealthDashboardProps, RelationshipHealthMetrics } from "./HealthDashboard.js";

// Memory components
export { MemoryStored, MemoryList } from "./Memory.js";
export type { MemoryStoredProps, MemoryListProps, Memory } from "./Memory.js";

// Error display
export { EmotionalDamage } from "./EmotionalDamage.js";
export type { EmotionalDamageProps, RelationshipError, RelationshipErrorTag } from "./EmotionalDamage.js";

// Tips
export { Tip, TipOfTheDay } from "./Tips.js";
export type { TipProps } from "./Tips.js";
