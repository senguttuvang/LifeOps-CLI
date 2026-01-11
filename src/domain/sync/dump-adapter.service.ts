/**
 * Dump Adapter Service
 *
 * Converts raw dump format (from Go CLI) to WhatsAppSyncResult format
 * for compatibility with the existing SyncService.syncFromData() method.
 *
 * @module domain/sync
 */

import { Context, Effect, Layer } from "effect";
import type {
  WhatsAppChatData,
  WhatsAppMessageData,
  WhatsAppSyncResult,
} from "../../infrastructure/whatsapp/whatsapp.types";
import type { RawContact, RawDump, RawMessage } from "./types";

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface DumpAdapterService {
  /**
   * Convert raw dump to WhatsAppSyncResult format
   */
  readonly convertDump: (dump: RawDump, selectedJids: string[]) => Effect.Effect<WhatsAppSyncResult>;

  /**
   * Convert a single raw message to WhatsAppMessageData
   */
  readonly convertMessage: (message: RawMessage, contact: RawContact) => Effect.Effect<WhatsAppMessageData>;

  /**
   * Convert a raw contact to WhatsAppChatData
   */
  readonly convertContact: (contact: RawContact) => Effect.Effect<WhatsAppChatData>;
}

export const DumpAdapterService = Context.GenericTag<DumpAdapterService>("DumpAdapterService");

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Map raw message type to WhatsApp message type
 */
const mapMessageType = (rawType: string): WhatsAppMessageData["messageType"] => {
  switch (rawType) {
    case "conversation":
    case "extendedTextMessage":
      return "text";
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "audioMessage":
      return "audio";
    case "documentMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    case "locationMessage":
      return "location";
    case "contactMessage":
      return "contact";
    default:
      return "text"; // Default to text for unknown types
  }
};

/**
 * Live implementation of DumpAdapterService
 */
const make = (): DumpAdapterService => ({
  convertMessage: (message, contact) =>
    Effect.sync(() => {
      const messageType = mapMessageType(message.messageType);

      const whatsappMessage: WhatsAppMessageData = {
        id: message.id,
        chatJid: message.chatId,
        senderJid: message.fromJid || message.chatId,
        timestamp: message.timestamp,
        messageType,
        isFromMe: message.isFromMe,
        isGroup: contact.isGroup,
      };

      // Add text content
      if (message.content) {
        if (messageType === "text") {
          whatsappMessage.text = message.content;
        } else {
          // For media messages, content is usually caption
          whatsappMessage.caption = message.content;
        }
      }

      // Add media URL if present
      if (message.mediaUrl) {
        whatsappMessage.mediaUrl = message.mediaUrl;
      }

      return whatsappMessage;
    }),

  convertContact: (contact) =>
    Effect.sync(() => {
      // Find the most recent message timestamp
      const sortedMessages = [...contact.messages].sort((a, b) => b.timestamp - a.timestamp);
      const lastMessageTime = sortedMessages[0]?.timestamp;

      const whatsappChat: WhatsAppChatData = {
        jid: contact.jid,
        name: contact.pushName || undefined,
        isGroup: contact.isGroup,
        lastMessageTime,
      };

      return whatsappChat;
    }),

  convertDump: (dump, selectedJids) =>
    Effect.gen(function* () {
      // Filter contacts to only selected JIDs
      const selectedContacts = dump.contacts.filter((c) => selectedJids.includes(c.jid));

      // Convert all messages from selected contacts
      const allMessages: WhatsAppMessageData[] = [];

      for (const contact of selectedContacts) {
        for (const message of contact.messages) {
          const converted = yield* Effect.sync(() => {
            const messageType = mapMessageType(message.messageType);

            const whatsappMessage: WhatsAppMessageData = {
              id: message.id,
              chatJid: message.chatId,
              senderJid: message.fromJid || message.chatId,
              timestamp: message.timestamp,
              messageType,
              isFromMe: message.isFromMe,
              isGroup: contact.isGroup,
            };

            if (message.content) {
              if (messageType === "text") {
                whatsappMessage.text = message.content;
              } else {
                whatsappMessage.caption = message.content;
              }
            }

            if (message.mediaUrl) {
              whatsappMessage.mediaUrl = message.mediaUrl;
            }

            return whatsappMessage;
          });

          allMessages.push(converted);
        }
      }

      // Convert contacts to chats
      const chats: WhatsAppChatData[] = [];

      for (const contact of selectedContacts) {
        const sortedMessages = [...contact.messages].sort((a, b) => b.timestamp - a.timestamp);

        chats.push({
          jid: contact.jid,
          name: contact.pushName || undefined,
          isGroup: contact.isGroup,
          lastMessageTime: sortedMessages[0]?.timestamp,
        });
      }

      const result: WhatsAppSyncResult = {
        messages: allMessages,
        chats,
        syncedAt: dump.dumpedAt,
      };

      return result;
    }),
});

// =============================================================================
// LAYER
// =============================================================================

export const DumpAdapterServiceLive = Layer.succeed(DumpAdapterService, make());

export const DumpAdapterServiceTag = DumpAdapterService;
