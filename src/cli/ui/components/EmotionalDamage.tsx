/**
 * EmotionalDamage Component
 *
 * Error display with recovery steps for relationship errors.
 * Replaces displayEmotionalDamage from relationship-output.ts.
 */

import { Box, Text } from "ink";
import { StyledBox } from "./StyledBox.js";

export type RelationshipErrorTag =
  | "Relationship/ForgotAnniversaryError"
  | "Relationship/SaidCalmDownError"
  | "Relationship/LeftOnReadError"
  | "Relationship/ComparedToExError"
  | "Relationship/TriedToFixError"
  | "Relationship/UsedLogicOnFeelingsError";

export interface RelationshipError {
  readonly _tag: RelationshipErrorTag;
  readonly message: string;
  readonly suggestedBudget?: number;
  readonly canDoubleText?: boolean;
}

/**
 * Get recovery steps based on error type
 */
function getRecoverySteps(error: RelationshipError): readonly string[] {
  switch (error._tag) {
    case "Relationship/ForgotAnniversaryError":
      return [
        "Do NOT make excuses",
        "Acknowledge the hurt caused",
        `Plan makeup celebration (budget: Rs ${error.suggestedBudget ?? 5000})`,
        "Set up redundant reminders for next time",
      ];
    case "Relationship/SaidCalmDownError":
      return [
        "Stop talking immediately",
        "Wait for them to speak first",
        "Listen without defending",
        "Flowers (optional but recommended)",
      ];
    case "Relationship/LeftOnReadError":
      return [
        "Do NOT double text (yet)",
        "Wait at least 2 hours",
        "If anxiety persists, distract yourself",
        error.canDoubleText
          ? "One follow-up allowed now"
          : "Wait longer before follow-up",
      ];
    case "Relationship/ComparedToExError":
      return [
        "Apologize immediately",
        "Explain what you meant (briefly)",
        "Affirm current relationship",
        "Never do this again",
      ];
    case "Relationship/TriedToFixError":
      return [
        "Stop offering solutions",
        'Say: "That sounds really hard"',
        "Ask if they want help or just listening",
        "Remember: feelings first, solutions later",
      ];
    case "Relationship/UsedLogicOnFeelingsError":
      return [
        "Validate their feelings first",
        "Logic can come later (much later)",
        "Feelings don't need to make sense",
        "Empathy > accuracy",
      ];
    default:
      return [
        "Reflect on what went wrong",
        "Apologize sincerely",
        "Learn for next time",
      ];
  }
}

export interface EmotionalDamageProps {
  readonly error: RelationshipError;
}

/**
 * Display relationship error with recovery steps
 */
export function EmotionalDamage({ error }: EmotionalDamageProps) {
  const recoverySteps = getRecoverySteps(error);
  const errorName = error._tag.replace("Relationship/", "");

  return (
    <Box marginY={1}>
      <StyledBox title="Incident Report" borderColor="red" width={70}>
        <Text color="red" bold>
          EMOTIONAL DAMAGE
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Error: </Text>
            <Text>{errorName}</Text>
          </Box>
          <Box>
            <Text bold>Message: </Text>
            <Text>{error.message}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Recovery steps:</Text>
          {recoverySteps.map((step, i) => (
            <Text key={i}>
              {"  "}
              {i + 1}. {step}
            </Text>
          ))}
        </Box>
      </StyledBox>
    </Box>
  );
}
