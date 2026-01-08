/**
 * HealthDashboard Component
 *
 * Displays relationship health metrics.
 * Replaces displayHealthDashboard from relationship-output.ts.
 */

import { Box, Text } from "ink";
import { StyledBox } from "./StyledBox.js";
import { MetricRow } from "./ProgressBar.js";

export interface RelationshipHealthMetrics {
  readonly communicationScore: number;
  readonly qualityTimeScore: number;
  readonly surpriseFactor: number;
  readonly memoryAccuracy: number;
  readonly dramaFreeStreak: number;
  readonly lastSync: Date;
}

export interface HealthDashboardProps {
  readonly metrics: RelationshipHealthMetrics;
}

/**
 * Full health dashboard display
 */
export function HealthDashboard({ metrics }: HealthDashboardProps) {
  return (
    <StyledBox title="Relationship Health Dashboard" titleColor="cyan">
      <Box flexDirection="column" gap={0}>
        <MetricRow label="Communication Score" value={metrics.communicationScore} />
        <MetricRow label="Quality Time" value={metrics.qualityTimeScore} />
        <MetricRow label="Surprise Factor" value={metrics.surpriseFactor} />
        <MetricRow label="Memory Accuracy" value={metrics.memoryAccuracy} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Streak: {metrics.dramaFreeStreak} drama-free days</Text>
        <Text dimColor>Last sync: {metrics.lastSync.toLocaleString()}</Text>
      </Box>
    </StyledBox>
  );
}

/**
 * Compact health summary for inline display
 */
export function HealthSummary({ metrics }: HealthDashboardProps) {
  const avgScore = Math.round(
    (metrics.communicationScore +
      metrics.qualityTimeScore +
      metrics.surpriseFactor +
      metrics.memoryAccuracy) /
      4
  );

  const color = avgScore >= 70 ? "green" : avgScore >= 40 ? "yellow" : "red";

  return (
    <Box>
      <Text>Health: </Text>
      <Text color={color} bold>
        {avgScore}%
      </Text>
      <Text dimColor> ({metrics.dramaFreeStreak} day streak)</Text>
    </Box>
  );
}
