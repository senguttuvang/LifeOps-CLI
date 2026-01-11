/**
 * WhatsApp Sync Domain Service (v3 - Refactored Schema)
 *
 * Orchestrates the sync flow: WhatsApp CLI → Adapter → Domain Entities → Database
 * Uses anti-corruption layer to isolate WhatsApp protocol from domain model.
 *
 * Schema v3 Changes:
 * - contacts → parties (with partyType instead of type)
 * - contactIdentifiers → contactPoints (with channelId, value, partyId)
 * - interactions → communicationEvents (with eventType, fromPartyId, externalId)
 * - conversations use channelId and externalId instead of source/sourceConversationId
 */

import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

// Import from domain ports (not directly from infrastructure)
import { DatabaseService, WhatsAppAdapterTag, WhatsAppServiceTag } from "../ports";
// Schema imports - using new v3 schema
import {
  calls,
  communicationEvents,
  contactPoints,
  conversationParticipants,
  conversations,
  messages,
  parties,
  syncState,
} from "../../infrastructure/db/schema/index";

/**
 * Sync statistics returned after sync operation
 */
export interface SyncStats {
  readonly contactsAdded: number;
  readonly conversationsAdded: number;
  readonly participantsAdded: number;
  readonly messagesAdded: number;
  readonly callsAdded: number;
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
   * Sync from pre-fetched WhatsApp data (e.g., Android import)
   * Bypasses WhatsApp CLI and uses provided data directly
   */
  readonly syncFromData: (
    whatsappData: import("../../infrastructure/whatsapp/whatsapp.types").WhatsAppSyncResult,
  ) => Effect.Effect<SyncStats, Error, never>;

  /**
   * Get current sync state
   */
  readonly getSyncState: () => Effect.Effect<{ lastSyncAt: Date | null; cursor: string | null } | null, Error, never>;
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
    const adapter = yield* WhatsAppAdapterTag;

