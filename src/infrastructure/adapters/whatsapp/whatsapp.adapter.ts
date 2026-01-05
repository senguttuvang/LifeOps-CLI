/**
 * WhatsApp Adapter - Anti-Corruption Layer
 *
 * Translates WhatsApp-specific data structures → Domain entities
 *
 * CRITICAL: This is the ONLY place that knows about WhatsApp protocol details (JIDs, chat types, etc.)
 * Domain services never see WhatsApp-specific types.
 *
 * Protection: When WhatsApp API changes, only this file needs updates.
 *
 * See: docs/adr/003-domain-model-redesign.md
 */

import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import type { WhatsAppChatData, WhatsAppMessageData, WhatsAppSyncResult } from "../../whatsapp/whatsapp.types";

// =============================================================================
// WHATSAPP TYPES (External Protocol) - Imported from whatsapp.types.ts
// =============================================================================

// Call logs (future enhancement - not in current WhatsApp CLI output)
export interface WhatsAppCallLog {
  id: string;
  chatJid: string;
  fromJid: string;
  callType: "voice" | "video";
  timestamp: number;
  durationSeconds: number | null;
  status: "completed" | "missed" | "declined" | "failed";
}

// =============================================================================
// DOMAIN TYPES (Internal Model)
// =============================================================================

/**
 * Domain events returned by adapter (used by domain services)
 * These are source-agnostic representations.
 */

export interface DomainContact {
  id: string; // UUID (generated if new)
  displayName: string;
  type: "person" | "business" | "group";
  identifiers: DomainContactIdentifier[];
}

export interface DomainContactIdentifier {
  id: string; // UUID
  contactId: string; // UUID (link to contact)
  source: "whatsapp";
  identifier: string; // Normalized (no @s.whatsapp.net suffix)
  isPrimary: boolean;
}

export interface DomainConversation {
  id: string; // UUID (generated if new)
  title: string | null;
  conversationType: "1:1" | "group" | "broadcast";
  source: "whatsapp";
  sourceConversationId: string; // JID (raw)
  isArchived: boolean;
  isPinned: boolean;
  lastActivityAt: Date;
}

export interface DomainConversationParticipant {
  conversationId: string; // UUID (linked to DomainConversation)
  contactId: string; // UUID (linked to DomainContact)
  role: "member" | "admin" | "owner" | null;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface DomainInteraction {
  id: string; // UUID (generated)
  conversationId: string; // UUID (linked to DomainConversation)
  interactionType: "message" | "call";
  direction: "inbound" | "outbound";
  fromContactId: string; // UUID (linked to DomainContact)
  occurredAt: Date;
  source: "whatsapp";
  sourceInteractionId: string; // WhatsApp message/call ID
  isIndexed: boolean;
}

export interface DomainMessage {
  interactionId: string; // UUID (linked to DomainInteraction)
  content: string | null;
  contentType: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
  mediaUrl: string | null;
  mediaMimeType: string | null;
  quotedInteractionId: string | null; // UUID (if exists)
  reactionEmoji: string | null;
  isStarred: boolean;
  rawMetadata: string | null; // JSON
}

export interface DomainCall {
  interactionId: string; // UUID (linked to DomainInteraction)
  callType: "voice" | "video";
  durationSeconds: number | null;
  callStatus: "completed" | "missed" | "declined" | "failed";
  participantsCount: number;
}

export interface TranslatedSyncResult {
  contacts: DomainContact[];
  conversations: DomainConversation[];
  conversationParticipants: DomainConversationParticipant[];
  interactions: DomainInteraction[];
  messages: DomainMessage[];
  calls: DomainCall[];
}

// =============================================================================
// ADAPTER IMPLEMENTATION
// =============================================================================

export class WhatsAppAdapter {
  // Store JID→UUID mappings during translation
  private readonly contactJidToUuid = new Map<string, string>();
  private readonly conversationJidToUuid = new Map<string, string>();
  private readonly messageIdToInteractionUuid = new Map<string, string>();

  /**
   * Main translation method: WhatsApp data → Domain entities
   *
   * Usage:
   *   const whatsappData = await whatsmeowCli.sync();
   *   const domainData = adapter.translateSyncResult(whatsappData);
   *   await domainService.persist(domainData);
   */
  translateSyncResult(whatsappData: WhatsAppSyncResult): Effect.Effect<TranslatedSyncResult, Error> {
    return Effect.gen(
      function* (this: WhatsAppAdapter) {
        // Step 1: Extract unique contacts from chats + messages + group participants
        const contacts = yield* this.extractContacts(whatsappData);

        // Step 2: Translate chats → conversations
        const conversations = yield* this.translateChats(whatsappData.chats);

        // Step 3: Extract group participants
        const conversationParticipants = yield* this.extractConversationParticipants(whatsappData.chats);

        // Step 4: Translate messages → interactions + messages
        const { interactions, messages } = yield* this.translateMessages(whatsappData.messages);

        return {
          contacts,
          conversations,
          conversationParticipants,
          interactions,
          messages,
          calls: [], // No call data in current sync (future: extract from msgstore.db)
        };
      }.bind(this),
    );
  }

