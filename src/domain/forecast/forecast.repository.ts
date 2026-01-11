/**
 * Forecast Repository
 *
 * Database access layer for breakup forecasting.
 * Provides methods to query contacts, messages, and relationships.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseService } from "../../infrastructure/db/client";
import * as schema from "../../infrastructure/db/schema/index";

// =============================================================================
// TYPES
// =============================================================================

export interface ContactRecord {
  id: string;
  displayName: string;
  preferredName: string | null;
  partyType: "individual" | "organization";
}

export interface RelationshipRecord {
  partyId: string;
  partyName: string;
  relationshipTypeId: string;
  strengthScore: number | null;
  lastInteractionAt: Date | null;
}

export interface MessageRecord {
  id: string;
  text: string | null;
  timestamp: Date;
  fromMe: boolean;
}

export interface ContactWithJid {
  id: string;
  displayName: string;
  preferredName: string | null;
  partyType: "individual" | "organization";
  whatsappJid: string | null;
  messageCount: number;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance" | null;
}

export interface SaveRelationshipInput {
  partyId: string;
  displayName: string;
  preferredName: string | null;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance";
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

interface ForecastRepository {
  /**
   * Find a party by display name (partial match)
   */
  findContactByName(name: string): Effect.Effect<ContactRecord | null>;

  /**
   * Resolve a human-readable name to a WhatsApp chat ID (JID)
   *
   * Flow: displayName → party_id → conversation_participants → conversations.externalId
   *
   * Returns null if name not found or no WhatsApp conversation exists
   */
  resolveChatIdByName(name: string): Effect.Effect<string | null>;

  /**
   * Get messages for a party within a time window
   */
  getMessagesForContact(partyId: string, days: number): Effect.Effect<MessageRecord[]>;

  /**
   * Get all relationships marked as 'partner' type
   */
  getPartnerRelationships(): Effect.Effect<RelationshipRecord[]>;

  /**
   * Get all parties with their WhatsApp JIDs and message counts
   * Used for contact setup flow
   */
  getContactsForSetup(): Effect.Effect<ContactWithJid[]>;

  /**
   * Save or update a relationship for a party
   */
  saveRelationship(input: SaveRelationshipInput): Effect.Effect<void>;

  /**
   * Update party's preferred name
   */
  updateContactName(partyId: string, preferredName: string | null): Effect.Effect<void>;
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class ForecastRepositoryTag extends Context.Tag("ForecastRepository")<
  ForecastRepositoryTag,
  ForecastRepository
>() {}

// =============================================================================
// CONSTANTS
// =============================================================================

