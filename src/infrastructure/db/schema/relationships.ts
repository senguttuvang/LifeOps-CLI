/**
 * Relationships Schema - Configurable, Bidirectional Relationships
 *
 * Key improvements over v2:
 * - Relationship types are configurable (not enum)
 * - Bidirectional with roles (party_a, party_b)
 * - Temporal validity (effective_from, effective_to)
 */

import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { parties } from "./parties";

// =============================================================================
// RELATIONSHIP CATEGORIES
// =============================================================================

/**
 * Relationship Categories - High-level grouping
 *
 * Examples: Personal, Professional, Social
 */
export const relationshipCategories = sqliteTable("relationship_categories", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull().unique(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

/**
 * Relationship Types - Configurable relationship definitions
 *
 * Examples:
 * - name: "manages", inverse_name: "reports_to", is_symmetric: false
 * - name: "friend", inverse_name: "friend", is_symmetric: true
 * - name: "partner", inverse_name: "partner", is_symmetric: true
 */
export const relationshipTypes = sqliteTable(
  "relationship_types",
  {
    id: text("id").primaryKey(), // UUID
    categoryId: text("category_id").references(() => relationshipCategories.id),
    name: text("name").notNull().unique(),
    inverseName: text("inverse_name"), // For asymmetric relationships
    isSymmetric: integer("is_symmetric", { mode: "boolean" }).default(true),
    description: text("description"),
    icon: text("icon"), // Emoji or icon name
    color: text("color"), // Hex color for UI
    isSystem: integer("is_system", { mode: "boolean" }).default(false), // Built-in vs user-created
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    categoryIdx: index("idx_relationship_types_category").on(table.categoryId),
  }),
);

// =============================================================================
// PARTY RELATIONSHIPS
// =============================================================================

/**
 * Party Relationships - Bidirectional relationship instances
 *
 * Links two parties with a typed relationship.
 * Supports temporal validity for historical tracking.
 *
 * Example:
 * - party_a: "John", party_b: "Sarah", type: "manages"
 * - role_a: "manager", role_b: "direct_report"
 * - effective_from: 2025-01-01, effective_to: NULL (active)
 */
export const partyRelationships = sqliteTable(
  "party_relationships",
  {
    id: text("id").primaryKey(), // UUID
    relationshipTypeId: text("relationship_type_id")
      .notNull()
      .references(() => relationshipTypes.id),
    partyAId: text("party_a_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    partyBId: text("party_b_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    roleA: text("role_a"), // Role party_a plays
    roleB: text("role_b"), // Role party_b plays
    strengthScore: integer("strength_score").default(0), // 0-100
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }), // NULL = active
    notes: text("notes"),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    typeIdx: index("idx_party_relationships_type").on(table.relationshipTypeId),
    partyAIdx: index("idx_party_relationships_party_a").on(table.partyAId),
    partyBIdx: index("idx_party_relationships_party_b").on(table.partyBId),
    effectiveIdx: index("idx_party_relationships_effective").on(table.effectiveFrom, table.effectiveTo),
  }),
);

// =============================================================================
// RELATIONSHIP SNAPSHOTS (Time-Series Health)
// =============================================================================

/**
 * Relationship Snapshots - Point-in-time health scores
 *
 * Captures relationship health metrics over time for trend analysis.
 */
export const relationshipSnapshots = sqliteTable(
  "relationship_snapshots",
  {
    id: text("id").primaryKey(), // UUID
    relationshipId: text("relationship_id")
      .notNull()
      .references(() => partyRelationships.id, { onDelete: "cascade" }),
    snapshotDate: integer("snapshot_date", { mode: "timestamp" }).notNull(),
    periodType: text("period_type", { enum: ["daily", "weekly", "monthly"] })
      .notNull()
      .default("weekly"),
    healthScore: integer("health_score").notNull(), // 0-100
    factors: text("factors").notNull(), // JSON: { frequency: 80, response: 70, ... }
    alerts: text("alerts"), // JSON array: [{ type: "drift", severity: "medium" }]
    eventCount: integer("event_count").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    relationshipDateIdx: index("idx_relationship_snapshots_date").on(
      table.relationshipId,
      table.snapshotDate,
    ),
  }),
);

// =============================================================================
// ENGAGEMENT METRICS
// =============================================================================

/**
 * Engagement Metrics - Streaks, reciprocity, gamification
 */
export const engagementMetrics = sqliteTable(
  "engagement_metrics",
  {
    id: text("id").primaryKey(), // UUID
    relationshipId: text("relationship_id")
      .notNull()
      .references(() => partyRelationships.id, { onDelete: "cascade" }),
    metricType: text("metric_type", {
      enum: ["streak", "reciprocity", "frequency", "response_time"],
    }).notNull(),
    metricKey: text("metric_key").notNull(), // "daily_message", "weekly_call"
    currentValue: integer("current_value").default(0),
    bestValue: integer("best_value").default(0),
    avgValue: real("avg_value"),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),
    brokenAt: integer("broken_at", { mode: "timestamp" }),
    metadata: text("metadata"), // JSON
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    relationshipIdx: index("idx_engagement_metrics_relationship").on(table.relationshipId),
    typeKeyIdx: index("idx_engagement_metrics_type_key").on(table.metricType, table.metricKey),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RelationshipCategory = typeof relationshipCategories.$inferSelect;
export type NewRelationshipCategory = typeof relationshipCategories.$inferInsert;
export type RelationshipType = typeof relationshipTypes.$inferSelect;
export type NewRelationshipType = typeof relationshipTypes.$inferInsert;
export type PartyRelationship = typeof partyRelationships.$inferSelect;
export type NewPartyRelationship = typeof partyRelationships.$inferInsert;
export type RelationshipSnapshot = typeof relationshipSnapshots.$inferSelect;
export type NewRelationshipSnapshot = typeof relationshipSnapshots.$inferInsert;
export type EngagementMetric = typeof engagementMetrics.$inferSelect;
export type NewEngagementMetric = typeof engagementMetrics.$inferInsert;
