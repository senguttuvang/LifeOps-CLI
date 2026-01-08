/**
 * Decode Command
 *
 * The Fine Decoder(tm) - Decodes ambiguous relationship messages.
 *
 * Usage:
 *   bun run cli decode "I'm fine"
 *   bun run cli decode "It's okay"
 *   bun run cli decode "Whatever you want"
 *
 * Uses pattern matching and (optionally) message history context
 * to determine what "fine" actually means.
 */

import { Command, Args } from "@effect/cli";
import { Effect } from "effect";
import { Box, Text } from "ink";
import type { DecodedMeaning, FineResponse } from "../../domain/relationship/types";
import { FINE_PROBABILITY_DISTRIBUTION } from "../../domain/relationship/types";
import {
  InkRenderer,
  InkRendererLive,
  FineAnalysis,
  TipOfTheDay,
  Hint,
} from "../ui/index.js";

/**
 * Known ambiguous phrases and their base probabilities.
 * Each phrase has a default interpretation but context can shift it.
 */
const AMBIGUOUS_PATTERNS: Record<string, { base: DecodedMeaning; confidence: number }> = {
  fine: { base: "NOT_FINE_INVESTIGATE", confidence: 0.73 },
  "i'm fine": { base: "NOT_FINE_INVESTIGATE", confidence: 0.78 },
  "it's fine": { base: "FINAL_WARNING", confidence: 0.65 },
  okay: { base: "NOT_FINE_INVESTIGATE", confidence: 0.6 },
  ok: { base: "NOT_FINE_INVESTIGATE", confidence: 0.55 },
  k: { base: "FINAL_WARNING", confidence: 0.85 },
  nothing: { base: "SHOULD_ALREADY_KNOW", confidence: 0.7 },
  "nothing's wrong": { base: "SHOULD_ALREADY_KNOW", confidence: 0.82 },
  whatever: { base: "FINAL_WARNING", confidence: 0.75 },
  "whatever you want": { base: "TEST_IN_PROGRESS", confidence: 0.8 },
  "do whatever you want": { base: "TEST_IN_PROGRESS", confidence: 0.88 },
  sure: { base: "NOT_FINE_INVESTIGATE", confidence: 0.5 },
  "i guess": { base: "NOT_FINE_INVESTIGATE", confidence: 0.65 },
  "i don't care": { base: "SHOULD_ALREADY_KNOW", confidence: 0.72 },
  "it doesn't matter": { base: "SHOULD_ALREADY_KNOW", confidence: 0.68 },
  "you should know": { base: "SHOULD_ALREADY_KNOW", confidence: 0.95 },
  "if you say so": { base: "FINAL_WARNING", confidence: 0.7 },
  "we need to talk": { base: "FINAL_WARNING", confidence: 0.92 },
  interesting: { base: "NOT_FINE_INVESTIGATE", confidence: 0.6 },
  "that's interesting": { base: "NOT_FINE_INVESTIGATE", confidence: 0.65 },
};

/**
 * Danger signals that increase severity.
 */
const DANGER_SIGNALS = {
  punctuationThatChangesEverything: {
    ".": 0.15,
    "...": 0.1,
    "!": -0.05,
  },
  wordsThatMakeItWorse: {
    just: 0.1,
    really: -0.1,
    actually: -0.15,
    totally: 0.05,
  },
};

/**
 * Suggested actions based on decoded meaning
 */
const SUGGESTED_ACTIONS: Record<DecodedMeaning, readonly string[]> = {
  ACTUALLY_FINE: ["Accept at face value (this time)", "Say something nice anyway"],
  NOT_FINE_INVESTIGATE: [
    'Ask "What\'s wrong?" with eye contact',
    "Offer favorite snack/drink",
    "Be present without demanding answers",
    "Listen actively when they speak",
  ],
  FINAL_WARNING: [
    "Stop whatever you're doing",
    "Give full attention immediately",
    "Ask once, wait patiently for response",
    "Do NOT check your phone",
  ],
  SHOULD_ALREADY_KNOW: [
    "Think about recent actions/conversations",
    "Review calendar for forgotten events",
    "Apologize first, understand later",
    'Avoid asking "What did I do?"',
  ],
  TEST_IN_PROGRESS: [
    "Do NOT take the bait",
    "Express a genuine preference",
    'Avoid "I don\'t mind"',
    "Show that you care enough to decide",
  ],
};

/**
 * Prohibited actions for each meaning
 */
const PROHIBITED_ACTIONS: Record<DecodedMeaning, readonly string[]> = {
  ACTUALLY_FINE: [],
  NOT_FINE_INVESTIGATE: ["Accept 'fine' at face value", "Change the subject", "Make it about yourself"],
  FINAL_WARNING: ["Make jokes", 'Ask "What\'s wrong?" more than twice', "Sigh audibly", "Look at your phone"],
  SHOULD_ALREADY_KNOW: ["Ask what you did wrong", "Say you don't remember", "Bring up unrelated past issues"],
  TEST_IN_PROGRESS: ['Say "I don\'t care"', "Ask what they want instead", "Fail the test (by not deciding)"],
};

