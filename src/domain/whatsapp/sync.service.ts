/**
 * WhatsApp Sync Domain Service
 *
 * Orchestrates the sync flow: WhatsApp CLI → Database
 * This is domain logic that coordinates infrastructure services.
 */

import { Context, Effect, Layer } from "effect";
import { WhatsAppServiceTag } from "../../infrastructure/whatsapp/whatsapp.client";
import { DatabaseService } from "../../infrastructure/db/client";
import { whatsappChats, whatsappMessages, whatsappSyncState } from "../../infrastructure/db/schema";
import { eq } from "drizzle-orm";

/**
 * Sync statistics returned after sync operation
 */
export interface SyncStats {
  readonly messagesAdded: number;
  readonly chatsAdded: number;
  readonly syncedAt: Date;
}

/**
 * Sync options
 */
export interface SyncOptions {
  readonly days?: number;
  readonly chatJid?: string;
}

/**
 * Service Interface
 */
export interface SyncService {
  /**
   * Sync messages from WhatsApp to local database
   */
  readonly syncMessages: (options?: SyncOptions) => Effect.Effect<SyncStats, Error, never>;

  /**
   * Get current sync state
   */
  readonly getSyncState: () => Effect.Effect<
    { lastSyncAt: Date | null; cursor: string | null } | null,
    Error,
    never
  >;
}

/**
 * Service Tag
 */
export class SyncServiceTag extends Context.Tag("SyncService")<SyncServiceTag, SyncService>() {}

/**
 * Live Implementation
 */
export const SyncServiceLive = Layer.effect(
  SyncServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;
    const whatsapp = yield* WhatsAppServiceTag;

    const syncMessages = (options: SyncOptions = {}) =>
      Effect.gen(function* () {
        // 1. Fetch from WhatsApp via CLI
        const syncResult = yield* whatsapp.syncMessages({
          days: options.days || 30,
          chatJid: options.chatJid,
        });

        // 2. Store chats (upsert)
        let chatsAdded = 0;
        for (const chatData of syncResult.chats || []) {
          yield* Effect.tryPromise({
            try: async () => {
              await db
                .insert(whatsappChats)
                .values({
                  id: chatData.jid,
                  name: chatData.name || null,
                  isGroup: chatData.isGroup || false,
                  lastMessageAt: chatData.lastMessageTime
                    ? new Date(chatData.lastMessageTime * 1000)
                    : null,
                  unreadCount: chatData.unreadCount || 0,
                  participantCount: chatData.participants?.length || 0,
                  archived: false, // Not provided by CLI
                  pinned: false, // Not provided by CLI
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: whatsappChats.id,
                  set: {
                    name: chatData.name || null,
                    lastMessageAt: chatData.lastMessageTime
                      ? new Date(chatData.lastMessageTime * 1000)
                      : null,
                    unreadCount: chatData.unreadCount || 0,
                    participantCount: chatData.participants?.length || 0,
                    updatedAt: new Date(),
                  },
                });
              chatsAdded++;
            },
            catch: (e) => new Error(`Failed to store chat: ${e}`),
          });
        }

        // 3. Store messages (skip duplicates via onConflictDoNothing)
        let messagesAdded = 0;
        for (const msgData of syncResult.messages || []) {
          yield* Effect.tryPromise({
            try: async () => {
              await db
                .insert(whatsappMessages)
                .values({
                  id: msgData.id,
                  chatId: msgData.chatJid,
                  senderId: msgData.senderJid || msgData.chatJid,
                  fromMe: msgData.isFromMe || false,
                  content: msgData.text || null,
                  messageType: msgData.messageType || "text",
                  timestamp: new Date(msgData.timestamp * 1000),
                  mediaUrl: msgData.mediaUrl || null,
                  mediaMimeType: msgData.mediaMimeType || null,
                  rawJson: JSON.stringify(msgData),
                  isIndexed: false,
                })
                .onConflictDoNothing();
              messagesAdded++;
            },
            catch: (e) => new Error(`Failed to store message: ${e}`),
          });
        }

        // 4. Update sync state
        const syncedAt = new Date();
        yield* Effect.tryPromise({
          try: async () => {
            await db
              .insert(whatsappSyncState)
              .values({
                id: "main",
                lastSyncAt: syncedAt,
                cursor: null,
              })
              .onConflictDoUpdate({
                target: whatsappSyncState.id,
                set: {
                  lastSyncAt: syncedAt,
                },
              });
          },
          catch: (e) => new Error(`Failed to update sync state: ${e}`),
        });

        return { messagesAdded, chatsAdded, syncedAt };
      });

    const getSyncState = () =>
      Effect.tryPromise({
        try: async () => {
          const result = await db
            .select()
            .from(whatsappSyncState)
            .where(eq(whatsappSyncState.id, "main"));

          if (result.length === 0) {
            return null;
          }

          return {
            lastSyncAt: result[0]?.lastSyncAt || null,
            cursor: result[0]?.cursor || null,
          };
        },
        catch: (e) => new Error(`Failed to get sync state: ${e}`),
      });

    return {
      syncMessages,
      getSyncState,
    };
  })
);
