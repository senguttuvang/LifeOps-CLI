/**
 * Sync Command
 *
 * Syncs WhatsApp messages from the Go CLI to local SQLite database.
 * Usage: bun run cli sync [--days 30]
 */

import { Command, Options } from "@effect/cli";
import { Effect, Console } from "effect";
import { SyncServiceTag } from "../../domain/whatsapp/sync.service";

/**
 * Sync Command - @effect/cli based
 *
 * Syncs WhatsApp messages via QR code authentication.
 * First sync gets ALL message history, subsequent syncs get only new messages.
 */
export const syncCommand = Command.make(
  "sync",
  {
    days: Options.integer("days").pipe(
      Options.withDescription("Number of days to sync (default: 30)"),
      Options.withDefault(30),
    ),
  },
  ({ days }) =>
    Effect.gen(function* () {
      const syncService = yield* SyncServiceTag;

      yield* Console.log(`🔄 Syncing WhatsApp messages from last ${days} days...`);

      const result = yield* syncService.syncMessages({ days });

      yield* Console.log(`\n✅ Sync complete:`);
      yield* Console.log(`   • Contacts: ${result.contactsAdded}`);
      yield* Console.log(`   • Conversations: ${result.conversationsAdded}`);
      yield* Console.log(`   • Messages: ${result.messagesAdded}`);
      yield* Console.log(`   • Calls: ${result.callsAdded}`);
      yield* Console.log(`   • Synced at: ${result.syncedAt.toISOString()}`);
    }),
);
