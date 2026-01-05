/**
 * Auto-Draft Monitor
 *
 * Monitors incoming messages from girlfriend and automatically generates
 * response drafts, sending them to user's self-DM
 *
 * Use Case: Boyfriend receives message from girlfriend while working.
 * System auto-generates draft, sends to his self-DM. He can copy/paste,
 * modify, or ignore.
 */

import { Effect, Schedule } from "effect";
import { WhatsAppServiceTag } from "../../../infrastructure/whatsapp/whatsapp.client";
import { AnalysisServiceTag } from "../../relationship/analysis.service";
import { DatabaseService } from "../../../infrastructure/db/client";
import { sql } from "drizzle-orm";

export interface AutoDraftConfig {
  /**
   * Girlfriend's chat JID
   * Format: "919876543210@s.whatsapp.net"
   */
  girlfriendChatId: string;

  /**
   * User's self-DM chat JID (for sending drafts)
   * Format: "919876543210@s.whatsapp.net"
   */
  selfChatId: string;

  /**
   * Girlfriend's display name (for draft messages)
   */
  girlfriendName: string;

  /**
   * Polling interval in seconds
   * Default: 30 seconds (balance between responsiveness and resource usage)
   */
  pollIntervalSeconds?: number;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Monitor girlfriend's chat and auto-generate drafts
 *
 * This service polls the girlfriend's chat for new messages. When a new
 * message is detected, it:
 * 1. Analyzes the message content
 * 2. Generates a response draft using RAG + AI
 * 3. Sends the draft to user's self-DM
 *
 * @param config - Auto-draft configuration
 * @returns Effect that runs indefinitely (until interrupted)
 *
 * @example
 * const program = monitorAutoDraft({
 *   girlfriendChatId: "919876543210@s.whatsapp.net",
 *   selfChatId: "919123456789@s.whatsapp.net",
 *   girlfriendName: "Priya",
 *   pollIntervalSeconds: 30,
 * });
 *
 * await Effect.runPromise(
 *   program.pipe(Effect.provide(MainLive))
 * );
 */
export const monitorAutoDraft = (config: AutoDraftConfig) => {
  const pollInterval = config.pollIntervalSeconds ?? 30;
  let lastProcessedTimestamp = Date.now();

  const pollOnce = Effect.gen(function* () {
    const whatsapp = yield* WhatsAppServiceTag;
    const analysis = yield* AnalysisServiceTag;
    const db = yield* DatabaseService;

    if (config.verbose) {
      console.log(`[AutoDraft] Polling for new messages from ${config.girlfriendName}...`);
    }

    // Sync recent messages from girlfriend's chat
    const syncResult = yield* whatsapp.syncMessages({
      days: 1,
      chatJid: config.girlfriendChatId,
    });

    // Filter messages that are:
    // 1. From girlfriend's chat
    // 2. Not from me (i.e., from her)
    // 3. Newer than last processed timestamp
    const newMessages = syncResult.messages.filter((msg) => {
      const isGirlfriendChat = msg.chatJid === config.girlfriendChatId;
      const fromHer = !msg.isFromMe;
      const isNew = msg.timestamp * 1000 > lastProcessedTimestamp;

      return isGirlfriendChat && fromHer && isNew;
    });

    if (newMessages.length > 0 && config.verbose) {
      console.log(`[AutoDraft] Found ${newMessages.length} new message(s) from ${config.girlfriendName}`);
    }

    // Process each new message
    for (const message of newMessages) {
      if (config.verbose) {
        console.log(`[AutoDraft] Processing message: "${message.text?.substring(0, 50)}..."`);
      }

      // Skip media-only messages (no text to analyze)
      if (!message.text) {
        if (config.verbose) {
          console.log(`[AutoDraft] Skipping media-only message`);
        }
        lastProcessedTimestamp = message.timestamp * 1000;
        continue;
      }

      try {
        // Generate draft response
        // Intent: "respond to: <her message>"
        const draft = yield* analysis.draftResponse(
          config.girlfriendChatId,
          `respond to: ${message.text}`
        );

        // Format draft message for self-DM
        const draftMessage = formatDraftMessage(
          config.girlfriendName,
          message.text,
          draft
        );

        // Send draft to self-DM
        yield* whatsapp.sendMessage({
          to: config.selfChatId,
          content: draftMessage,
        });

        if (config.verbose) {
          console.log(`[AutoDraft] Sent draft to self-DM`);
        }

        // Log draft generation (optional: store in database for analytics)
        yield* logDraftGeneration(db, {
          girlfriendChatId: config.girlfriendChatId,
          incomingMessage: message.text,
          generatedDraft: draft,
          timestamp: new Date(),
        });

        // Update last processed timestamp
        lastProcessedTimestamp = message.timestamp * 1000;
      } catch (error) {
        console.error(`[AutoDraft] Error generating draft:`, error);
        // Continue processing other messages even if one fails
        lastProcessedTimestamp = message.timestamp * 1000;
      }
    }

    // If no new messages, update timestamp anyway to prevent re-processing
    if (newMessages.length === 0) {
      lastProcessedTimestamp = Date.now();
    }
  });

  // Poll indefinitely with error handling
  return Effect.repeat(
    pollOnce.pipe(
      Effect.catchAll((error) => {
        console.error(`[AutoDraft] Error during polling:`, error);
        // Return success to continue polling despite errors
        return Effect.void;
      })
    ),
    Schedule.spaced(`${pollInterval} seconds`)
  ).pipe(Effect.asVoid);
};

/**
 * Format draft message for self-DM
 */
const formatDraftMessage = (
  girlfriendName: string,
  incomingMessage: string,
  draft: string
): string => {
  const truncatedIncoming =
    incomingMessage.length > 100
      ? incomingMessage.substring(0, 100) + "..."
      : incomingMessage;

  return `💬 Draft reply to ${girlfriendName}:

${draft}

━━━━━━━━━━━━━━━━━━━━━━━━
📩 Reply to:
"${truncatedIncoming}"

💡 Tap to copy, modify, or ignore
━━━━━━━━━━━━━━━━━━━━━━━━`;
};

/**
 * Log draft generation for analytics
 * (Optional: helps track how often auto-draft is used)
 */
const logDraftGeneration = (
  db: DatabaseService,
  data: {
    girlfriendChatId: string;
    incomingMessage: string;
    generatedDraft: string;
    timestamp: Date;
  }
) =>
  Effect.tryPromise({
    try: async () => {
      // Store in a simple log table for analytics
      // (Table creation would be in schema.ts)
      await db.run(sql`
        INSERT INTO auto_draft_log (
          chat_id,
          incoming_message,
          generated_draft,
          created_at
        ) VALUES (
          ${data.girlfriendChatId},
          ${data.incomingMessage},
          ${data.generatedDraft},
          ${data.timestamp.toISOString()}
        )
      `);
    },
    catch: (e) => {
      // Log error but don't fail the whole process
      console.error("Failed to log draft generation:", e);
      return new Error(`Failed to log draft: ${e}`);
    },
  }).pipe(
    // Ignore errors in logging - it's not critical
    Effect.catchAll(() => Effect.void)
  );
