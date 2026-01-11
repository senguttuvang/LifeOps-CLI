/**
 * WhatsApp Adapter - Anti-Corruption Layer
 *
 * Translates WhatsApp-specific data structures → Domain entities
 *
 * CRITICAL: This is the ONLY place that knows about WhatsApp protocol details (JIDs, chat types, etc.)
 * Domain services never see WhatsApp-specific types.
 *
 * Protection: When WhatsApp API changes, only this file needs updates.
 */

import { randomUUID } from "node:crypto";

import { Context, Effect, Layer } from "effect";

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
// DOMAIN TYPES (Internal Model) - Using v3 Schema Terminology
// =============================================================================

/**
 * Domain events returned by adapter (used by domain services)
 * These are source-agnostic representations using Party pattern.
 */

export interface DomainParty {
  id: string; // UUID (generated if new)
  displayName: string;
  partyType: "individual" | "organization";
  contactPoints: DomainContactPoint[];
}

export interface DomainContactPoint {
  id: string; // UUID
  partyId: string; // UUID (link to party)
  channelId: "whatsapp";
  value: string; // Normalized (no @s.whatsapp.net suffix)
  isPrimary: boolean;
}

export interface DomainConversation {
  id: string; // UUID (generated if new)
  title: string | null;
  conversationType: "direct" | "group" | "broadcast";
  channelId: "whatsapp";
  externalId: string; // JID (raw)
  isArchived: boolean;
  isPinned: boolean;
  lastActivityAt: Date;
}

export interface DomainConversationParticipant {
  conversationId: string; // UUID (linked to DomainConversation)
  partyId: string; // UUID (linked to DomainParty)
  role: "member" | "admin" | "owner" | null;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface DomainCommunicationEvent {
  id: string; // UUID (generated)
  conversationId: string; // UUID (linked to DomainConversation)
  eventType: "message" | "call";
  direction: "inbound" | "outbound";
  fromPartyId: string; // UUID (linked to DomainParty)
  occurredAt: Date;
  channelId: "whatsapp";
  externalId: string; // WhatsApp message/call ID
  isIndexed: boolean;
}

export interface DomainMessage {
  eventId: string; // UUID (linked to DomainCommunicationEvent)
  content: string | null;
  contentType: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
  mediaUrl: string | null;
  mediaMimeType: string | null;
  quotedEventId: string | null; // UUID (if exists)
  reactionEmoji: string | null;
  isStarred: boolean;
  rawMetadata: string | null; // JSON
}

export interface DomainCall {
  eventId: string; // UUID (linked to DomainCommunicationEvent)
  callType: "voice" | "video";
  durationSeconds: number | null;
  callStatus: "completed" | "missed" | "declined" | "failed";
  participantsCount: number;
}

export interface TranslatedSyncResult {
  parties: DomainParty[];
  conversations: DomainConversation[];
  conversationParticipants: DomainConversationParticipant[];
  communicationEvents: DomainCommunicationEvent[];
  messages: DomainMessage[];
  calls: DomainCall[];
}

// =============================================================================
// ADAPTER IMPLEMENTATION
// =============================================================================

export class WhatsAppAdapter {
  // Store JID→UUID mappings during translation
  private readonly partyJidToUuid = new Map<string, string>();
  private readonly conversationJidToUuid = new Map<string, string>();
  private readonly messageIdToEventUuid = new Map<string, string>();

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
        // Step 1: Extract unique parties from chats + messages + group participants
        const parties = yield* this.extractParties(whatsappData);

        // Step 2: Translate chats → conversations
        const conversations = yield* this.translateChats(whatsappData.chats);

        // Step 3: Extract group participants
        const conversationParticipants = yield* this.extractConversationParticipants(whatsappData.chats);

        // Step 4: Translate messages → communication events + messages
        const { communicationEvents, messages } = yield* this.translateMessages(whatsappData.messages);

