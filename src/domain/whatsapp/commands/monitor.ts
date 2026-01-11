/**
 * Self-DM Command Monitor
 *
 * Monitors self-DM chat for new commands and processes them
 */

import { Effect, Schedule } from "effect";
// Import from domain ports (not directly from infrastructure)
import { WhatsAppServiceTag } from "../../ports";
import { dispatchCommand } from "./dispatcher";
import { parseCommand } from "./parser";

export interface MonitorConfig {
  /**
   * Self-DM chat JID (user's own phone number)
   * Format: "1234567890@s.whatsapp.net"
   */
  selfChatId: string;

  /**
   * Polling interval in seconds
   * Default: 5 seconds
   */
  pollIntervalSeconds?: number;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Monitor self-DM for commands
 *
 * This service polls the self-DM chat every N seconds, detects @lifeops commands,
 * dispatches them to handlers, and sends responses back to the self-DM.
 *
 * @param config - Monitor configuration
 * @returns Effect that runs indefinitely (until interrupted)
 *
 * @example
 * const program = monitorSelfDM({
 *   selfChatId: "1234567890@s.whatsapp.net",
 *   pollIntervalSeconds: 5,
 * });
 *
 * await Effect.runPromise(
 *   program.pipe(Effect.provide(WhatsAppServiceLive))
 * );
 */
export const monitorSelfDM = (config: MonitorConfig) => {
  const pollInterval = config.pollIntervalSeconds ?? 5;
  let lastProcessedTimestamp = Date.now();

  const pollOnce = Effect.gen(function* () {
    const whatsapp = yield* WhatsAppServiceTag;

    // Log polling attempt
    if (config.verbose) {
      console.log(`[Monitor] Polling for new messages...`);
    }

    // Sync recent messages (last 1 day to catch recent messages)
    const syncResult = yield* whatsapp.syncMessages({
      days: 1,
      chatJid: config.selfChatId,
    });

    // Filter messages that are:
    // 1. In self-DM chat
    // 2. Not from me (sent by me TO myself)
    // 3. Newer than last processed timestamp
    const newMessages = syncResult.messages.filter((msg) => {
      const isSelfDM = msg.chatJid === config.selfChatId;
      const notFromMe = !msg.isFromMe;
      const isNew = msg.timestamp * 1000 > lastProcessedTimestamp;

      return isSelfDM && notFromMe && isNew;
    });

    if (config.verbose && newMessages.length > 0) {
      console.log(`[Monitor] Found ${newMessages.length} new messages`);
    }

    // Process each new message
    for (const message of newMessages) {
      // Parse command
      const command = parseCommand(message.text || "");

      if (!command) {
        // Not a command, skip
        if (config.verbose) {
          console.log(`[Monitor] Skipping non-command message: ${message.id}`);
        }
        continue;
      }

      if (config.verbose) {
        console.log(`[Monitor] Processing command: ${command.name} with args: "${command.args}"`);
      }

      // Dispatch command
      const response = yield* dispatchCommand(command, config.selfChatId);

      // Send response back to self-DM
      yield* whatsapp.sendMessage({
        to: config.selfChatId,
        content: response,
      });

      if (config.verbose) {
        console.log(`[Monitor] Sent response for command: ${command.name}`);
      }

      // Update last processed timestamp
      lastProcessedTimestamp = message.timestamp * 1000;
    }

    // If no new messages, update timestamp anyway to prevent re-processing
    if (newMessages.length === 0) {
      lastProcessedTimestamp = Date.now();
    }
  });

  // Poll indefinitely with exponential backoff on errors
  return Effect.repeat(
    pollOnce.pipe(
      Effect.catchAll((error) => {
        console.error(`[Monitor] Error during polling:`, error);
        // Return success to continue polling despite errors
        return Effect.void;
      }),
    ),
    Schedule.spaced(`${pollInterval} seconds`),
  ).pipe(Effect.asVoid);
};