/**
 * Response windows in milliseconds
 */
const RESPONSE_WINDOWS: Record<DecodedMeaning, number> = {
  ACTUALLY_FINE: 30 * 60 * 1000,
  NOT_FINE_INVESTIGATE: 5 * 60 * 1000,
  FINAL_WARNING: 2 * 60 * 1000,
  SHOULD_ALREADY_KNOW: 60 * 1000,
  TEST_IN_PROGRESS: 30 * 1000,
};

/**
 * Analyze a message and return the decoded meaning
 * @public Exported for testing
 */
export function analyzeMessage(message: string): FineResponse {
  const normalized = message.toLowerCase().trim();

  let matchedPattern: { base: DecodedMeaning; confidence: number } | null = null;
  let matchedPhrase = "";

  for (const [phrase, analysis] of Object.entries(AMBIGUOUS_PATTERNS)) {
    if (normalized.includes(phrase)) {
      if (!matchedPattern || phrase.length > matchedPhrase.length) {
        matchedPattern = analysis;
        matchedPhrase = phrase;
      }
    }
  }

  if (!matchedPattern) {
    if (normalized.length < 10) {
      matchedPattern = { base: "NOT_FINE_INVESTIGATE", confidence: 0.4 };
    } else {
      matchedPattern = { base: "ACTUALLY_FINE", confidence: 0.3 };
    }
  }

  let { base: decoded, confidence } = matchedPattern;

  for (const [punct, adjustment] of Object.entries(DANGER_SIGNALS.punctuationThatChangesEverything)) {
    if (normalized.endsWith(punct)) {
      confidence = Math.min(0.97, confidence + adjustment);
      if (punct === "." && decoded === "NOT_FINE_INVESTIGATE") {
        decoded = "FINAL_WARNING";
      }
    }
  }

  for (const [modifier, adjustment] of Object.entries(DANGER_SIGNALS.wordsThatMakeItWorse)) {
    if (normalized.includes(modifier)) {
      confidence = Math.max(0.1, Math.min(0.97, confidence + adjustment));
    }
  }

  type LiteralType = "fine" | "okay" | "nothing" | "whatever" | "k" | "sure";
  let literal: LiteralType = "fine";
  if (normalized.includes("okay") || normalized.includes("ok")) literal = "okay";
  if (normalized.includes("nothing")) literal = "nothing";
  if (normalized.includes("whatever")) literal = "whatever";
  if (normalized === "k") literal = "k";
  if (normalized.includes("sure")) literal = "sure";

  return {
    literal,
    decoded,
    confidence,
    responseWindowMs: RESPONSE_WINDOWS[decoded],
    doNotDo: [...PROHIBITED_ACTIONS[decoded], "Say 'calm down'", "Use logic to explain why they shouldn't feel that way"],
    suggestedActions: SUGGESTED_ACTIONS[decoded],
  };
}

/**
 * Probability distribution display component
 */
function ProbabilityDistribution({ decoded }: { readonly decoded: DecodedMeaning }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>📊 "Fine" probability distribution:</Text>
      {Object.entries(FINE_PROBABILITY_DISTRIBUTION).map(([meaning, prob]) => {
        const bar = "█".repeat(Math.round(prob * 20));
        const isMatch = meaning === decoded;
        return (
          <Box key={meaning}>
            <Text>   {meaning.padEnd(25)} </Text>
            <Text color={isMatch ? "yellow" : "gray"}>{bar}</Text>
            <Text> {(prob * 100).toFixed(0)}%</Text>
            {isMatch && <Text color="yellow"> ← YOU ARE HERE</Text>}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Usage display component
 */
function UsageDisplay() {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text>Usage: bun run cli decode {"<message>"}</Text>
      <Text>Example: bun run cli decode "I'm fine"</Text>
      <Box marginTop={1}>
        <Hint>The Fine Decoder(tm) analyzes ambiguous messages to help you understand what they really mean.</Hint>
      </Box>
    </Box>
  );
}

/**
 * Full decode result display
 */
function DecodeResult({ result }: { readonly result: FineResponse }) {
  return (
    <Box flexDirection="column" gap={1}>
      <FineAnalysis result={result} />
      {result.literal === "fine" && <ProbabilityDistribution decoded={result.decoded} />}
      <TipOfTheDay />
      <Hint>Run 'bun run cli situation "{result.literal}"' to see historical context for similar messages.</Hint>
    </Box>
  );
}

/**
 * Decode Command - @effect/cli based with Ink UI
 */
export const decodeCommand = Command.make(
  "decode",
  {
    message: Args.text({ name: "message" }).pipe(Args.repeated),
  },
  ({ message }) =>
    Effect.gen(function* () {
      const renderer = yield* InkRenderer;
      const fullMessage = message.join(" ");

      if (!fullMessage || fullMessage.trim().length === 0) {
        yield* renderer.render(<UsageDisplay />);
        return;
      }

      const result = analyzeMessage(fullMessage);
      yield* renderer.render(<DecodeResult result={result} />);
    }).pipe(Effect.provide(InkRendererLive)),
);
