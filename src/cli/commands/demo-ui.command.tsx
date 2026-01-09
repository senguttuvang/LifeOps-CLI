/**
 * Demo UI Command
 *
 * Demonstrates Ink UI components integration with @effect/cli.
 * Run with: bun run cli demo-ui
 */

import { Command } from "@effect/cli";
import { Effect } from "effect";
import { Box, Text } from "ink";
import {
  FineAnalysis,
  type FineResponse,
  HealthDashboard,
  InkRenderer,
  InkRendererLive,
  type Memory,
  MemoryList,
  type RelationshipHealthMetrics,
  Success,
  TipOfTheDay,
} from "../ui/index.js";

/**
 * Demo data
 */
const mockFineResponse: FineResponse = {
  literal: "I'm fine",
  decoded: "NOT_FINE_INVESTIGATE",
  confidence: 0.87,
  responseWindowMs: 300000, // 5 minutes
  doNotDo: ["Ask 'what's wrong' repeatedly", "Say 'you're overreacting'", "Try to fix it immediately"],
  suggestedActions: ["Acknowledge something seems off", "Offer to listen without judgment", "Give space if needed"],
};

const mockHealthMetrics: RelationshipHealthMetrics = {
  communicationScore: 72,
  qualityTimeScore: 85,
  surpriseFactor: 45,
  memoryAccuracy: 68,
  dramaFreeStreak: 12,
  lastSync: new Date(),
};

const mockMemories: Memory[] = [
  { content: "She loves tulips, not roses", category: "preference", mentionedAt: new Date("2024-02-14") },
  { content: "Anniversary is March 15th", category: "date", mentionedAt: new Date("2024-01-01") },
  { content: "Don't mention her mother's cooking", category: "boundary", mentionedAt: new Date("2024-03-20") },
];

/**
 * Demo all UI components
 */
function DemoApp() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        === LifeOps CLI Ink UI Demo ===
      </Text>

      <Success>Ink UI components loaded successfully!</Success>

      <FineAnalysis result={mockFineResponse} />

      <HealthDashboard metrics={mockHealthMetrics} />

      <MemoryList memories={mockMemories} />

      <TipOfTheDay />
    </Box>
  );
}

/**
 * Demo UI command handler
 */
const handler = Effect.gen(function* () {
  const renderer = yield* InkRenderer;

  // Render all components
  yield* renderer.render(<DemoApp />);

  // Demo spinner with async operation
  yield* Effect.log("Demo complete!");
});

/**
 * Demo UI command definition
 */
export const demoUiCommand = Command.make("demo-ui", {}, () => handler.pipe(Effect.provide(InkRendererLive)));
