/**
 * StyledBox Component
 *
 * Replaces the manual box-drawing in relationship-output.ts
 * with a proper Ink component using flexbox layout.
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";

export interface StyledBoxProps {
  readonly title?: string;
  readonly titleColor?: string;
  readonly borderColor?: string;
  readonly width?: number | string;
  readonly padding?: number;
  readonly children: ReactNode;
}

/**
 * A styled box with optional title and border
 */
export function StyledBox({
  title,
  titleColor = "cyan",
  borderColor = "gray",
  width = 60,
  padding = 1,
  children,
}: StyledBoxProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} width={width} paddingX={padding}>
      {title && (
        <Box marginBottom={1}>
          <Text bold color={titleColor}>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

export interface LabeledValueProps {
  readonly label: string;
  readonly value: string;
  readonly labelColor?: string;
  readonly valueColor?: string;
}

/**
 * A labeled value pair for displaying key-value data
 */
export function LabeledValue({ label, value, labelColor = "white", valueColor }: LabeledValueProps) {
  return (
    <Box>
      <Text bold color={labelColor}>
        {label}:{" "}
      </Text>
      <Text color={valueColor}>{value}</Text>
    </Box>
  );
}

export interface SectionHeaderProps {
  readonly text: string;
  readonly color?: string;
}

/**
 * A section header within a box
 */
export function SectionHeader({ text, color = "yellow" }: SectionHeaderProps) {
  return (
    <Box marginTop={1}>
      <Text bold color={color}>
        {text}
      </Text>
    </Box>
  );
}
