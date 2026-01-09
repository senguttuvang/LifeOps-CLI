/**
 * ProgressBar Component
 *
 * Visual progress bar for metrics display.
 * Replaces the manual bar() function in relationship-output.ts.
 */

import { Box, Text } from "ink";

export interface ProgressBarProps {
  readonly value: number; // 0-100
  readonly width?: number;
  readonly showPercentage?: boolean;
  readonly label?: string;
}

/**
 * Get color based on value threshold
 */
function getColor(value: number): string {
  if (value >= 70) return "green";
  if (value >= 40) return "yellow";
  return "red";
}

/**
 * A visual progress bar with automatic coloring
 */
export function ProgressBar({ value, width = 20, showPercentage = true, label }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const filled = Math.round((clampedValue / 100) * width);
  const empty = width - filled;
  const color = getColor(clampedValue);

  return (
    <Box>
      {label && (
        <Box width={22}>
          <Text>{label}</Text>
        </Box>
      )}
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      {showPercentage && <Text color={color}> {clampedValue.toFixed(0)}%</Text>}
    </Box>
  );
}

export interface MetricRowProps {
  readonly label: string;
  readonly value: number;
  readonly labelWidth?: number;
}

/**
 * A metric row with label and progress bar
 */
export function MetricRow({ label, value, labelWidth = 20 }: MetricRowProps) {
  return (
    <Box>
      <Box width={labelWidth}>
        <Text>{label}:</Text>
      </Box>
      <ProgressBar value={value} />
    </Box>
  );
}
