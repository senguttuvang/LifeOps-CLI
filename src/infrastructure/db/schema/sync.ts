/**
 * Sync Schema - Track sync state per channel
 */

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { channels } from "./channels";

// =============================================================================
// SYNC STATE
// =============================================================================

/**
 * Sync State - Track sync progress per channel
 *
 * Enables incremental sync (fetch only new data since last sync).
 * Uses highestMessageTimestamp in metadata for watermark-based sync.
 *
 * Note: No cursor field - WhatsApp doesn't provide delta sync cursors.
 * Instead, we track highestMessageTimestamp in metadata JSON.
 */
export const syncState = sqliteTable(
  "sync_state",
  {
    id: text("id").primaryKey(), // Channel ID or composite key
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    lastSyncStatus: text("last_sync_status", {
      enum: ["success", "partial", "failed"],
    }),
    errorMessage: text("error_message"),
    syncedCount: integer("synced_count").default(0), // Items synced in last run
    totalCount: integer("total_count").default(0), // Total items known
    metadata: text("metadata"), // JSON: { highestMessageTimestamp, syncMode, ... }
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => ({
    channelIdx: index("idx_sync_state_channel").on(table.channelId),
    statusIdx: index("idx_sync_state_status").on(table.lastSyncStatus),
  }),
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;
