/**
 * WhatsApp Sync Domain Service
 *
 * Orchestrates the sync flow: WhatsApp CLI → Adapter → Domain Entities → Database
 * Uses anti-corruption layer to isolate WhatsApp protocol from domain model.
 */

import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
// Schema imports
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
// Import from domain ports (not directly from infrastructure)
import { DatabaseService, WhatsAppAdapterTag, WhatsAppServiceTag } from "../ports";

/**
 * Sync statistics returned after sync operation
 */
export interface SyncStats {
  readonly partiesAdded: number;
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
        // Store parties (people/organizations)
        let partiesAdded = 0;
        for (const party of domainData.parties) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if party already exists by any contact point
              const firstContactPoint = party.contactPoints[0];
              if (!firstContactPoint) {
                console.warn(`Party ${party.id} has no contact points, skipping`);
                return;
              }

              // Check if contact point already exists
              const existingContactPoint = await db
                .select({ partyId: contactPoints.partyId })
                .from(contactPoints)
                .where(
                  and(
                    eq(contactPoints.channelId, firstContactPoint.channelId),
                    eq(contactPoints.value, firstContactPoint.value),
                  ),
                )
                .limit(1);

              if (existingContactPoint.length === 0) {
                // New party - insert
                await db.insert(parties).values({
                  id: party.id,
                  displayName: party.displayName,
                  preferredName: null,
                  partyType: party.partyType,
                  notes: null,
                });

                // Insert contact points
                for (const contactPoint of party.contactPoints) {
                  await db.insert(contactPoints).values({
                    id: contactPoint.id,
                    partyId: contactPoint.partyId,
                    channelId: contactPoint.channelId,
                    value: contactPoint.value,
                    normalized: contactPoint.value,
                    isPrimary: contactPoint.isPrimary,
                    isVerified: false,
                    verifiedAt: null,
                  });
                }

                partiesAdded++;
              } else {
                // Existing party - update name if changed
                const existing = existingContactPoint[0];
                if (existing) {
                  await db
                    .update(parties)
                    .set({
                      displayName: party.displayName,
                      updatedAt: new Date(),
                    })
                    .where(eq(parties.id, existing.partyId));
                }
              }
            },
            catch: (e) => new Error(`Failed to store party: ${e}`),
          });
        }

        // Store conversations
        let conversationsAdded = 0;
        for (const conversation of domainData.conversations) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if conversation exists
              const existing = await db
                .select({ id: conversations.id })
                .from(conversations)
                .where(
                  and(
                    eq(conversations.channelId, conversation.channelId),
                    eq(conversations.externalId, conversation.externalId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New conversation
                await db.insert(conversations).values({
                  id: conversation.id,
                  channelId: conversation.channelId,
                  externalId: conversation.externalId,
                  conversationType: conversation.conversationType,
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

        // Store conversation participants
        let participantsAdded = 0;
        for (const participant of domainData.conversationParticipants) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if participant already exists
              const existing = await db
                .select()
                .from(conversationParticipants)
                .where(
                  and(
                    eq(conversationParticipants.conversationId, participant.conversationId),
                    eq(conversationParticipants.partyId, participant.partyId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New participant
                await db.insert(conversationParticipants).values({
                  conversationId: participant.conversationId,
                  partyId: participant.partyId,
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

        // Store communication events
        let messagesAdded = 0;
        let callsAdded = 0;

        for (const event of domainData.communicationEvents) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if event already exists
              const existing = await db
                .select({ id: communicationEvents.id })
                .from(communicationEvents)
                .where(
                  and(
                    eq(communicationEvents.channelId, event.channelId),
                    eq(communicationEvents.externalId, event.externalId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New event - insert
                await db.insert(communicationEvents).values({
                  id: event.id,
                  conversationId: event.conversationId,
                  eventType: event.eventType,
                  direction: event.direction,
                  fromPartyId: event.fromPartyId,
                  channelId: event.channelId,
                  externalId: event.externalId,
                  occurredAt: event.occurredAt,
                  isIndexed: event.isIndexed,
                });

                // Insert corresponding message or call subtype
                if (event.eventType === "message") {
                  const message = domainData.messages.find((m) => m.eventId === event.id);
                  if (message) {
                    await db.insert(messages).values({
                      eventId: message.eventId,
                      content: message.content,
                      contentType: message.contentType,
                      mediaUrl: message.mediaUrl,
                      mediaMimeType: message.mediaMimeType,
                      quotedEventId: message.quotedEventId ?? null,
                      forwardedFromPartyId: null,
                      reactionEmoji: message.reactionEmoji,
                      isStarred: message.isStarred,
                      editedAt: null,
                      deletedAt: null,
                      rawMetadata: message.rawMetadata,
                    });
                    messagesAdded++;
                  }
                } else if (event.eventType === "call") {
                  const call = domainData.calls.find((c) => c.eventId === event.id);
                  if (call) {
                    await db.insert(calls).values({
                      eventId: call.eventId,
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
            catch: (e) => new Error(`Failed to store communication event: ${e}`),
          });
        }

        // Update sync state
        const syncedAt = new Date();
        yield* Effect.tryPromise({
          try: async () => {
            await db
              .insert(syncState)
              .values({
                id: "whatsapp",
                channelId: "whatsapp",
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

        return { partiesAdded, conversationsAdded, participantsAdded, messagesAdded, callsAdded, syncedAt };
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
