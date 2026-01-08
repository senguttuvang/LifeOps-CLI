/**
 * Spinner Component
 *
 * Loading spinner with customizable messages.
 * Wraps ink-spinner with relationship-themed loading messages.
 */

import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";

/**
 * Relationship-themed loading messages
 */
const LOADING_MESSAGES = [
  // Pattern analysis
  "Analyzing if 'k' means 'okay' or 'I'm furious'...",
  "Calculating probability that 'fine' means fine (spoiler: 3%)...",
  "Scanning for horsemen of the relationship apocalypse...",
  "Checking if you've turned toward her bids lately...",
  "Detecting love language mismatches...",
  "Reviewing evidence for 'You never listen'...",
  "Searching memory banks for 'She mentioned this 3 weeks ago'...",
  "Analyzing emoji-to-word ratio...",
  // Technical humor
  "Decrypting emotional subtext...",
  "Parsing passive-aggressive punctuation...",
  "Calibrating thoughtfulness sensors...",
  "Querying the 'What did I do wrong?' database...",
  "Computing optimal apology parameters...",
  "SELECT * FROM memories WHERE forgotten = true;",
  "Running garbage collection on excuses...",
  "Executing relationship_health.check()...",
] as const;

/**
 * Get a random loading message
 */
function getRandomMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

export interface SpinnerProps {
  readonly message?: string;
  readonly useRandomMessage?: boolean;
  readonly color?: string;
}

/**
 * A loading spinner with optional message
 */
export function Spinner({
  message,
  useRandomMessage = false,
  color = "cyan",
}: SpinnerProps) {
  const displayMessage = message ?? (useRandomMessage ? getRandomMessage() : "Loading...");

  return (
    <Box>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      <Text dimColor> {displayMessage}</Text>
    </Box>
  );
}

export interface TaskSpinnerProps {
  readonly task: string;
  readonly status: "running" | "success" | "error";
}

/**
 * A task spinner that shows completion status
 */
export function TaskSpinner({ task, status }: TaskSpinnerProps) {
  return (
    <Box>
      {status === "running" && (
        <Text color="cyan">
          <InkSpinner type="dots" />
        </Text>
      )}
      {status === "success" && <Text color="green">✓</Text>}
      {status === "error" && <Text color="red">✗</Text>}
      <Text> {task}</Text>
    </Box>
  );
}
