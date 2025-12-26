/**
 * WhatsApp Sync Domain Service (v2 - Domain Model)
 *
 * Orchestrates the sync flow: WhatsApp CLI → Adapter → Domain Entities → Database
 * Uses anti-corruption layer to isolate WhatsApp protocol from domain model.
 *
 * Key Changes from v1:
 * - Uses WhatsAppAdapter to translate WhatsApp → Domain entities
 * - Stores in domain tables (contacts, interactions) not WhatsApp tables
 * - Source-agnostic design (works for any future data source)
 */

import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { WhatsAppAdapterTag } from "../../infrastructure/adapters/whatsapp/whatsapp.adapter";
import { DatabaseService } from "../../infrastructure/db/client";
import {
  calls,
  contactIdentifiers,
  contacts,
  conversationParticipants,
  conversations,
  interactions,
  messages,
  syncState,
} from "../../infrastructure/db/schema";
import { WhatsAppServiceTag } from "../../infrastructure/whatsapp/whatsapp.client";

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

              const existingIdentifier = await db
                .select({ contactId: contactIdentifiers.contactId })
                .from(contactIdentifiers)
                .where(
                  and(
                    eq(contactIdentifiers.source, firstIdentifier.source),
                    eq(contactIdentifiers.identifier, firstIdentifier.identifier),
                  ),
                )
                .limit(1);

              if (existingIdentifier.length === 0) {
                // New contact - insert
                await db.insert(contacts).values({
                  id: contact.id,
                  displayName: contact.displayName,
                  preferredName: null,
                  type: contact.type,
                  notes: null,
                });

                // Insert identifier
                for (const identifier of contact.identifiers) {
                  await db.insert(contactIdentifiers).values(identifier);
                }

                contactsAdded++;
              } else {
                // Existing contact - update name if changed
                const existing = existingIdentifier[0];
                if (existing) {
                  await db
                    .update(contacts)
                    .set({
                      displayName: contact.displayName,
                      updatedAt: new Date(),
                    })
                    .where(eq(contacts.id, existing.contactId));
                }
              }
            },
            catch: (e) => new Error(`Failed to store contact: ${e}`),
          });
        }

        // 3b. Store conversations (upsert by source_conversation_id)
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
                    eq(conversations.source, conversation.source),
                    eq(conversations.sourceConversationId, conversation.sourceConversationId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New conversation
                await db.insert(conversations).values(conversation);
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

        // 3c. Store conversation participants (skip duplicates)
        let participantsAdded = 0;
        for (const participant of domainData.conversationParticipants) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if participant already exists (conversation + contact pair is unique)
              const existing = await db
                .select()
                .from(conversationParticipants)
                .where(
                  and(
                    eq(conversationParticipants.conversationId, participant.conversationId),
                    eq(conversationParticipants.contactId, participant.contactId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New participant
                await db.insert(conversationParticipants).values(participant);
                participantsAdded++;
              }
              // If already exists, skip (no need to update - participant data is static)
            },
            catch: (e) => new Error(`Failed to store conversation participant: ${e}`),
          });
        }

        // 3d. Store interactions (skip duplicates via source_interaction_id check)
        let messagesAdded = 0;
        let callsAdded = 0;

        for (const interaction of domainData.interactions) {
          yield* Effect.tryPromise({
            try: async () => {
              // Check if interaction already exists
              const existing = await db
                .select({ id: interactions.id })
                .from(interactions)
                .where(
                  and(
                    eq(interactions.source, interaction.source),
                    eq(interactions.sourceInteractionId, interaction.sourceInteractionId),
                  ),
                )
                .limit(1);

              if (existing.length === 0) {
                // New interaction - insert
                await db.insert(interactions).values(interaction);

                // Insert corresponding message or call (subtype)
                if (interaction.interactionType === "message") {
                  const message = domainData.messages.find((m) => m.interactionId === interaction.id);
                  if (message) {
                    await db.insert(messages).values(message);
                    messagesAdded++;
                  }
                } else if (interaction.interactionType === "call") {
                  const call = domainData.calls.find((c) => c.interactionId === interaction.id);
                  if (call) {
                    await db.insert(calls).values(call);
                    callsAdded++;
                  }
                }
              }
              // Skip if duplicate (onConflictDoNothing equivalent)
            },
            catch: (e) => new Error(`Failed to store interaction: ${e}`),
          });
        }

        // 4. Update sync state
        const syncedAt = new Date();
        yield* Effect.tryPromise({
          try: async () => {
            await db
              .insert(syncState)
              .values({
                id: "whatsapp",
                source: "whatsapp",
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
