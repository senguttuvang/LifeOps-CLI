/**
 * Sync Command
 *
 * Syncs WhatsApp messages from the Go CLI to local SQLite database.
 * Usage: bun run cli sync [--days 30]
 */

import { Effect } from "effect";
import { SyncServiceTag } from "../../domain/whatsapp/sync.service";

export interface SyncCommandOptions {
  readonly days?: number;
}

export const syncCommand = (options: SyncCommandOptions = {}) =>
  Effect.gen(function* () {
    const syncService = yield* SyncServiceTag;

    const days = options.days || 30;
    console.log(`🔄 Syncing WhatsApp messages from last ${days} days...`);

    const result = yield* syncService.syncMessages({ days });

    console.log(`\n✅ Sync complete:`);
    console.log(`   • Contacts: ${result.contactsAdded}`);
    console.log(`   • Conversations: ${result.conversationsAdded}`);
    console.log(`   • Messages: ${result.messagesAdded}`);
    console.log(`   • Calls: ${result.callsAdded}`);
    console.log(`   • Synced at: ${result.syncedAt.toISOString()}`);
  });