    /**
     * Shared persistence logic - stores domain entities in database
     * Used by both syncMessages and syncFromData
     */
    const persistDomainData = (
      domainData: import("../../infrastructure/adapters/whatsapp/whatsapp.adapter").TranslatedSyncResult,
    ) =>
      Effect.gen(function* () {
        // Store domain entities in database
        let contactsAdded = 0;
        for (const contact of domainData.contacts) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if contact already exists by any identifier
              const firstIdentifier = contact.identifiers[0];
              if (!firstIdentifier) {
                console.warn(`Contact ${contact.id} has no identifiers, skipping`);
                return;
              }

              // v3: Use contactPoints with partyId, channelId, value
              const existingIdentifier = await db
                .select({ partyId: contactPoints.partyId })
                .from(contactPoints)
                .where(
                  and(
                    eq(contactPoints.channelId, firstIdentifier.source), // source → channelId
                    eq(contactPoints.value, firstIdentifier.identifier), // identifier → value
                  ),
                )
                .limit(1);

              if (existingIdentifier.length === 0) {
                // New contact - insert into parties (v3)
                await db.insert(parties).values({
                  id: contact.id,
                  displayName: contact.displayName,
                  preferredName: null,
                  partyType: contact.type === "person" ? "individual" : "organization", // type → partyType
                  notes: null,
                });

                // Insert identifiers as contact points (v3)
                for (const identifier of contact.identifiers) {
                  await db.insert(contactPoints).values({
                    id: identifier.id,
                    partyId: identifier.contactId, // contactId → partyId
                    channelId: identifier.source, // source → channelId
                    value: identifier.identifier, // identifier → value
                    normalized: identifier.identifier,
                    isPrimary: identifier.isPrimary,
                    isVerified: false, // Default to not verified
                    verifiedAt: null,
                  });
                }

                contactsAdded++;
              } else {
                // Existing contact - update name if changed
                const existing = existingIdentifier[0];
                if (existing) {
                  await db
                    .update(parties)
                    .set({
                      displayName: contact.displayName,
                      updatedAt: new Date(),
                    })
                    .where(eq(parties.id, existing.partyId));
                }
              }
            },
            catch: (e) => new Error(`Failed to store contact: ${e}`),
          });
        }

        // Store conversations (v3: channelId, externalId)
        let conversationsAdded = 0;
        for (const conversation of domainData.conversations) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if conversation exists (v3: channelId + externalId)
              const existing = await db
                .select({ id: conversations.id })
                .from(conversations)
                .where(
                  and(
                    eq(conversations.channelId, conversation.source), // source → channelId
                    eq(conversations.externalId, conversation.sourceConversationId), // sourceConversationId → externalId
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New conversation (v3 schema)
                await db.insert(conversations).values({
                  id: conversation.id,
                  channelId: conversation.source,
                  externalId: conversation.sourceConversationId,
                  conversationType: conversation.conversationType === "1:1" ? "direct" : conversation.conversationType,
                  title: conversation.title,
                  isArchived: conversation.isArchived,
                  isPinned: conversation.isPinned,
                  lastActivityAt: conversation.lastActivityAt,
                });
                conversationsAdded++;
              } else {
                // Update existing conversation
                const existingConv = existing[0];
                if (existingConv) {
                  await db
                    .update(conversations)
                    .set({
                      title: conversation.title,
                      lastActivityAt: conversation.lastActivityAt,
                      isArchived: conversation.isArchived,
                      isPinned: conversation.isPinned,
                      updatedAt: new Date(),
                    })
                    .where(eq(conversations.id, existingConv.id));
                }
              }
            },
            catch: (e) => new Error(`Failed to store conversation: ${e}`),
          });
        }

        // Store conversation participants (v3: partyId instead of contactId)
        let participantsAdded = 0;
        for (const participant of domainData.conversationParticipants) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if participant already exists (v3: partyId)
              const existing = await db
                .select()
                .from(conversationParticipants)
                .where(
                  and(
                    eq(conversationParticipants.conversationId, participant.conversationId),
                    eq(conversationParticipants.partyId, participant.contactId), // contactId → partyId
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New participant (v3 schema)
                await db.insert(conversationParticipants).values({
                  conversationId: participant.conversationId,
                  partyId: participant.contactId, // contactId → partyId
                  role: participant.role,
                  joinedAt: participant.joinedAt,
                  leftAt: participant.leftAt,
                });
                participantsAdded++;
              }
            },
            catch: (e) => new Error(`Failed to store conversation participant: ${e}`),
          });
        }

        // Store interactions (v3: communicationEvents with eventType, fromPartyId, externalId)
        let messagesAdded = 0;
        let callsAdded = 0;

        for (const interaction of domainData.interactions) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if interaction already exists (v3: channelId + externalId)
              const existing = await db
                .select({ id: communicationEvents.id })
                .from(communicationEvents)
                .where(
                  and(
                    eq(communicationEvents.channelId, interaction.source), // source → channelId
                    eq(communicationEvents.externalId, interaction.sourceInteractionId), // sourceInteractionId → externalId
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New interaction - insert as communication event (v3)
                await db.insert(communicationEvents).values({
                  id: interaction.id,
                  conversationId: interaction.conversationId,
                  eventType: interaction.interactionType, // interactionType → eventType
                  direction: interaction.direction,
                  fromPartyId: interaction.fromContactId, // fromContactId → fromPartyId
                  channelId: interaction.source, // source → channelId
                  externalId: interaction.sourceInteractionId, // sourceInteractionId → externalId
                  occurredAt: interaction.occurredAt,
                  isIndexed: interaction.isIndexed,
                });

                // Insert corresponding message or call (subtype) with eventId
                if (interaction.interactionType === "message") {
                  const message = domainData.messages.find((m) => m.interactionId === interaction.id);
                  if (message) {
                    await db.insert(messages).values({
                      eventId: message.interactionId, // interactionId → eventId
                      content: message.content,
                      contentType: message.contentType,
                      mediaUrl: message.mediaUrl,
                      mediaMimeType: message.mediaMimeType,
                      quotedEventId: message.quotedInteractionId ?? null, // quotedInteractionId → quotedEventId
                      forwardedFromPartyId: null, // Not in domain type yet
                      reactionEmoji: message.reactionEmoji,
                      isStarred: message.isStarred,
                      editedAt: null, // Not in domain type yet
                      deletedAt: null, // Not in domain type yet
                      rawMetadata: message.rawMetadata,
                    });
                    messagesAdded++;
                  }
                } else if (interaction.interactionType === "call") {
                  const call = domainData.calls.find((c) => c.interactionId === interaction.id);
                  if (call) {
                    await db.insert(calls).values({
                      eventId: call.interactionId, // interactionId → eventId
                      callType: call.callType,
                      durationSeconds: call.durationSeconds,
                      callStatus: call.callStatus,
                      participantsCount: call.participantsCount,
                    });
                    callsAdded++;
                  }
                }
              }
            },
            catch: (e) => new Error(`Failed to store interaction: ${e}`),
          });
        }

        // Update sync state (v3: channelId instead of source)
        const syncedAt = new Date();
        yield* Effect.tryPromise({
          try: async () => {
            await db
              .insert(syncState)
              .values({
                id: "whatsapp",
                channelId: "whatsapp", // source → channelId
                lastSyncAt: syncedAt,
                lastSyncStatus: "success",
                cursor: null,
                errorMessage: null,
              })
              .onConflictDoUpdate({
                target: syncState.id,
                set: {
                  lastSyncAt: syncedAt,
                  lastSyncStatus: "success",
                  errorMessage: null,
                },
              });
          },
          catch: (e) => new Error(`Failed to update sync state: ${e}`),
        });

        return { contactsAdded, conversationsAdded, participantsAdded, messagesAdded, callsAdded, syncedAt };
      });

    /**
     * Sync from WhatsApp CLI (original flow)
     */
    const syncMessages = (options: SyncOptions = {}) =>
      Effect.gen(function* () {
        // 1. Fetch from WhatsApp via CLI (infrastructure layer)
        const whatsappData = yield* whatsapp.syncMessages({
          days: options.days || 30,
          chatJid: options.chatJid,
        });

        // 2. Translate WhatsApp → Domain entities (anti-corruption layer)
        const domainData = yield* adapter.translateSyncResult(whatsappData);

        // 3. Persist domain entities
        const stats = yield* persistDomainData(domainData);

        return stats;
      });

    /**
     * Sync from pre-fetched data (e.g., Android import)
     */
    const syncFromData = (whatsappData: import("../../infrastructure/whatsapp/whatsapp.types").WhatsAppSyncResult) =>
      Effect.gen(function* () {
        // 1. Translate WhatsApp → Domain entities (anti-corruption layer)
        const domainData = yield* adapter.translateSyncResult(whatsappData);

        // 2. Persist domain entities
        const stats = yield* persistDomainData(domainData);

        return stats;
      });

    const getSyncState = () =>
      Effect.tryPromise({
        try: async () => {
          const result = await db.select().from(syncState).where(eq(syncState.id, "whatsapp"));

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
      syncFromData,
      getSyncState,
    };
  }),
);
