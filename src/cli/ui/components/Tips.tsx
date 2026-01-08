/**
 * Tips Component
 *
 * Random relationship tips display.
 * Replaces displayTip from relationship-output.ts.
 */

import { Box, Text } from "ink";

const TIPS = [
  // Classics
  "Remember: 'calm down' has never calmed anyone down in the history of relationships.",
  "Tip: When they say 'fine', the investigation has just begun.",
  "Pro tip: Listening without solving is a superpower. Use it wisely.",
  "Remember: Anniversary math - days late × 2 = recovery time in weeks.",
  "Tip: 'My ex used to...' is never a good way to start a sentence.",
  "Pro tip: When in doubt, food usually helps.",
  "Remember: The question 'Do I look fat in this?' has no correct answer.",
  "Tip: 'Whatever you want' means 'I have a specific preference but won't tell you'.",
  // Developer-themed
  "Debug tip: console.log('fine') always returns undefined.",
  "Remember: Relationships don't have rollbacks. Commit wisely.",
  "The 'k' response is the single-character equivalent of DEFCON 1.",
  "Tip: git blame won't help you here.",
  "Remember: There's no try-catch for feelings.",
  "Pro tip: You can't refactor your way out of this one.",
  "Warning: Emotional state is eventually consistent, not strongly consistent.",
  "Remember: Love is O(1), understanding is O(n²).",
  // Wisdom
  "Tip: Being right is less important than being kind.",
  "Remember: Feelings are features, not bugs.",
  "Pro tip: The 'space' they asked for isn't measured in pixels.",
  "Tip: Async communication requires await patience.",
] as const;

/**
 * Get a random tip
 */
function getRandomTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export interface TipProps {
  readonly tip?: string;
}

/**
 * Display a random tip
 */
export function Tip({ tip }: TipProps) {
  const displayTip = tip ?? getRandomTip();

  return (
    <Box marginY={1}>
      <Text dimColor>{displayTip}</Text>
    </Box>
  );
}

/**
 * Display a random tip with icon
 */
export function TipOfTheDay() {
  return (
    <Box marginY={1}>
      <Text dimColor>💡 {getRandomTip()}</Text>
    </Box>
  );
}
