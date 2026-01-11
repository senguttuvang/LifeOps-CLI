/**
 * Extensibility Schema - Tags, Custom Fields, Audit Log
 *
 * Enables user customization without schema changes.
 */

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// =============================================================================
// TAGS
// =============================================================================

/**
 * Tags - User-defined labels
 *
 * Examples: "VIP", "inactive", "needs-followup"
 */
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull().unique(),
  color: text("color"), // Hex color
  icon: text("icon"), // Emoji or icon name
  description: text("description"),
  tagGroup: text("tag_group"), // "status", "priority", "custom"
  displayOrder: integer("display_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// =============================================================================
// ENTITY TAGS (Polymorphic)
// =============================================================================

/**
 * Entity Tags - Links tags to entities
 *
 * Polymorphic: works for parties, relationships, conversations.
 */
export const entityTags = sqliteTable(
  "entity_tags",
  {
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    entityType: text("entity_type", {
      enum: ["party", "relationship", "conversation", "event"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    appliedBy: text("applied_by"), // User or system
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tagId, table.entityType, table.entityId] }),
    entityIdx: index("idx_entity_tags_entity").on(table.entityType, table.entityId),
    tagIdx: index("idx_entity_tags_tag").on(table.tagId),
  }),
);

// =============================================================================
// CUSTOM FIELDS (EAV Pattern)
// =============================================================================

/**
 * Custom Fields - User-defined attributes
 *
 * EAV (Entity-Attribute-Value) pattern for extensibility.
 */
export const customFields = sqliteTable(
  "custom_fields",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(),
    fieldType: text("field_type", {
      enum: ["text", "number", "date", "boolean", "select", "multiselect", "url"],
    }).notNull(),
    entityType: text("entity_type", {
      enum: ["party", "relationship", "conversation"],
    }).notNull(),
    options: text("options"), // JSON for select/multiselect options
    defaultValue: text("default_value"),
    isRequired: integer("is_required", { mode: "boolean" }).default(false),
    displayOrder: integer("display_order").default(0),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    entityTypeIdx: index("idx_custom_fields_entity_type").on(table.entityType),
  }),
);

// =============================================================================
// ENTITY CUSTOM VALUES
// =============================================================================

/**
 * Entity Custom Values - Values for custom fields
 */
export const entityCustomValues = sqliteTable(
  "entity_custom_values",
  {
    fieldId: text("field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    entityType: text("entity_type", {
      enum: ["party", "relationship", "conversation"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    value: text("value"), // Stored as text, parsed by field_type
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.fieldId, table.entityType, table.entityId] }),
    entityIdx: index("idx_entity_custom_values_entity").on(table.entityType, table.entityId),
    fieldIdx: index("idx_entity_custom_values_field").on(table.fieldId),
  }),
);

// =============================================================================
// AUDIT LOG
// =============================================================================

/**
 * Audit Log - Track all changes
 *
 * For compliance, debugging, and history.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(), // UUID
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", {
      enum: ["create", "update", "delete", "archive", "restore"],
    }).notNull(),
    oldValues: text("old_values"), // JSON: previous state
    newValues: text("new_values"), // JSON: new state
    changedFields: text("changed_fields"), // JSON array of field names
    changedBy: text("changed_by"), // User or system identifier
    changedAt: integer("changed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    metadata: text("metadata"), // JSON for additional context
  },
  (table) => ({
    entityIdx: index("idx_audit_log_entity").on(table.entityType, table.entityId),
    changedAtIdx: index("idx_audit_log_changed_at").on(table.changedAt),
    actionIdx: index("idx_audit_log_action").on(table.action),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type EntityTag = typeof entityTags.$inferSelect;
export type NewEntityTag = typeof entityTags.$inferInsert;
export type CustomField = typeof customFields.$inferSelect;
export type NewCustomField = typeof customFields.$inferInsert;
export type EntityCustomValue = typeof entityCustomValues.$inferSelect;
export type NewEntityCustomValue = typeof entityCustomValues.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
