/**
 * UI Components Index
 *
 * Re-exports all Ink components for easy importing.
 */

export type { AlertProps, FineAlertProps, RatioWarningProps, ShortResponseAlertProps } from "./Alert.js";
// Alert components
export {
  Alert,
  ErrorAlert,
  FineDetectedAlert,
  Hint,
  Info,
  RatioWarning,
  ShortResponseAlert,
  Success,
  Warning,
} from "./Alert.js";
export type { EmotionalDamageProps, RelationshipError, RelationshipErrorTag } from "./EmotionalDamage.js";
// Error display
export { EmotionalDamage } from "./EmotionalDamage.js";
export type { DecodedMeaning, FineAnalysisProps, FineResponse } from "./FineAnalysis.js";
// Fine analysis
export { FineAnalysis } from "./FineAnalysis.js";
export type { HealthDashboardProps, RelationshipHealthMetrics } from "./HealthDashboard.js";
// Health dashboard
export { HealthDashboard, HealthSummary } from "./HealthDashboard.js";
export type { Memory, MemoryListProps, MemoryStoredProps } from "./Memory.js";
// Memory components
export { MemoryList, MemoryStored } from "./Memory.js";
export type { MetricRowProps, ProgressBarProps } from "./ProgressBar.js";
// Progress components
export { MetricRow, ProgressBar } from "./ProgressBar.js";
export type { SpinnerProps, TaskSpinnerProps } from "./Spinner.js";
// Spinner components
export { Spinner, TaskSpinner } from "./Spinner.js";
export type { LabeledValueProps, SectionHeaderProps, StyledBoxProps } from "./StyledBox.js";
// Layout components
export { LabeledValue, SectionHeader, StyledBox } from "./StyledBox.js";
export type { TipProps } from "./Tips.js";
// Tips
export { Tip, TipOfTheDay } from "./Tips.js";
