/**
 * Extract Signals CLI Command
 *
 * Extracts behavioral signals from user message history for RAG+Signals personalization.
 *
 * Usage:
 *   bun run cli extract-signals <userId>
 *   bun run cli extract-signals --refresh <userId>
 */

import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { SignalExtractionServiceTag } from "../../domain/signals/signal-extraction.service";

/**
 * Extract Signals Command
 *
 * Analyzes message history and computes behavioral signals for a user.
 */
export const extractSignalsCommand = Command.make(
  "extract-signals",
  {
    userId: Args.text({ name: "userId" }),
    refresh: Options.boolean("refresh").pipe(
      Options.withDescription("Force refresh signals even if they exist"),
      Options.withDefault(false),
    ),
  },
  ({ userId, refresh }) =>
    Effect.gen(function* () {
      const service = yield* SignalExtractionServiceTag;

      // Header
      yield* Console.log("╔════════════════════════════════════════════════════════════╗");
      yield* Console.log("║           Signal Extraction - RAG+Signals System          ║");
      yield* Console.log("╚════════════════════════════════════════════════════════════╝\n");

      yield* Console.log(`User ID: ${userId}`);
      yield* Console.log(`Mode: ${refresh ? "Force Refresh" : "Extract if missing"}\n`);

      // Check if signals already exist (unless refresh is true)
      if (!refresh) {
        const existing = yield* service.getSignals(userId);
        if (existing) {
          yield* Console.log("⚠️  Signals already exist for this user.");
          yield* Console.log(`   Last computed: ${existing.lastComputedAt.toISOString()}`);
          yield* Console.log(`   Message count: ${existing.messageCount}`);
          yield* Console.log(`   Confidence: ${(existing.confidence * 100).toFixed(1)}%\n`);
          yield* Console.log("   Use --refresh to recompute signals.\n");
          return;
        }
      }

      // Extract signals
      yield* Console.log("📊 Extracting behavioral signals...\n");

      const startTime = Date.now();
      const signals = yield* service.extractSignals(userId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Success header
      yield* Console.log("\n✅ Signal Extraction Complete");
      yield* Console.log(`   Duration: ${duration}s\n`);

      // Metadata
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Metadata                                                │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Messages analyzed: ${signals.messageCount.toString().padStart(7)}                                │`,
      );
      yield* Console.log(
        `│ Confidence score:  ${(signals.confidence * 100).toFixed(1).padStart(7)}%                               │`,
      );
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Response Patterns
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Response Patterns                                       │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Avg response time: ${signals.avgResponseTimeMinutes.toFixed(1).padStart(7)} minutes                         │`,
      );
      yield* Console.log(
        `│ Response p50:      ${signals.responseTimeP50.toFixed(1).padStart(7)} minutes                         │`,
      );
      yield* Console.log(
        `│ Response p95:      ${signals.responseTimeP95.toFixed(1).padStart(7)} minutes                         │`,
      );
      yield* Console.log(
        `│ Initiation rate:   ${(signals.initiationRate * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Message Structure
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Message Structure                                       │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Avg length:        ${signals.avgMessageLength.toFixed(0).padStart(7)} characters                        │`,
      );
      yield* Console.log(
        `│ Median length:     ${signals.medianMessageLength.toFixed(0).padStart(7)} characters                        │`,
      );
      yield* Console.log(
        `│ Std deviation:     ${signals.messageLengthStd.toFixed(0).padStart(7)} characters                        │`,
      );
      yield* Console.log(
        `│ Avg words/msg:     ${signals.avgWordsPerMessage.toFixed(1).padStart(7)} words                             │`,
      );
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Expression Style
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Expression Style (Emojis)                               │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Emojis per msg:    ${signals.emojiPerMessage.toFixed(2).padStart(7)}                                  │`,
      );
      yield* Console.log(
        `│ Top emoji:         ${signals.topEmojis[0]?.emoji || "N/A"}  (${((signals.topEmojis[0]?.frequency || 0) * 100).toFixed(1)}%)                            │`,
      );
      yield* Console.log(`│ Position:          ${getEmojiPositionLabel(signals.emojiPosition).padEnd(41)} │`);
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Punctuation
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Punctuation Patterns                                    │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Exclamation (!!):  ${(signals.exclamationRate * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log(
        `│ Question (??):     ${(signals.questionRate * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log(
        `│ Period (.):        ${(signals.periodRate * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log(
        `│ Ellipsis (...):    ${(signals.ellipsisRate * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Common Patterns
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Common Patterns                                         │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Greetings:         ${signals.commonGreetings.length.toString().padStart(7)} patterns                            │`,
      );
      if (signals.commonGreetings.length > 0) {
        yield* Console.log(
          `│   - "${signals.commonGreetings[0]}"${" ".repeat(Math.max(0, 41 - signals.commonGreetings[0].length))}│`,
        );
      }
      yield* Console.log(
        `│ Common phrases:    ${signals.commonPhrases.length.toString().padStart(7)} patterns                            │`,
      );
      if (signals.commonPhrases.length > 0) {
        yield* Console.log(
          `│   - "${signals.commonPhrases[0].phrase}" (${(signals.commonPhrases[0].frequency * 100).toFixed(1)}%)${" ".repeat(Math.max(0, 28 - signals.commonPhrases[0].phrase.length))}│`,
        );
      }
      yield* Console.log(
        `│ Filler words:      ${signals.fillerWords.length.toString().padStart(7)} words                              │`,
      );
      if (signals.fillerWords.length > 0) {
        yield* Console.log(
          `│   - ${signals.fillerWords.slice(0, 3).join(", ")}${" ".repeat(Math.max(0, 49 - signals.fillerWords.slice(0, 3).join(", ").length))}│`,
        );
      }
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      // Behavioral
      yield* Console.log("┌─────────────────────────────────────────────────────────┐");
      yield* Console.log("│ Behavioral Patterns                                     │");
      yield* Console.log("├─────────────────────────────────────────────────────────┤");
      yield* Console.log(
        `│ Asks questions:    ${(signals.asksFollowupQuestions * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log(
        `│ Voice notes:       ${(signals.usesVoiceNotes * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log(
        `│ Multi-send:        ${(signals.sendsMultipleMessages * 100).toFixed(1).padStart(7)}%                              │`,
      );
      yield* Console.log("└─────────────────────────────────────────────────────────┘\n");

      yield* Console.log("💾 Signals stored in database.");
      yield* Console.log("   Ready for use in RAG+Signals personalization.\n");
    }),
);

/**
 * Helper: Get emoji position label
 */
const getEmojiPositionLabel = (position: { start: number; middle: number; end: number }): string => {
  if (position.end > 0.6) {
    return `End (${(position.end * 100).toFixed(1)}%)`;
  }
  if (position.start > 0.6) {
    return `Start (${(position.start * 100).toFixed(1)}%)`;
  }
  if (position.middle > 0.4) {
    return `Middle (${(position.middle * 100).toFixed(1)}%)`;
  }
  return "Mixed";
};