  /**
   * Extract contacts from WhatsApp data
   *
   * Contacts appear as:
   * - Chat participants (chat.jid)
   * - Message senders (message.senderJid)
   */
  private extractContacts(whatsappData: WhatsAppSyncResult): Effect.Effect<DomainContact[], Error> {
    return Effect.try(() => {
      const jidSet = new Set<string>();
      const jidToName = new Map<string, string | undefined>();

      // Collect JIDs from chats
      for (const chat of whatsappData.chats) {
        jidSet.add(chat.jid);
        jidToName.set(chat.jid, chat.name);

        // Extract participant JIDs from group chats
        if (chat.participants) {
          for (const participantJid of chat.participants) {
            jidSet.add(participantJid);
            // Participants don't have names in the participants array, will be inferred later
          }
        }
      }

      // Collect JIDs from messages
      for (const msg of whatsappData.messages) {
        jidSet.add(msg.senderJid);
        // Use chat name if sender has no name (fallback)
        if (!jidToName.has(msg.senderJid)) {
          const chat = whatsappData.chats.find((c) => c.jid === msg.chatJid);
          jidToName.set(msg.senderJid, chat?.name);
        }
      }

      // Translate JIDs → Domain Contacts
      const contacts: DomainContact[] = [];

      for (const jid of jidSet) {
        // Only generate UUID if not already mapped
        let contactUuid = this.contactJidToUuid.get(jid);
        if (!contactUuid) {
          contactUuid = randomUUID();
          this.contactJidToUuid.set(jid, contactUuid);
        }

        const normalizedJid = this.normalizeJid(jid);
        const name = jidToName.get(jid);

        contacts.push({
          id: contactUuid,
          displayName: name || this.extractNameFromJid(jid),
          type: jid.includes("@g.us") ? "group" : "person",
          identifiers: [
            {
              id: randomUUID(),
              contactId: contactUuid,
              source: "whatsapp",
              identifier: normalizedJid,
              isPrimary: true,
            },
          ],
        });
      }

      return contacts;
    });
  }

  /**
   * Translate WhatsApp chats → Domain conversations
   */
  private translateChats(chats: WhatsAppChatData[]): Effect.Effect<DomainConversation[], Error> {
    return Effect.try(() => {
      return chats.map((chat) => {
        const conversationUuid = randomUUID();
        this.conversationJidToUuid.set(chat.jid, conversationUuid);

        return {
          id: conversationUuid,
          title: chat.name || null,
          conversationType: (chat.isGroup ? "group" : "1:1") as "1:1" | "group" | "broadcast",
          source: "whatsapp" as const,
          sourceConversationId: chat.jid, // Store raw JID
          isArchived: false, // Not provided by current CLI
          isPinned: false, // Not provided by current CLI
          lastActivityAt: chat.lastMessageTime ? new Date(chat.lastMessageTime * 1000) : new Date(),
        };
      });
    });
  }

  /**
   * Extract conversation participants from group chats
   *
   * For each group chat with participants, creates participant records linking
   * conversation UUID to contact UUIDs.
   */
  private extractConversationParticipants(
    chats: WhatsAppChatData[],
  ): Effect.Effect<DomainConversationParticipant[], Error> {
    return Effect.try(() => {
      const participants: DomainConversationParticipant[] = [];

      for (const chat of chats) {
        // Only process group chats with participant data
        if (!chat.isGroup || !chat.participants || chat.participants.length === 0) {
          continue;
        }

        const conversationUuid = this.conversationJidToUuid.get(chat.jid);
        if (!conversationUuid) {
          console.warn(`No conversation UUID found for chat ${chat.jid}`);
          continue;
        }

        // Create participant entry for each group member
        for (const participantJid of chat.participants) {
          const contactUuid = this.contactJidToUuid.get(participantJid);
          if (!contactUuid) {
            console.warn(`No contact UUID found for participant ${participantJid}`);
            continue;
          }

          participants.push({
            conversationId: conversationUuid,
            contactId: contactUuid,
            role: null, // Role not available in basic participant list (would need admin metadata)
            joinedAt: new Date(), // Default to current time (msgstore.db doesn't have historical join dates)
            leftAt: null, // Active members only
          });
        }
      }

      return participants;
    });
  }

