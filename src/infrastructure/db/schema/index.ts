/**
 * Database Schema v3 - Refactored Data Model
 *
 * Key improvements:
 * - Party pattern: individuals and organizations share base
 * - Configurable relationships with temporal validity
 * - Channel abstraction replacing source enums
 * - Extensibility via tags and custom fields
 * - Audit logging
 *
 * @module schema
 */

// Party Pattern
export {
  individuals,
  organizations,
  parties,
  type Individual,
  type NewIndividual,
  type NewOrganization,
  type NewParty,
  type Organization,
  type Party,
} from "./parties";

// Relationships
export {
  engagementMetrics,
  partyRelationships,
  relationshipCategories,
  relationshipSnapshots,
  relationshipTypes,
  type EngagementMetric,
  type NewEngagementMetric,
  type NewPartyRelationship,
  type NewRelationshipCategory,
  type NewRelationshipSnapshot,
  type NewRelationshipType,
  type PartyRelationship,
  type RelationshipCategory,
  type RelationshipSnapshot,
  type RelationshipType,
} from "./relationships";

// Channels & Contact Points
export {
  channels,
  communicationPreferences,
  contactPoints,
  type Channel,
  type CommunicationPreference,
  type ContactPoint,
  type NewChannel,
  type NewCommunicationPreference,
  type NewContactPoint,
} from "./channels";

// Communications
export {
  calls,
  communicationEvents,
  conversationParticipants,
  conversations,
  meetings,
  messages,
  type Call,
  type CommunicationEvent,
  type Conversation,
  type ConversationParticipant,
  type Meeting,
  type Message,
  type NewCall,
  type NewCommunicationEvent,
  type NewConversation,
  type NewConversationParticipant,
  type NewMeeting,
  type NewMessage,
} from "./communications";

// Analytics
export {
  aiInsights,
  behaviorSignals,
  interactionTopics,
  type AiInsight,
  type BehaviorSignal,
  type InteractionTopic,
  type NewAiInsight,
  type NewBehaviorSignal,
  type NewInteractionTopic,
} from "./analytics";

// Extensibility
export {
  auditLog,
  customFields,
  entityCustomValues,
  entityTags,
  tags,
  type AuditLogEntry,
  type CustomField,
  type EntityCustomValue,
  type EntityTag,
  type NewAuditLogEntry,
  type NewCustomField,
  type NewEntityCustomValue,
  type NewEntityTag,
  type NewTag,
  type Tag,
} from "./extensibility";

// Sync
export { syncState, type NewSyncState, type SyncState } from "./sync";

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================
// These aliases map old v2 table/type names to new v3 equivalents
// to ease migration of existing code.

// Table Aliases
export { parties as contacts } from "./parties";
export { contactPoints as contactIdentifiers } from "./channels";
export { partyRelationships as relationships } from "./relationships";
export { communicationEvents as interactions } from "./communications";
export { behaviorSignals as userSignals } from "./analytics";

// Type Aliases
export type { Party as Contact, NewParty as NewContact } from "./parties";
export type { ContactPoint as ContactIdentifier, NewContactPoint as NewContactIdentifier } from "./channels";
export type { PartyRelationship as Relationship, NewPartyRelationship as NewRelationship } from "./relationships";
export type { CommunicationEvent as Interaction, NewCommunicationEvent as NewInteraction } from "./communications";
export type { BehaviorSignal as UserSignal, NewBehaviorSignal as NewUserSignal } from "./analytics";
