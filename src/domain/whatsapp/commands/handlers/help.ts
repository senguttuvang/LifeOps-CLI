/**
 * Help Command Handler
 *
 * Returns list of available commands
 */

import { Effect } from "effect";

export const handleHelp = (): Effect.Effect<string, never, never> => {
  const helpText = `
🤖 LifeOps Commands

@lifeops suggest [category]
  Get activity suggestions
  Example: @lifeops suggest outdoor

@lifeops analyze
  Relationship health report

@lifeops memory <query>
  Search your memories
  Example: @lifeops memory beach 2025

@lifeops draft <intent>
  Draft a message
  Example: @lifeops draft apology forgot dinner

@lifeops dashboard
  View health metrics (Slack /stats style)

@lifeops help
  Show this message
`.trim();

  return Effect.succeed(helpText);
};
