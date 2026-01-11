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
import { conversationParticipants, conversations } from "../../infrastructure/db/schema";

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

export interface ContactWithJid {
  id: string;
  displayName: string;
  preferredName: string | null;
  type: "person" | "business" | "group";
  whatsappJid: string | null;
  messageCount: number;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance" | null;
}

export interface SaveRelationshipInput {
  contactId: string;
  displayName: string;
  preferredName: string | null;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance";
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
   * Resolve a human-readable name to a WhatsApp chat ID (JID)
   *
   * Flow: displayName → contact_id → conversation_participants → conversations.sourceConversationId
   *
   * Returns null if name not found or no WhatsApp conversation exists
   */
  resolveChatIdByName(name: string): Effect.Effect<string | null>;

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

  /**
   * Get all contacts with their WhatsApp JIDs and message counts
   * Used for contact setup flow
   */
  getContactsForSetup(): Effect.Effect<ContactWithJid[]>;

  /**
   * Save or update a relationship for a contact
   */
  saveRelationship(input: SaveRelationshipInput): Effect.Effect<void>;

  /**
   * Update contact's preferred name
   */
  updateContactName(contactId: string, preferredName: string | null): Effect.Effect<void>;
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

    resolveChatIdByName: (name: string) =>
      Effect.sync(() => {
        // Strategy 1: For 1:1 chats, the conversation title often matches the contact name
        // This is the most common case and works without conversation_participants
        const directMatch = db
          .select({
            sourceConversationId: conversations.sourceConversationId,
          })
          .from(conversations)
          .where(
            and(
              sql`lower(${conversations.title}) LIKE lower(${"%" + name + "%"})`,
              eq(conversations.source, "whatsapp"),
              eq(conversations.conversationType, "1:1")
            )
          )
          .limit(1)
          .all();

        if (directMatch.length > 0) {
          return directMatch[0].sourceConversationId;
        }

        // Strategy 2: Fallback - search via contacts table + conversation_participants (for groups)
        const contactResults = db
          .select({
            id: schema.contacts.id,
          })
          .from(schema.contacts)
          .where(
            sql`lower(${schema.contacts.displayName}) LIKE lower(${"%" + name + "%"})`
          )
          .limit(1)
          .all();

        if (contactResults.length === 0) return null;

        const contactId = contactResults[0].id;

        // Find conversations via participant mapping
        const conversationResults = db
          .select({
            sourceConversationId: conversations.sourceConversationId,
          })
          .from(conversationParticipants)
          .innerJoin(
            conversations,
            eq(conversationParticipants.conversationId, conversations.id)
          )
          .where(
            and(
              eq(conversationParticipants.contactId, contactId),
              eq(conversations.source, "whatsapp")
            )
          )
          .limit(1)
          .all();

        if (conversationResults.length === 0) return null;

        return conversationResults[0].sourceConversationId;
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

    getContactsForSetup: () =>
      Effect.sync(() => {
        // Get all contacts with their WhatsApp JIDs and message counts
        // Exclude groups, only get individuals
        const results = db
          .select({
            id: schema.contacts.id,
            displayName: schema.contacts.displayName,
            preferredName: schema.contacts.preferredName,
            type: schema.contacts.type,
          })
          .from(schema.contacts)
          .where(eq(schema.contacts.type, "person"))
          .all();

        // Enrich with WhatsApp JIDs and message counts
        const enriched: ContactWithJid[] = results.map((contact) => {
          // Get WhatsApp JID from conversation
          const convResult = db
            .select({
              sourceConversationId: conversations.sourceConversationId,
            })
            .from(conversations)
            .where(
              and(
                sql`lower(${conversations.title}) = lower(${contact.displayName})`,
                eq(conversations.source, "whatsapp"),
                eq(conversations.conversationType, "1:1")
              )
            )
            .limit(1)
            .all();

          // Count messages for this contact's conversations
          let messageCount = 0;
          if (convResult.length > 0) {
            const countResult = db
              .select({ count: sql<number>`count(*)` })
              .from(schema.interactions)
              .innerJoin(
                conversations,
                eq(schema.interactions.conversationId, conversations.id)
              )
              .where(
                eq(conversations.sourceConversationId, convResult[0].sourceConversationId)
              )
              .all();
            messageCount = countResult[0]?.count || 0;
          }

          // Get existing relationship type if any
          const relResult = db
            .select({ relationshipType: schema.relationships.relationshipType })
            .from(schema.relationships)
            .where(eq(schema.relationships.contactId, contact.id))
            .limit(1)
            .all();

          return {
            id: contact.id,
            displayName: contact.displayName,
            preferredName: contact.preferredName,
            type: contact.type as "person" | "business" | "group",
            whatsappJid: convResult[0]?.sourceConversationId || null,
            messageCount,
            relationshipType: (relResult[0]?.relationshipType as ContactWithJid["relationshipType"]) || null,
          };
        });

        // Sort by message count descending (most active first)
        return enriched.sort((a, b) => b.messageCount - a.messageCount);
      }),

    saveRelationship: (input: SaveRelationshipInput) =>
      Effect.sync(() => {
        const { randomUUID } = require("node:crypto");

        // Check if relationship already exists
        const existing = db
          .select({ id: schema.relationships.id })
          .from(schema.relationships)
          .where(eq(schema.relationships.contactId, input.contactId))
          .limit(1)
          .all();

        if (existing.length > 0) {
          // Update existing
          db.update(schema.relationships)
            .set({
              relationshipType: input.relationshipType,
              updatedAt: new Date(),
            })
            .where(eq(schema.relationships.id, existing[0].id))
            .run();
        } else {
          // Insert new
          db.insert(schema.relationships)
            .values({
              id: randomUUID(),
              contactId: input.contactId,
              relationshipType: input.relationshipType,
              strengthScore: 50, // Default score
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }

        // Also update preferred name if provided
        if (input.preferredName) {
          db.update(schema.contacts)
            .set({
              preferredName: input.preferredName,
              updatedAt: new Date(),
            })
            .where(eq(schema.contacts.id, input.contactId))
            .run();
        }
      }),

    updateContactName: (contactId: string, preferredName: string | null) =>
      Effect.sync(() => {
        db.update(schema.contacts)
          .set({
            preferredName,
            updatedAt: new Date(),
          })
          .where(eq(schema.contacts.id, contactId))
          .run();
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
