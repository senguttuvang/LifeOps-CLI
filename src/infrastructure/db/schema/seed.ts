/**
 * Seed Data - Initial channels and relationship types
 *
 * Run during database initialization to populate system data.
 */

import type { NewChannel, NewRelationshipCategory, NewRelationshipType } from "./index";

// =============================================================================
// CHANNELS
// =============================================================================

export const defaultChannels: NewChannel[] = [
  {
    id: "whatsapp",
    displayName: "WhatsApp",
    icon: "📱",
    isSyncEnabled: true,
    isDefault: true,
  },
  {
    id: "email",
    displayName: "Email",
    icon: "📧",
    isSyncEnabled: false,
    isDefault: false,
  },
  {
    id: "phone",
    displayName: "Phone",
    icon: "📞",
    isSyncEnabled: false,
    isDefault: false,
  },
  {
    id: "sms",
    displayName: "SMS",
    icon: "💬",
    isSyncEnabled: false,
    isDefault: false,
  },
  {
    id: "telegram",
    displayName: "Telegram",
    icon: "✈️",
    isSyncEnabled: false,
    isDefault: false,
  },
  {
    id: "linkedin",
    displayName: "LinkedIn",
    icon: "💼",
    isSyncEnabled: false,
    isDefault: false,
  },
  {
    id: "calendar",
    displayName: "Calendar",
    icon: "📅",
    isSyncEnabled: false,
    isDefault: false,
  },
];

// =============================================================================
// RELATIONSHIP CATEGORIES
// =============================================================================

export const defaultRelationshipCategories: NewRelationshipCategory[] = [
  {
    id: "personal",
    name: "Personal",
    description: "Personal relationships (family, friends, partner)",
    displayOrder: 1,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Work and business relationships",
    displayOrder: 2,
  },
  {
    id: "social",
    name: "Social",
    description: "Social and community relationships",
    displayOrder: 3,
  },
];

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

export const defaultRelationshipTypes: NewRelationshipType[] = [
  // Personal
  {
    id: "partner",
    categoryId: "personal",
    name: "Partner",
    inverseName: "Partner",
    isSymmetric: true,
    description: "Romantic partner or spouse",
    icon: "❤️",
    color: "#FF6B6B",
    isSystem: true,
  },
  {
    id: "family",
    categoryId: "personal",
    name: "Family",
    inverseName: "Family",
    isSymmetric: true,
    description: "Family member",
    icon: "👨‍👩‍👧‍👦",
    color: "#4ECDC4",
    isSystem: true,
  },
  {
    id: "friend",
    categoryId: "personal",
    name: "Friend",
    inverseName: "Friend",
    isSymmetric: true,
    description: "Close friend",
    icon: "🤝",
    color: "#45B7D1",
    isSystem: true,
  },
  {
    id: "acquaintance",
    categoryId: "personal",
    name: "Acquaintance",
    inverseName: "Acquaintance",
    isSymmetric: true,
    description: "Casual acquaintance",
    icon: "👋",
    color: "#96CEB4",
    isSystem: true,
  },

  // Professional
  {
    id: "colleague",
    categoryId: "professional",
    name: "Colleague",
    inverseName: "Colleague",
    isSymmetric: true,
    description: "Work colleague",
    icon: "💼",
    color: "#6C5CE7",
    isSystem: true,
  },
  {
    id: "manager",
    categoryId: "professional",
    name: "Manager",
    inverseName: "Report",
    isSymmetric: false,
    description: "Managerial relationship",
    icon: "📊",
    color: "#A29BFE",
    isSystem: true,
  },
  {
    id: "mentor",
    categoryId: "professional",
    name: "Mentor",
    inverseName: "Mentee",
    isSymmetric: false,
    description: "Mentorship relationship",
    icon: "🎓",
    color: "#FFEAA7",
    isSystem: true,
  },
  {
    id: "client",
    categoryId: "professional",
    name: "Client",
    inverseName: "Provider",
    isSymmetric: false,
    description: "Client/service provider relationship",
    icon: "🤝",
    color: "#74B9FF",
    isSystem: true,
  },

  // Social
  {
    id: "neighbor",
    categoryId: "social",
    name: "Neighbor",
    inverseName: "Neighbor",
    isSymmetric: true,
    description: "Neighbor",
    icon: "🏠",
    color: "#FD79A8",
    isSystem: true,
  },
  {
    id: "community",
    categoryId: "social",
    name: "Community Member",
    inverseName: "Community Member",
    isSymmetric: true,
    description: "Member of same community or group",
    icon: "👥",
    color: "#00CEC9",
    isSystem: true,
  },
];
