/**
 * Android Import Service
 *
 * Reads WhatsApp backup from Android msgstore.db and converts to WhatsAppSyncResult format
 * that can be processed by the existing WhatsAppAdapter.
 *
 * PLATFORM COMPATIBILITY:
 * - ✅ Android: msgstore.db is Android's SQLite backup format (this service)
 * - ❌ iPhone: iOS uses encrypted iTunes/iCloud backups (different format, not yet implemented)
 * - ✅ Both: For live sync, use whatsmeow (QR code scanning) which works for both platforms
 *
 * msgstore.db schema (Android-specific):
 * - message table: chat_row_id, sender_jid_row_id, from_me, timestamp, message_type, text_data
 * - chat table: _id, jid_row_id, subject, archived, sort_timestamp
 * - jid table: _id, user, server, raw_string (reconstructed JID)
 *
 * NOTE: The name "android-import" is intentional and accurate - this imports Android backup files.
 * For iPhone/iOS users, use the 'sync' command which works via QR code (WhatsApp Web protocol).
 */

import { Effect, Context, Layer } from 'effect';
import { Database } from 'bun:sqlite';
import type { WhatsAppSyncResult, WhatsAppMessageData, WhatsAppChatData } from '../whatsapp/whatsapp.types';

/**
 * Android message row from msgstore.db
 */
interface AndroidMessage {
  _id: number;
  chat_row_id: number;
  sender_jid_row_id: number;
  from_me: number; // 0 or 1
  key_id: string;
  timestamp: number; // milliseconds
  message_type: number; // Android type codes
  text_data: string | null;
  starred: number; // 0 or 1
}

/**
 * Android chat row from msgstore.db
 */
interface AndroidChat {
  _id: number;
  jid_row_id: number;
  subject: string | null;
  archived: number; // 0 or 1
  sort_timestamp: number; // milliseconds
}

/**
 * Android JID row from msgstore.db
 */
interface AndroidJid {
  _id: number;
  user: string;
  server: string;
  raw_string: string;
}

/**
 * Android group participant row from msgstore.db
 */
interface AndroidGroupParticipant {
  gjid: number; // Group JID row ID
  jid: number; // Participant JID row ID
  admin: number; // 0 = member, 1 = admin
}

/**
 * Service interface
 */
export interface AndroidImportService {
  /**
   * Import messages from Android msgstore.db and convert to WhatsApp format
   */
  readonly importFromMsgstore: (
    dbPath: string,
    options?: { limit?: number }
  ) => Effect.Effect<WhatsAppSyncResult, Error>;
}

export class AndroidImportServiceTag extends Context.Tag('AndroidImportService')<
  AndroidImportServiceTag,
  AndroidImportService
>() {}

/**
 * Live implementation
 */
