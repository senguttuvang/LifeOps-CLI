/**
 * Party Schema - People and Organizations
 *
 * Party pattern: abstract base with individual/organization subtypes.
 * Enables modeling both people and organizations uniformly.
 */

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// =============================================================================
// PARTIES (Abstract Base)
// =============================================================================

/**
 * Parties - Abstract base for all contactable entities
 *
 * Both individuals (people) and organizations (companies, teams) are parties.
 * This enables uniform handling while allowing type-specific attributes.
 */
export const parties = sqliteTable(
  "parties",
  {
    id: text("id").primaryKey(), // UUID
    partyType: text("party_type", { enum: ["individual", "organization"] }).notNull(),
    displayName: text("display_name").notNull(),
    preferredName: text("preferred_name"),
    avatarUrl: text("avatar_url"),
    status: text("status", { enum: ["active", "inactive", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    metadata: text("metadata"), // JSON for extensibility
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    typeIdx: index("idx_parties_type").on(table.partyType),
    statusIdx: index("idx_parties_status").on(table.status),
    displayNameIdx: index("idx_parties_display_name").on(table.displayName),
  }),
);

// =============================================================================
// INDIVIDUALS (People)
// =============================================================================

/**
 * Individuals - Person-specific attributes
 *
 * Extends parties for natural persons.
 */
export const individuals = sqliteTable("individuals", {
  partyId: text("party_id")
    .primaryKey()
    .references(() => parties.id, { onDelete: "cascade" }),
  givenName: text("given_name"),
  familyName: text("family_name"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  gender: text("gender"),
  pronouns: text("pronouns"),
  languages: text("languages"), // JSON array
});

// =============================================================================
// ORGANIZATIONS (Companies, Teams, Groups)
// =============================================================================

/**
 * Organizations - Entity-specific attributes
 *
 * Extends parties for companies, teams, communities, family groups.
 * Supports hierarchy via parent_org_id.
 */
export const organizations = sqliteTable(
  "organizations",
  {
    partyId: text("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "cascade" }),
    legalName: text("legal_name"),
    orgType: text("org_type", {
      enum: ["company", "team", "community", "family", "other"],
    }),
    industry: text("industry"),
    sizeRange: text("size_range", {
      enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    }),
    website: text("website"),
    parentOrgId: text("parent_org_id"), // Self-reference to organizations.partyId (FK in SQL)
  },
  (table) => ({
    parentIdx: index("idx_organizations_parent").on(table.parentOrgId),
    typeIdx: index("idx_organizations_type").on(table.orgType),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Individual = typeof individuals.$inferSelect;
export type NewIndividual = typeof individuals.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
