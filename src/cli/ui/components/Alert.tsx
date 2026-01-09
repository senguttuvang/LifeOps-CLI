/**
 * Alert Components
 *
 * Various alert and status message components.
 * Replaces success(), warn(), error(), hint() from relationship-output.ts.
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";

type AlertType = "success" | "warning" | "error" | "info" | "hint";

interface AlertConfig {
  readonly icon: string;
  readonly color: string;
}

const ALERT_CONFIG: Record<AlertType, AlertConfig> = {
  success: { icon: "✓", color: "green" },
  warning: { icon: "⚠", color: "yellow" },
  error: { icon: "✗", color: "red" },
  info: { icon: "ℹ", color: "blue" },
  hint: { icon: "💡", color: "gray" },
};

export interface AlertProps {
  readonly type: AlertType;
  readonly children: ReactNode;
}

/**
 * General purpose alert component
 */
export function Alert({ type, children }: AlertProps) {
  const config = ALERT_CONFIG[type];
  return (
    <Box>
      <Text color={config.color}>{config.icon} </Text>
      <Text color={type === "hint" ? "gray" : undefined}>{children}</Text>
    </Box>
  );
}

/**
 * Convenience components for specific alert types
 */
export function Success({ children }: { readonly children: ReactNode }) {
  return <Alert type="success">{children}</Alert>;
}

export function Warning({ children }: { readonly children: ReactNode }) {
  return <Alert type="warning">{children}</Alert>;
}

export function ErrorAlert({ children }: { readonly children: ReactNode }) {
  return <Alert type="error">{children}</Alert>;
}

export function Info({ children }: { readonly children: ReactNode }) {
  return <Alert type="info">{children}</Alert>;
}

export function Hint({ children }: { readonly children: ReactNode }) {
  return <Alert type="hint">{children}</Alert>;
}

/**
 * Pattern-specific alerts from relationship intelligence
 */
export interface FineAlertProps {
  readonly probability?: number;
}

export function FineDetectedAlert({ probability = 3 }: FineAlertProps) {
  return (
    <Box marginY={1}>
      <Text color="yellow">⚠️ 'Fine' detected. Probability of actually fine: {probability}%. Proceed with caution.</Text>
    </Box>
  );
}

export interface ShortResponseAlertProps {
  readonly response: string;
}

export function ShortResponseAlert({ response }: ShortResponseAlertProps) {
  const isK = response.toLowerCase() === "k";
  return (
    <Box marginY={1}>
      {isK ? (
        <Text>
          <Text color="red">🚨</Text> Single 'k' received. Threat level:{" "}
          <Text color="red" bold>
            ELEVATED
          </Text>
          . Recommended action: Call immediately.
        </Text>
      ) : (
        <Text color="yellow">⚠️ Critically short response detected. The silence speaks volumes.</Text>
      )}
    </Box>
  );
}

export interface RatioWarningProps {
  readonly positive: number;
  readonly negative: number;
}

export function RatioWarning({ positive, negative }: RatioWarningProps) {
  const ratio = negative > 0 ? positive / negative : positive;
  if (ratio >= 5) return null;

  return (
    <Box marginY={1}>
      <Text color="yellow">⚠️ Your ratio is {ratio.toFixed(1)}:1 (target: 5:1). Deposit positives ASAP.</Text>
    </Box>
  );
}