export const AndroidImportServiceLive = Layer.succeed(
  AndroidImportServiceTag,
  (() => {
    /**
     * Map Android message_type codes to WhatsApp messageType enum
     *
     * Based on analysis of msgstore.db:
     * - 0: Text message (77k)
     * - 1: Image (40k)
     * - 2: Video
     * - 3: Audio (3k)
     * - 4: Document
     * - 7: Group notification/system message (58k)
     * - 15: Deleted message (6k)
     * - Others: Sticker, location, contact, etc.
     */
    const mapMessageType = (androidType: number): WhatsAppMessageData['messageType'] => {
      switch (androidType) {
        case 0:
          return 'text';
        case 1:
          return 'image';
        case 2:
          return 'video';
        case 3:
        case 9: // Voice note
          return 'audio';
        case 4:
        case 5: // PDF
          return 'document';
        case 20:
          return 'sticker';
        case 28:
          return 'location';
        case 30:
          return 'contact';
        default:
          // For system messages (type 7), deleted (15), etc., treat as text
          return 'text';
      }
    };

    const importFromMsgstore = (
      dbPath: string,
      options: { limit?: number } = {}
    ): Effect.Effect<WhatsAppSyncResult, Error> =>
      Effect.gen(function* () {
        const db = new Database(dbPath, { readonly: true });

        try {
          // Step 1: Load JID lookup table (jid_row_id -> raw_string)
          const jids = db
            .prepare('SELECT _id, raw_string FROM jid')
            .all() as AndroidJid[];

          const jidMap = new Map<number, string>();
          for (const jid of jids) {
            jidMap.set(jid._id, jid.raw_string);
          }

          console.log(`   • Loaded ${jids.length} JID mappings`);

          // Step 2: Load group participants (if table exists)
          const groupParticipantsMap = new Map<number, string[]>(); // chat._id → participant JIDs
          try {
            const participantRows = db
              .prepare(
                `SELECT gjid, jid, admin
                 FROM group_participants`
              )
              .all() as AndroidGroupParticipant[];

            for (const participant of participantRows) {
              const participantJid = jidMap.get(participant.jid);
              if (participantJid) {
                const existing = groupParticipantsMap.get(participant.gjid) || [];
                existing.push(participantJid);
                groupParticipantsMap.set(participant.gjid, existing);
              }
            }

            console.log(`   • Loaded ${participantRows.length} group participant memberships`);
          } catch (e) {
            // group_participants table might not exist in all msgstore.db versions
            console.log(`   • No group_participants table found (skipping)`);
          }

          // Step 3: Load chats
          const chatRows = db
            .prepare(
              `SELECT c._id, c.jid_row_id, c.subject, c.archived, c.sort_timestamp
               FROM chat c
               WHERE c.jid_row_id IS NOT NULL`
            )
            .all() as AndroidChat[];

          const chats: WhatsAppChatData[] = chatRows.map((chat) => {
            const jid = jidMap.get(chat.jid_row_id);
            if (!jid) {
              throw new Error(`Missing JID for chat ${chat._id}`);
            }

            const participants = groupParticipantsMap.get(chat.jid_row_id);

            return {
              jid,
              name: chat.subject || undefined,
              isGroup: jid.includes('@g.us'),
              lastMessageTime: chat.sort_timestamp,
              unreadCount: 0,
              participants, // May be undefined for 1:1 chats or if no participants found
            };
          });

          console.log(`   • Loaded ${chats.length} chats`);

          // Step 4: Load messages
          const limit = options.limit || 1000000; // Default: all messages
          const messageRows = db
            .prepare(
              `SELECT
                 m._id,
                 m.chat_row_id,
                 m.sender_jid_row_id,
                 m.from_me,
                 m.key_id,
                 m.timestamp,
                 m.message_type,
                 m.text_data,
                 m.starred
               FROM message m
               WHERE m.key_id IS NOT NULL
               ORDER BY m.timestamp ASC
               LIMIT ?`
            )
            .all(limit) as AndroidMessage[];

          console.log(`   • Loaded ${messageRows.length} messages`);

          // Step 4: Create chat_row_id -> jid mapping
          const chatIdToJid = new Map<number, string>();
          for (const chat of chatRows) {
            const jid = jidMap.get(chat.jid_row_id);
            if (jid) {
              chatIdToJid.set(chat._id, jid);
            }
          }

          // Step 5: Transform messages
          const messages: WhatsAppMessageData[] = [];
          let skipped = 0;

          for (const msg of messageRows) {
            const chatJid = chatIdToJid.get(msg.chat_row_id);
            const senderJid = msg.sender_jid_row_id
              ? jidMap.get(msg.sender_jid_row_id)
              : undefined;

            if (!chatJid) {
              skipped++;
              continue;
            }

            // Use chatJid as senderJid if missing (group messages without sender)
            const finalSenderJid = senderJid || chatJid;

            messages.push({
              id: msg.key_id,
              chatJid,
              senderJid: finalSenderJid,
              timestamp: msg.timestamp / 1000, // Convert ms to seconds for consistency
              messageType: mapMessageType(msg.message_type),
              text: msg.text_data || undefined,
              isFromMe: msg.from_me === 1,
              isGroup: chatJid.includes('@g.us'),
            });
          }

          console.log(`   • Transformed ${messages.length} messages (skipped ${skipped})`);

          return {
            messages,
            chats,
            syncedAt: Date.now() / 1000, // Current time in seconds
          };
        } finally {
          db.close();
        }
      });

    return {
      importFromMsgstore,
    };
  })()
);
