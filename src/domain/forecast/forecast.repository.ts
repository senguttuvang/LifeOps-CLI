/**
 * Forecast Repository
 *
 * Database access layer for breakup forecasting.
 * Provides methods to query contacts, messages, and relationships.
 *
 * v3 Schema Changes:
 * - contacts → parties (with partyType instead of type)
 * - interactions → communicationEvents (with eventType instead of interactionType)
 * - relationships → partyRelationships (with bidirectional partyA/partyB)
 * - messages.interactionId → messages.eventId
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseService } from "../../infrastructure/db/client";
// v3: Import from new schema location with updated table names
import * as schema from "../../infrastructure/db/schema/index";

// =============================================================================
// TYPES
// =============================================================================

export interface ContactRecord {
  id: string;
  displayName: string;
  preferredName: string | null;
  partyType: "individual" | "organization"; // v3: type → partyType
}

export interface RelationshipRecord {
  partyId: string; // v3: contactId → partyId
  partyName: string; // v3: contactName → partyName
  relationshipTypeId: string; // v3: relationshipType → relationshipTypeId
  strengthScore: number | null;
  lastInteractionAt: Date | null;
}

export interface MessageRecord {
  id: string;
  text: string | null;
  timestamp: Date;
  fromMe: boolean;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

interface ForecastRepository {
  /**
   * Find a party by display name (partial match)
   * v3: contacts → parties
   */
  findContactByName(name: string): Effect.Effect<ContactRecord | null>;

  /**
   * Get messages for a party within a time window
   * v3: contactId → partyId
   */
  getMessagesForContact(partyId: string, days: number): Effect.Effect<MessageRecord[]>;

  /**
   * Get all relationships marked as 'partner' type
   * v3: Uses relationshipTypes table with bidirectional partyRelationships
   */
  getPartnerRelationships(): Effect.Effect<RelationshipRecord[]>;
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class ForecastRepositoryTag extends Context.Tag("ForecastRepository")<
  ForecastRepositoryTag,
  ForecastRepository
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  return ForecastRepositoryTag.of({
    findContactByName: (name: string) =>
      Effect.sync(() => {
        // v3: contacts → parties, type → partyType
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

    getMessagesForContact: (partyId: string, days: number) =>
      Effect.sync(() => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // First get conversations for this party
        // v3: contactId → partyId
        const conversations = db
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .innerJoin(
            schema.conversationParticipants,
            eq(schema.conversations.id, schema.conversationParticipants.conversationId),
          )
          .where(eq(schema.conversationParticipants.partyId, partyId))
          .all();

        if (conversations.length === 0) return [];

        const conversationIds = conversations.map((c) => c.id);

        // Get communication events from those conversations
        // v3: interactions → communicationEvents, interactionType → eventType
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
        // v3: interactionId → eventId
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
        // v3: relationships → partyRelationships with bidirectional structure
        // Join with relationshipTypes to get the type name
        // In v3, we look for relationship type "partner" in the relationshipTypes table
        // Note: lastActivityAt is now tracked in engagementMetrics, using updatedAt as fallback
        const results = db
          .select({
            partyId: schema.partyRelationships.partyBId, // The "other" party in relationship
            partyName: schema.parties.displayName,
            relationshipTypeId: schema.partyRelationships.relationshipTypeId,
            strengthScore: schema.partyRelationships.strengthScore,
            lastInteractionAt: schema.partyRelationships.updatedAt, // v3: using updatedAt as proxy
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
  });
});

// =============================================================================
// LAYER
// =============================================================================

export const ForecastRepositoryLive = Layer.effect(ForecastRepositoryTag, make);
