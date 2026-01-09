/**
 * FineAnalysis Component
 *
 * Displays the Fine Decoder(tm) analysis results.
 * Replaces displayFineAnalysis from relationship-output.ts.
 */

import { Box, Text } from "ink";
import { LabeledValue, SectionHeader, StyledBox } from "./StyledBox.js";

export type DecodedMeaning =
  | "ACTUALLY_FINE"
  | "NOT_FINE_INVESTIGATE"
  | "FINAL_WARNING"
  | "SHOULD_ALREADY_KNOW"
  | "TEST_IN_PROGRESS";

export interface FineResponse {
  readonly literal: string;
  readonly decoded: DecodedMeaning;
  readonly confidence: number;
  readonly responseWindowMs: number;
  readonly doNotDo: readonly string[];
  readonly suggestedActions: readonly string[];
}

/**
 * Format decoded meaning with color
 */
function DecodedText({ decoded }: { readonly decoded: DecodedMeaning }) {
  const formats: Record<DecodedMeaning, { text: string; color: string }> = {
    ACTUALLY_FINE: { text: "Actually fine (rare!)", color: "green" },
    NOT_FINE_INVESTIGATE: { text: "Not fine - investigate immediately", color: "yellow" },
    FINAL_WARNING: { text: "Final warning - proceed with extreme caution", color: "red" },
    SHOULD_ALREADY_KNOW: { text: "You should already know why", color: "red" },
    TEST_IN_PROGRESS: { text: "Test in progress - your response matters", color: "magenta" },
  };

  const format = formats[decoded];
  return (
    <Text color={format.color} bold={decoded === "SHOULD_ALREADY_KNOW"}>
      {format.text}
    </Text>
  );
}

/**
 * Format milliseconds to human-readable time
 */
function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)} hours`;
  return `${Math.round(ms / 86400000)} days`;
}

export interface FineAnalysisProps {
  readonly result: FineResponse;
}

/**
 * Full Fine Analysis display component
 */
export function FineAnalysis({ result }: FineAnalysisProps) {
  return (
    <StyledBox title="Fine Decoder(tm) Analysis" titleColor="magenta">
      <LabeledValue label="Literal" value={`"${result.literal}"`} />
      <Box>
        <Text bold>Decoded: </Text>
        <DecodedText decoded={result.decoded} />
      </Box>
      <LabeledValue label="Confidence" value={`${(result.confidence * 100).toFixed(1)}%`} />
      <LabeledValue label="Response Window" value={formatTime(result.responseWindowMs)} />

      <SectionHeader text="DO NOT:" color="red" />
      {result.doNotDo.map((item, i) => (
        <Box key={i}>
          <Text color="red"> ✗ </Text>
          <Text>{item}</Text>
        </Box>
      ))}

      <SectionHeader text="SUGGESTED:" color="green" />
      {result.suggestedActions.map((item, i) => (
        <Box key={i}>
          <Text color="green"> ✓ </Text>
          <Text>{item}</Text>
        </Box>
      ))}
    </StyledBox>
  );
}