  /**
   * Translate WhatsApp messages → Domain interactions + messages
   */
  private translateMessages(messages: WhatsAppMessageData[]): Effect.Effect<
    {
      interactions: DomainInteraction[];
      messages: DomainMessage[];
    },
    Error
  > {
    return Effect.try(() => {
      const interactions: DomainInteraction[] = [];
      const domainMessages: DomainMessage[] = [];

      for (const msg of messages) {
        const interactionUuid = randomUUID();
        this.messageIdToInteractionUuid.set(msg.id, interactionUuid);

        const conversationUuid = this.conversationJidToUuid.get(msg.chatJid);
        const fromContactUuid = this.contactJidToUuid.get(msg.senderJid);

        if (!conversationUuid || !fromContactUuid) {
          console.warn(`Missing mapping for message ${msg.id}, skipping`);
          continue;
        }

        // Create interaction (base entity)
        interactions.push({
          id: interactionUuid,
          conversationId: conversationUuid,
          interactionType: "message",
          direction: msg.isFromMe ? "outbound" : "inbound",
          fromContactId: fromContactUuid,
          occurredAt: new Date(msg.timestamp * 1000),
          source: "whatsapp",
          sourceInteractionId: msg.id,
          isIndexed: false, // RAG will process later
        });

        // Create message (subtype entity)
        domainMessages.push({
          interactionId: interactionUuid,
          content: msg.text || null,
          contentType: msg.messageType,
          mediaUrl: msg.mediaUrl || null,
          mediaMimeType: msg.mediaMimeType || null,
          quotedInteractionId: msg.quotedMessageId
            ? this.messageIdToInteractionUuid.get(msg.quotedMessageId) || null
            : null,
          reactionEmoji: null, // Future: extract from rawJson
          isStarred: false, // Future: extract from rawJson
          rawMetadata: null, // Future: store full message JSON
        });
      }

      return { interactions, messages: domainMessages };
    });
  }

  /**
   * Translate WhatsApp call logs → Domain interactions + calls
   */
  translateCallLogs(callLogs: WhatsAppCallLog[]): Effect.Effect<
    {
      interactions: DomainInteraction[];
      calls: DomainCall[];
    },
    Error
  > {
    return Effect.try(() => {
      const interactions: DomainInteraction[] = [];
      const calls: DomainCall[] = [];

      for (const call of callLogs) {
        const interactionUuid = randomUUID();

        const conversationUuid = this.conversationJidToUuid.get(call.chatJid);
        const fromContactUuid = this.contactJidToUuid.get(call.fromJid);

        if (!conversationUuid || !fromContactUuid) {
          console.warn(`Missing mapping for call ${call.id}, skipping`);
          continue;
        }

        // Create interaction
        interactions.push({
          id: interactionUuid,
          conversationId: conversationUuid,
          interactionType: "call",
          direction: "inbound", // Assuming incoming (refine with call metadata)
          fromContactId: fromContactUuid,
          occurredAt: new Date(call.timestamp * 1000),
          source: "whatsapp",
          sourceInteractionId: call.id,
          isIndexed: false,
        });

        // Create call
        calls.push({
          interactionId: interactionUuid,
          callType: call.callType,
          durationSeconds: call.durationSeconds,
          callStatus: call.status,
          participantsCount: 2, // Default for 1:1 calls (group calls need metadata)
        });
      }

      return { interactions, calls };
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Normalize WhatsApp JID: remove domain suffix
   *
   * Input:  "919876543210@s.whatsapp.net"
   * Output: "919876543210"
   *
   * Protection: If WhatsApp changes domain (@wa.2024), only this method updates.
   */
  private normalizeJid(jid: string): string {
    return jid
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "")
      .replace("@g.us", "")
      .replace("@wa.2024", "") // Future-proof for potential format changes
      .replace(/\+/g, ""); // Remove + prefix from phone numbers
  }

  /**
   * Extract display name from JID when chat name is null
   *
   * Input:  "919876543210@s.whatsapp.net"
   * Output: "+91 98765 43210" (formatted phone number)
   */
  private extractNameFromJid(jid: string): string {
    const normalized = this.normalizeJid(jid);

    // Format as phone number if numeric
    if (/^\d+$/.test(normalized)) {
      // Indian number format: +91 98765 43210
      if (normalized.startsWith("91") && normalized.length === 12) {
        return `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
      }
      // Generic: +[country] [number]
      return `+${normalized.slice(0, 2)} ${normalized.slice(2)}`;
    }

    // Fallback: use JID as-is
    return jid;
  }

  /**
   * Reverse lookup: Find contact UUID from WhatsApp JID
   * Used by external code that needs to query domain entities by JID
   */
  getContactUuidByJid(jid: string): string | undefined {
    return this.contactJidToUuid.get(jid);
  }

  /**
   * Reverse lookup: Find conversation UUID from WhatsApp JID
   */
  getConversationUuidByJid(jid: string): string | undefined {
    return this.conversationJidToUuid.get(jid);
  }

  /**
   * Clear mapping cache (call between sync sessions)
   */
  clearMappings(): void {
    this.contactJidToUuid.clear();
    this.conversationJidToUuid.clear();
    this.messageIdToInteractionUuid.clear();
  }
}

// =============================================================================
// EFFECT-TS SERVICE LAYER
// =============================================================================

import { Context, Layer } from "effect";

/**
 * WhatsAppAdapter as Effect service (for dependency injection)
 */
export class WhatsAppAdapterTag extends Context.Tag("WhatsAppAdapter")<WhatsAppAdapterTag, WhatsAppAdapter>() {}

/**
 * Live implementation (singleton instance)
 */
export const WhatsAppAdapterLive = Layer.succeed(WhatsAppAdapterTag, new WhatsAppAdapter());
