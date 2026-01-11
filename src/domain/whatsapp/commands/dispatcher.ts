/**
 * Self-DM Command Dispatcher
 *
 * Routes parsed commands to appropriate handlers
 */

import { Effect } from "effect";
// Import from domain ports (not directly from infrastructure)
import type { AIServiceTag, DatabaseService, VectorStoreService } from "../../ports";
import type { AnalysisServiceTag } from "../../relationship/analysis.service";
import { handleAnalyze } from "./handlers/analyze";
import { handleDashboard } from "./handlers/dashboard";
import { handleDraft } from "./handlers/draft";
import { handleHelp } from "./handlers/help";
import { handleMemory } from "./handlers/memory";
import { handleSuggest } from "./handlers/suggest";
import type { ParsedCommand } from "./parser";

/**
 * Dispatch command to appropriate handler
 *
 * @param command - Parsed command
 * @param chatId - WhatsApp chat ID where command was received
 * @returns Effect that resolves to response string, requiring necessary services
 */
export const dispatchCommand = (
  command: ParsedCommand,
  chatId: string,
): Effect.Effect<
  string,
  Error,
  typeof AnalysisServiceTag | typeof VectorStoreService | typeof AIServiceTag | typeof DatabaseService
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
      return Effect.succeed(`Unknown command: ${command.name}\n\nTry: @lifeops help`);
  }
};
