import { Command, Args } from "@effect/cli";
import { Effect, Console } from "effect";
import { AnalysisServiceTag } from "../../domain/relationship/analysis.service";

// Subcommand: Analyze
const AnalyzeCommand = Command.make(
  "analyze",
  {
    chatId: Args.text({ name: "chatId" }),
  },
  ({ chatId }) =>
    Effect.gen(function* (_) {
      const analysis = yield* _(AnalysisServiceTag);
      yield* _(Console.log(`Indexing chat: ${chatId}...`));
      yield* _(analysis.indexChat(chatId));
      
      yield* _(Console.log(`Analyzing chat: ${chatId}...`));

      const result = yield* _(analysis.analyze(chatId));

      yield* _(Console.log("\n--- Analysis Report ---\n"));
      yield* _(Console.log(result));
      yield* _(Console.log("\n-----------------------\n"));
    })
);

// Subcommand: Draft
const DraftCommand = Command.make(
  "draft",
  {
    chatId: Args.text({ name: "chatId" }),
    intent: Args.text({ name: "intent" }),
  },
  ({ chatId, intent }) =>
    Effect.gen(function* (_) {
      const analysis = yield* _(AnalysisServiceTag);
      yield* _(Console.log(`Drafting response for chat: ${chatId} with intent: "${intent}"...`));

      const result = yield* _(analysis.draftResponse(chatId, intent));

      yield* _(Console.log("\n--- Draft Response ---\n"));
      yield* _(Console.log(result));
      yield* _(Console.log("\n----------------------\n"));
    })
);

// Parent Command: Relationship
export const relationshipCommand = Command.make("relationship").pipe(
  Command.withSubcommands([AnalyzeCommand, DraftCommand])
);
