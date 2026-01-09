/**
 * Forecast Repository
 *
 * Database access layer for breakup forecasting.
 * Provides methods to query contacts, messages, and relationships.
 */

import { Context, Effect, Layer } from "effect";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { DatabaseService } from "../../infrastructure/db/client";
import * as schema from "../../infrastructure/db/schema";

// =============================================================================
// TYPES
// =============================================================================

export interface ContactRecord {
  id: string;
  displayName: string;
  preferredName: string | null;
  type: "person" | "business" | "group";
}

export interface RelationshipRecord {
  contactId: string;
  contactName: string;
  relationshipType: string;
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
   * Find a contact by display name (partial match)
   */
  findContactByName(name: string): Effect.Effect<ContactRecord | null>;

  /**
   * Get messages for a contact within a time window
   */
  getMessagesForContact(
    contactId: string,
    days: number,
  ): Effect.Effect<MessageRecord[]>;

  /**
   * Get all relationships marked as 'partner' type
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
        const results = db
          .select({
            id: schema.contacts.id,
            displayName: schema.contacts.displayName,
            preferredName: schema.contacts.preferredName,
            type: schema.contacts.type,
          })
          .from(schema.contacts)
          .where(
            sql`lower(${schema.contacts.displayName}) LIKE lower(${"%" + name + "%"})`
          )
          .limit(1)
          .all();

        if (results.length === 0) return null;

        return results[0] as ContactRecord;
      }),

    getMessagesForContact: (contactId: string, days: number) =>
      Effect.sync(() => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // First get conversations for this contact
        const conversations = db
          .select({ id: schema.conversations.id })
          .from(schema.conversations)
          .innerJoin(
            schema.conversationParticipants,
            eq(schema.conversations.id, schema.conversationParticipants.conversationId)
          )
          .where(eq(schema.conversationParticipants.contactId, contactId))
          .all();

        if (conversations.length === 0) return [];

        const conversationIds = conversations.map(c => c.id);

        // Get messages from those conversations
        const messages = db
          .select({
            id: schema.interactions.id,
            occurredAt: schema.interactions.occurredAt,
            direction: schema.interactions.direction,
            // Join with messages table for text content
          })
          .from(schema.interactions)
          .where(
            and(
              sql`${schema.interactions.conversationId} IN (${sql.join(conversationIds.map(id => sql`${id}`), sql`, `)})`,
              gte(schema.interactions.occurredAt, cutoffDate),
              eq(schema.interactions.interactionType, "message")
            )
          )
          .orderBy(desc(schema.interactions.occurredAt))
          .limit(1000)
          .all();

        // Get actual message content from messages table
        const messageRecords: MessageRecord[] = [];
        for (const interaction of messages) {
          const msgContent = db
            .select({
              content: schema.messages.content,
            })
            .from(schema.messages)
            .where(eq(schema.messages.interactionId, interaction.id))
            .limit(1)
            .all();

          messageRecords.push({
            id: interaction.id,
            text: msgContent[0]?.content || null,
            timestamp: interaction.occurredAt as Date,
            fromMe: interaction.direction === "outbound",
          });
        }

        return messageRecords;
      }),

    getPartnerRelationships: () =>
      Effect.sync(() => {
        const results = db
          .select({
            contactId: schema.relationships.contactId,
            contactName: schema.contacts.displayName,
            relationshipType: schema.relationships.relationshipType,
            strengthScore: schema.relationships.strengthScore,
            lastInteractionAt: schema.relationships.lastInteractionAt,
          })
          .from(schema.relationships)
          .innerJoin(
            schema.contacts,
            eq(schema.relationships.contactId, schema.contacts.id)
          )
          .where(eq(schema.relationships.relationshipType, "partner"))
          .orderBy(desc(schema.relationships.lastInteractionAt))
          .all();

        return results as RelationshipRecord[];
      }),
  });
});

// =============================================================================
// LAYER
// =============================================================================

export const ForecastRepositoryLive = Layer.effect(
  ForecastRepositoryTag,
  make
);
