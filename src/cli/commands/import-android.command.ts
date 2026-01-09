/**
 * Android Import Command
 *
 * Imports WhatsApp data from Android msgstore.db backup (Android-only format)
 *
 * PLATFORM NOTES:
 * - Android users: Use this command to import historical WhatsApp backup
 * - iPhone users: Use 'bun run cli sync' instead (WhatsApp Web via QR code)
 *
 * Usage: bun run cli import-android --db="/path/to/msgstore.db" [--limit=1000]
 *
 * Why "android" in the name? Because msgstore.db is Android's SQLite backup format.
 * iOS uses encrypted iTunes/iCloud backups which require a different import approach.
 */

import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { SyncServiceTag } from "../../domain/whatsapp/sync.service";
import { AndroidImportServiceTag } from "../../infrastructure/android/android-import.service";

/**
 * Import Android Command - @effect/cli based
 *
 * Imports WhatsApp data from Android msgstore.db backup.
 */
export const importAndroidCommand = Command.make(
  "import-android",
  {
    db: Options.text("db").pipe(Options.withDescription("Path to msgstore.db file")),
    limit: Options.integer("limit").pipe(
      Options.withDescription("Limit number of messages to import (for testing)"),
      Options.optional,
    ),
  },
  ({ db, limit }) =>
    Effect.gen(function* () {
      const androidImport = yield* AndroidImportServiceTag;
      const syncService = yield* SyncServiceTag;

      yield* Console.log(`📱 Importing from Android msgstore.db...`);
      yield* Console.log(`   Database: ${db}`);
      if (limit._tag === "Some") {
        yield* Console.log(`   Limit: ${limit.value} messages (test mode)`);
      }

      // Step 1: Read from msgstore.db and convert to WhatsApp format
      const whatsappData = yield* androidImport.importFromMsgstore(db, {
        limit: limit._tag === "Some" ? limit.value : undefined,
      });

      yield* Console.log(`\n✅ Import successful:`);
      yield* Console.log(`   • Messages: ${whatsappData.messages.length}`);
      yield* Console.log(`   • Chats: ${whatsappData.chats.length}`);

      // Step 2: Persist to local database using existing sync pipeline
      yield* Console.log(`\n🔄 Syncing to local database...`);
      const result = yield* syncService.syncFromData(whatsappData);

      yield* Console.log(`\n✅ Sync complete:`);
      yield* Console.log(`   • Contacts: ${result.contactsAdded}`);
      yield* Console.log(`   • Conversations: ${result.conversationsAdded}`);
      yield* Console.log(`   • Participants: ${result.participantsAdded}`);
      yield* Console.log(`   • Messages: ${result.messagesAdded}`);
      yield* Console.log(`   • Calls: ${result.callsAdded}`);
      yield* Console.log(`   • Synced at: ${result.syncedAt.toISOString()}`);
    }),
);
