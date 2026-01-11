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

// Analytics
export {
  type AiInsight,
  aiInsights,
  type BehaviorSignal,
  behaviorSignals,
  type InteractionTopic,
  interactionTopics,
  type NewAiInsight,
  type NewBehaviorSignal,
  type NewInteractionTopic,
} from "./analytics";
// Channels & Contact Points
export {
  type Channel,
  type CommunicationPreference,
  type ContactPoint,
  channels,
  communicationPreferences,
  contactPoints,
  type NewChannel,
  type NewCommunicationPreference,
  type NewContactPoint,
} from "./channels";
// Communications
export {
  type Call,
  type CommunicationEvent,
  type Conversation,
  type ConversationParticipant,
  calls,
  communicationEvents,
  conversationParticipants,
  conversations,
  type Meeting,
  type Message,
  meetings,
  messages,
  type NewCall,
  type NewCommunicationEvent,
  type NewConversation,
  type NewConversationParticipant,
  type NewMeeting,
  type NewMessage,
} from "./communications";
// Extensibility
export {
  type AuditLogEntry,
  auditLog,
  type CustomField,
  customFields,
  type EntityCustomValue,
  type EntityTag,
  entityCustomValues,
  entityTags,
  type NewAuditLogEntry,
  type NewCustomField,
  type NewEntityCustomValue,
  type NewEntityTag,
  type NewTag,
  type Tag,
  tags,
} from "./extensibility";
// Party Pattern
export {
  type Individual,
  individuals,
  type NewIndividual,
  type NewOrganization,
  type NewParty,
  type Organization,
  organizations,
  type Party,
  parties,
} from "./parties";
// Relationships
export {
  type EngagementMetric,
  engagementMetrics,
  type NewEngagementMetric,
  type NewPartyRelationship,
  type NewRelationshipCategory,
  type NewRelationshipSnapshot,
  type NewRelationshipType,
  type PartyRelationship,
  partyRelationships,
  type RelationshipCategory,
  type RelationshipSnapshot,
  type RelationshipType,
  relationshipCategories,
  relationshipSnapshots,
  relationshipTypes,
} from "./relationships";

// Sync
export { type NewSyncState, type SyncState, syncState } from "./sync";

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================
// These aliases map old v2 table/type names to new v3 equivalents
// to ease migration of existing code.

export type { BehaviorSignal as UserSignal, NewBehaviorSignal as NewUserSignal } from "./analytics";
export { behaviorSignals as userSignals } from "./analytics";
export type { ContactPoint as ContactIdentifier, NewContactPoint as NewContactIdentifier } from "./channels";
export { contactPoints as contactIdentifiers } from "./channels";
export type { CommunicationEvent as Interaction, NewCommunicationEvent as NewInteraction } from "./communications";
export { communicationEvents as interactions } from "./communications";
// Type Aliases
export type { NewParty as NewContact, Party as Contact } from "./parties";
// Table Aliases
export { parties as contacts } from "./parties";
export type { NewPartyRelationship as NewRelationship, PartyRelationship as Relationship } from "./relationships";
export { partyRelationships as relationships } from "./relationships";