        return {
          parties,
          conversations,
          conversationParticipants,
          communicationEvents,
          messages,
          calls: [], // No call data in current sync (future: extract from msgstore.db)
        };
      }.bind(this),
    );
  }

  /**
   * Extract parties from WhatsApp data
   *
   * Parties appear as:
   * - Chat participants (chat.jid)
   * - Message senders (message.senderJid)
   */
  private extractParties(whatsappData: WhatsAppSyncResult): Effect.Effect<DomainParty[], Error> {
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

      // Translate JIDs → Domain Parties
      const parties: DomainParty[] = [];

      for (const jid of jidSet) {
        // Only generate UUID if not already mapped
        let partyUuid = this.partyJidToUuid.get(jid);
        if (!partyUuid) {
          partyUuid = randomUUID();
          this.partyJidToUuid.set(jid, partyUuid);
        }

        const normalizedJid = this.normalizeJid(jid);
        const name = jidToName.get(jid);

        // Groups are organizations, individuals are individual
        const isGroup = jid.includes("@g.us");

        parties.push({
          id: partyUuid,
          displayName: name || this.extractNameFromJid(jid),
          partyType: isGroup ? "organization" : "individual",
          contactPoints: [
            {
              id: randomUUID(),
              partyId: partyUuid,
              channelId: "whatsapp",
              value: normalizedJid,
              isPrimary: true,
            },
          ],
        });
      }

      return parties;
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
          conversationType: (chat.isGroup ? "group" : "direct") as "direct" | "group" | "broadcast",
          channelId: "whatsapp" as const,
          externalId: chat.jid, // Store raw JID
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
   * conversation UUID to party UUIDs.
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
          const partyUuid = this.partyJidToUuid.get(participantJid);
          if (!partyUuid) {
            console.warn(`No party UUID found for participant ${participantJid}`);
            continue;
          }

          participants.push({
            conversationId: conversationUuid,
            partyId: partyUuid,
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
   * Translate WhatsApp messages → Domain communication events + messages
   */
  private translateMessages(messages: WhatsAppMessageData[]): Effect.Effect<
    {
      communicationEvents: DomainCommunicationEvent[];
      messages: DomainMessage[];
    },
    Error
  > {
    return Effect.try(() => {
      const communicationEvents: DomainCommunicationEvent[] = [];
      const domainMessages: DomainMessage[] = [];

      for (const msg of messages) {
        const eventUuid = randomUUID();
        this.messageIdToEventUuid.set(msg.id, eventUuid);

        const conversationUuid = this.conversationJidToUuid.get(msg.chatJid);
        const fromPartyUuid = this.partyJidToUuid.get(msg.senderJid);

        if (!conversationUuid || !fromPartyUuid) {
          console.warn(`Missing mapping for message ${msg.id}, skipping`);
          continue;
        }

        // Create communication event (base entity)
        communicationEvents.push({
          id: eventUuid,
          conversationId: conversationUuid,
          eventType: "message",
          direction: msg.isFromMe ? "outbound" : "inbound",
          fromPartyId: fromPartyUuid,
          occurredAt: new Date(msg.timestamp * 1000),
          channelId: "whatsapp",
          externalId: msg.id,
          isIndexed: false, // RAG will process later
        });

        // Create message (subtype entity)
        domainMessages.push({
          eventId: eventUuid,
          content: msg.text || null,
          contentType: msg.messageType,
          mediaUrl: msg.mediaUrl || null,
          mediaMimeType: msg.mediaMimeType || null,
          quotedEventId: msg.quotedMessageId
            ? this.messageIdToEventUuid.get(msg.quotedMessageId) || null
            : null,
          reactionEmoji: null, // Future: extract from rawJson
          isStarred: false, // Future: extract from rawJson
          rawMetadata: null, // Future: store full message JSON
        });
      }

      return { communicationEvents, messages: domainMessages };
    });
  }

  /**
   * Translate WhatsApp call logs → Domain communication events + calls
   */
  translateCallLogs(callLogs: WhatsAppCallLog[]): Effect.Effect<
    {
      communicationEvents: DomainCommunicationEvent[];
      calls: DomainCall[];
    },
    Error
  > {
    return Effect.try(() => {
      const communicationEvents: DomainCommunicationEvent[] = [];
      const calls: DomainCall[] = [];

      for (const call of callLogs) {
        const eventUuid = randomUUID();

        const conversationUuid = this.conversationJidToUuid.get(call.chatJid);
        const fromPartyUuid = this.partyJidToUuid.get(call.fromJid);

        if (!conversationUuid || !fromPartyUuid) {
          console.warn(`Missing mapping for call ${call.id}, skipping`);
          continue;
        }

        // Create communication event
        communicationEvents.push({
          id: eventUuid,
          conversationId: conversationUuid,
          eventType: "call",
          direction: "inbound", // Assuming incoming (refine with call metadata)
          fromPartyId: fromPartyUuid,
          occurredAt: new Date(call.timestamp * 1000),
          channelId: "whatsapp",
          externalId: call.id,
          isIndexed: false,
        });

        // Create call
        calls.push({
          eventId: eventUuid,
          callType: call.callType,
          durationSeconds: call.durationSeconds,
          callStatus: call.status,
          participantsCount: 2, // Default for 1:1 calls (group calls need metadata)
        });
      }

      return { communicationEvents, calls };
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
      .replaceAll("+", ""); // Remove + prefix from phone numbers
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
   * Reverse lookup: Find party UUID from WhatsApp JID
   * Used by external code that needs to query domain entities by JID
   */
  getPartyUuidByJid(jid: string): string | undefined {
    return this.partyJidToUuid.get(jid);
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
    this.partyJidToUuid.clear();
    this.conversationJidToUuid.clear();
    this.messageIdToEventUuid.clear();
  }
}

/**
 * WhatsAppAdapter as Effect service (for dependency injection)
 */
export class WhatsAppAdapterTag extends Context.Tag("WhatsAppAdapter")<WhatsAppAdapterTag, WhatsAppAdapter>() {}

/**
 * Live implementation (singleton instance)
 */
export const WhatsAppAdapterLive = Layer.succeed(WhatsAppAdapterTag, new WhatsAppAdapter());
