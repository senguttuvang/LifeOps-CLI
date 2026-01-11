/**
 * Channels Schema - Communication Channels and Contact Points
 *
 * Replaces hardcoded source enums with configurable channels.
 * Contact points link parties to their identifiers on each channel.
 */

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { parties } from "./parties";

// =============================================================================
// CHANNELS
// =============================================================================

/**
 * Channels - Communication channel definitions
 *
 * Examples: whatsapp, email, phone, telegram, linkedin
 * Replaces hardcoded source enums for extensibility.
 */
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(), // "whatsapp", "email", etc.
  displayName: text("display_name").notNull(),
  icon: text("icon"), // Emoji or icon name
  isSyncEnabled: integer("is_sync_enabled", { mode: "boolean" }).default(false),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  config: text("config"), // JSON for channel-specific settings
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// =============================================================================
// CONTACT POINTS
// =============================================================================

/**
 * Contact Points - Party identifiers on channels
 *
 * Replaces contact_identifiers with a cleaner model.
 * One party can have multiple contact points per channel.
 *
 * Example:
 * - party: "John", channel: "email", value: "john@work.com", label: "work"
 * - party: "John", channel: "email", value: "john@gmail.com", label: "personal"
 */
export const contactPoints = sqliteTable(
  "contact_points",
  {
    id: text("id").primaryKey(), // UUID
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    value: text("value").notNull(), // Email address, phone number, handle
    normalized: text("normalized"), // Normalized form (e.g., +919876543210)
    label: text("label"), // "work", "personal", "mobile"
    isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
    isVerified: integer("is_verified", { mode: "boolean" }).default(false),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    metadata: text("metadata"), // JSON for channel-specific data
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    partyIdx: index("idx_contact_points_party").on(table.partyId),
    channelIdx: index("idx_contact_points_channel").on(table.channelId),
    channelValueIdx: index("idx_contact_points_channel_value").on(table.channelId, table.normalized),
    primaryIdx: index("idx_contact_points_primary").on(table.partyId, table.channelId, table.isPrimary),
  }),
);

// =============================================================================
// COMMUNICATION PREFERENCES
// =============================================================================

/**
 * Communication Preferences - Per-party, per-channel preferences
 *
 * Tracks opt-in/opt-out status and preferred communication windows.
 */
export const communicationPreferences = sqliteTable(
  "communication_preferences",
  {
    id: text("id").primaryKey(), // UUID
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    preferenceType: text("preference_type", {
      enum: ["preferred", "allowed", "opt_out"],
    })
      .notNull()
      .default("allowed"),
    preferredHours: text("preferred_hours"), // JSON: { start: "09:00", end: "21:00" }
    preferredDays: text("preferred_days"), // JSON: ["monday", "tuesday", ...]
    notes: text("notes"),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).default(sql`(unixepoch())`),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    partyChannelIdx: index("idx_communication_preferences_party_channel").on(
      table.partyId,
      table.channelId,
    ),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ContactPoint = typeof contactPoints.$inferSelect;
export type NewContactPoint = typeof contactPoints.$inferInsert;
export type CommunicationPreference = typeof communicationPreferences.$inferSelect;
export type NewCommunicationPreference = typeof communicationPreferences.$inferInsert;
