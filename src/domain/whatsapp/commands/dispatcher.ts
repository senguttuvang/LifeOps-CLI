/**
 * Self-DM Command Dispatcher
 *
 * Routes parsed commands to appropriate handlers
 */

import { Effect } from "effect";
import type { ParsedCommand } from "./parser";
import { handleHelp } from "./handlers/help";
import { handleSuggest } from "./handlers/suggest";
import { handleAnalyze } from "./handlers/analyze";
import { handleMemory } from "./handlers/memory";
import { handleDraft } from "./handlers/draft";
import { handleDashboard } from "./handlers/dashboard";
import { AnalysisServiceTag } from "../../relationship/analysis.service";
import { VectorStoreService } from "../../../infrastructure/rag/vector.store";
import { AIServiceTag } from "../../../infrastructure/llm/ai.service";
import { DatabaseService } from "../../../infrastructure/db/client";

/**
 * Dispatch command to appropriate handler
 *
 * @param command - Parsed command
 * @param chatId - WhatsApp chat ID where command was received
 * @returns Effect that resolves to response string, requiring necessary services
 */
export const dispatchCommand = (
  command: ParsedCommand,
  chatId: string
): Effect.Effect<
  string,
  Error,
  | typeof AnalysisServiceTag
  | typeof VectorStoreService
  | typeof AIServiceTag
  | typeof DatabaseService
> => {
  switch (command.name) {
    case "help":
      return handleHelp();

    case "suggest":
      return handleSuggest(command.args, chatId);

    case "analyze":
      return handleAnalyze(chatId);

    case "memory":
      return handleMemory(command.args);

    case "draft":
      return handleDraft(command.args, chatId);

    case "dashboard":
      return handleDashboard(chatId);

    default:
      return Effect.succeed(
        `Unknown command: ${command.name}\n\nTry: @lifeops help`
      );
  }
};
