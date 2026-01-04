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

import { Effect } from 'effect';
import { AndroidImportServiceTag } from '../../infrastructure/android/android-import.service';
import { SyncServiceTag } from '../../domain/whatsapp/sync.service';

export interface ImportAndroidCommandOptions {
  readonly db: string;
  readonly limit?: number;
}

export const importAndroidCommand = (options: ImportAndroidCommandOptions) =>
  Effect.gen(function* () {
    const androidImport = yield* AndroidImportServiceTag;
    const syncService = yield* SyncServiceTag;

    console.log(`📱 Importing from Android msgstore.db...`);
    console.log(`   Database: ${options.db}`);
    if (options.limit) {
      console.log(`   Limit: ${options.limit} messages (test mode)`);
    }

    // Step 1: Read from msgstore.db and convert to WhatsApp format
    const whatsappData = yield* androidImport.importFromMsgstore(options.db, {
      limit: options.limit,
    });

    console.log(`\n✅ Import successful:`);
    console.log(`   • Messages: ${whatsappData.messages.length}`);
    console.log(`   • Chats: ${whatsappData.chats.length}`);

    // Step 2: Persist to local database using existing sync pipeline
    console.log(`\n🔄 Syncing to local database...`);
    const result = yield* syncService.syncFromData(whatsappData);

    console.log(`\n✅ Sync complete:`);
    console.log(`   • Contacts: ${result.contactsAdded}`);
    console.log(`   • Conversations: ${result.conversationsAdded}`);
    console.log(`   • Participants: ${result.participantsAdded}`);
    console.log(`   • Messages: ${result.messagesAdded}`);
    console.log(`   • Calls: ${result.callsAdded}`);
    console.log(`   • Synced at: ${result.syncedAt.toISOString()}`);
  });