// WhatsApp channel ID (from seed data)
const WHATSAPP_CHANNEL_ID = "whatsapp";

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  return ForecastRepositoryTag.of({
    findContactByName: (name: string) =>
      Effect.sync(() => {
        const results = db
          .select({
            id: schema.parties.id,
            displayName: schema.parties.displayName,
            preferredName: schema.parties.preferredName,
            partyType: schema.parties.partyType,
          })
          .from(schema.parties)
          .where(sql`lower(${schema.parties.displayName}) LIKE lower(${"%" + name + "%"})`)
          .limit(1)
          .all();

        if (results.length === 0) return null;

        return results[0] as ContactRecord;
      }),

    resolveChatIdByName: (name: string) =>
      Effect.sync(() => {
        // Strategy 1: For direct (1:1) chats, the conversation title often matches the contact name
        // This is the most common case and works without conversation_participants
        const directMatch = db
          .select({
            externalId: schema.conversations.externalId,
          })
          .from(schema.conversations)
          .where(
            and(
              sql`lower(${schema.conversations.title}) LIKE lower(${"%" + name + "%"})`,
              eq(schema.conversations.channelId, WHATSAPP_CHANNEL_ID),
              eq(schema.conversations.conversationType, "direct"),
            ),
          )
          .limit(1)
          .all();

        if (directMatch.length > 0) {
          return directMatch[0].externalId;
        }

        // Strategy 2: Fallback - search via parties table + conversation_participants (for groups)
        const partyResults = db
          .select({
            id: schema.parties.id,
          })
          .from(schema.parties)
          .where(sql`lower(${schema.parties.displayName}) LIKE lower(${"%" + name + "%"})`)
          .limit(1)
          .all();

        if (partyResults.length === 0) return null;

        const partyId = partyResults[0].id;

        // Find conversations via participant mapping
        const conversationResults = db
          .select({
            externalId: schema.conversations.externalId,
          })
          .from(schema.conversationParticipants)
          .innerJoin(schema.conversations, eq(schema.conversationParticipants.conversationId, schema.conversations.id))
          .where(
            and(
              eq(schema.conversationParticipants.partyId, partyId),
              eq(schema.conversations.channelId, WHATSAPP_CHANNEL_ID),
            ),
          )
          .limit(1)
          .all();

        if (conversationResults.length === 0) return null;

        return conversationResults[0].externalId;
      }),

    getMessagesForContact: (partyId: string, days: number) =>
      Effect.sync(() => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // First get conversations for this party
        const convos = db
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .innerJoin(
            schema.conversationParticipants,
            eq(schema.conversations.id, schema.conversationParticipants.conversationId),
          )
          .where(eq(schema.conversationParticipants.partyId, partyId))
          .all();

        if (convos.length === 0) return [];

        const conversationIds = convos.map((c) => c.id);

        // Get communication events from those conversations
        const events = db
          .select({
            id: schema.communicationEvents.id,
            occurredAt: schema.communicationEvents.occurredAt,
            direction: schema.communicationEvents.direction,
          })
          .from(schema.communicationEvents)
          .where(
            and(
              sql`${schema.communicationEvents.conversationId} IN (${sql.join(
                conversationIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              gte(schema.communicationEvents.occurredAt, cutoffDate),
              eq(schema.communicationEvents.eventType, "message"),
            ),
          )
          .orderBy(desc(schema.communicationEvents.occurredAt))
          .limit(1000)
          .all();

        // Get actual message content from messages table
        const messageRecords: MessageRecord[] = [];
        for (const event of events) {
          const msgContent = db
            .select({
              content: schema.messages.content,
            })
            .from(schema.messages)
            .where(eq(schema.messages.eventId, event.id))
            .limit(1)
            .all();

          messageRecords.push({
            id: event.id,
            text: msgContent[0]?.content || null,
            timestamp: event.occurredAt as Date,
            fromMe: event.direction === "outbound",
          });
        }

        return messageRecords;
      }),

    getPartnerRelationships: () =>
      Effect.sync(() => {
        // Join with relationshipTypes to get the type name
        // Note: lastActivityAt is now tracked in engagementMetrics, using updatedAt as fallback
        const results = db
          .select({
            partyId: schema.partyRelationships.partyBId, // The "other" party in relationship
            partyName: schema.parties.displayName,
            relationshipTypeId: schema.partyRelationships.relationshipTypeId,
            strengthScore: schema.partyRelationships.strengthScore,
            lastInteractionAt: schema.partyRelationships.updatedAt,
          })
          .from(schema.partyRelationships)
          .innerJoin(schema.parties, eq(schema.partyRelationships.partyBId, schema.parties.id))
          .innerJoin(
            schema.relationshipTypes,
            eq(schema.partyRelationships.relationshipTypeId, schema.relationshipTypes.id),
          )
          .where(eq(schema.relationshipTypes.name, "partner"))
          .orderBy(desc(schema.partyRelationships.updatedAt))
          .all();

        return results as RelationshipRecord[];
      }),

    getContactsForSetup: () =>
      Effect.sync(() => {
        // Get all parties with their WhatsApp JIDs and message counts, filter for individuals
        const results = db
          .select({
            id: schema.parties.id,
            displayName: schema.parties.displayName,
            preferredName: schema.parties.preferredName,
            partyType: schema.parties.partyType,
          })
          .from(schema.parties)
          .where(eq(schema.parties.partyType, "individual"))
          .all();

        // Enrich with WhatsApp JIDs and message counts
        const enriched: ContactWithJid[] = results.map((party) => {
          // Get WhatsApp JID from conversation
          const convResult = db
            .select({
              externalId: schema.conversations.externalId,
            })
            .from(schema.conversations)
            .where(
              and(
                sql`lower(${schema.conversations.title}) = lower(${party.displayName})`,
                eq(schema.conversations.channelId, WHATSAPP_CHANNEL_ID),
                eq(schema.conversations.conversationType, "direct"),
              ),
            )
            .limit(1)
            .all();

          // Count messages for this party's conversations
          let messageCount = 0;
          if (convResult.length > 0) {
            const countResult = db
              .select({ count: sql<number>`count(*)` })
              .from(schema.communicationEvents)
              .innerJoin(schema.conversations, eq(schema.communicationEvents.conversationId, schema.conversations.id))
              .where(eq(schema.conversations.externalId, convResult[0].externalId))
              .all();
            messageCount = countResult[0]?.count || 0;
          }

          // Get existing relationship type if any
          // Need to join with relationshipTypes to get the name
          const relResult = db
            .select({ typeName: schema.relationshipTypes.name })
            .from(schema.partyRelationships)
            .innerJoin(
              schema.relationshipTypes,
              eq(schema.partyRelationships.relationshipTypeId, schema.relationshipTypes.id),
            )
            .where(eq(schema.partyRelationships.partyBId, party.id))
            .limit(1)
            .all();

          return {
            id: party.id,
            displayName: party.displayName,
            preferredName: party.preferredName,
            partyType: party.partyType as "individual" | "organization",
            whatsappJid: convResult[0]?.externalId || null,
            messageCount,
            relationshipType: (relResult[0]?.typeName as ContactWithJid["relationshipType"]) || null,
          };
        });

        // Sort by message count descending (most active first)
        return enriched.sort((a, b) => b.messageCount - a.messageCount);
      }),

    saveRelationship: (input: SaveRelationshipInput) =>
      Effect.sync(() => {
        const { randomUUID } = require("node:crypto");

        // First, find or create the relationship type
        let relationshipTypeId: string;
        const existingType = db
          .select({ id: schema.relationshipTypes.id })
          .from(schema.relationshipTypes)
          .where(eq(schema.relationshipTypes.name, input.relationshipType))
          .limit(1)
          .all();

        if (existingType.length > 0) {
          relationshipTypeId = existingType[0].id;
        } else {
          // Create the relationship type if it doesn't exist
          relationshipTypeId = randomUUID();
          db.insert(schema.relationshipTypes)
            .values({
              id: relationshipTypeId,
              name: input.relationshipType,
              isSymmetric: true,
              isSystem: false,
              createdAt: new Date(),
            })
            .run();
        }

        // Check if relationship already exists
        // partyAId is typically "me" (the user), partyBId is the contact
        const existing = db
          .select({ id: schema.partyRelationships.id })
          .from(schema.partyRelationships)
          .where(eq(schema.partyRelationships.partyBId, input.partyId))
          .limit(1)
          .all();

        if (existing.length > 0) {
          // Update existing
          db.update(schema.partyRelationships)
            .set({
              relationshipTypeId,
              updatedAt: new Date(),
            })
            .where(eq(schema.partyRelationships.id, existing[0].id))
            .run();
        } else {
          // Insert new - need to get or create "me" party
          // For now, use a placeholder "me" party ID - this should be configured
          const mePartyId = "me"; // TODO: Get actual "me" party from config

          db.insert(schema.partyRelationships)
            .values({
              id: randomUUID(),
              relationshipTypeId,
              partyAId: mePartyId,
              partyBId: input.partyId,
              strengthScore: 50, // Default score
              effectiveFrom: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }

        // Also update preferred name if provided
        if (input.preferredName) {
          db.update(schema.parties)
            .set({
              preferredName: input.preferredName,
              updatedAt: new Date(),
            })
            .where(eq(schema.parties.id, input.partyId))
            .run();
        }
      }),

    updateContactName: (partyId: string, preferredName: string | null) =>
      Effect.sync(() => {
        db.update(schema.parties)
          .set({
            preferredName,
            updatedAt: new Date(),
          })
          .where(eq(schema.parties.id, partyId))
          .run();
      }),
  });
});

// =============================================================================
// LAYER
// =============================================================================

export const ForecastRepositoryLive = Layer.effect(ForecastRepositoryTag, make);
