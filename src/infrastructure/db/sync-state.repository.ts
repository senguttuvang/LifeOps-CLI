/**
 * Sync State Repository
 *
 * Encapsulates all sync state operations for watermark-based incremental sync.
 * Follows the Repository pattern from DDD.
 *
 * Key Responsibilities:
 * 1. Track sync watermarks (lastSyncAt, highestMessageTimestamp in metadata)
 * 2. Record sync success/failure with statistics
 * 3. Support metadata for enhanced tracking (gaps, modes)
 *
 * Note: No cursor field - WhatsApp doesn't provide delta sync cursors.
 * We use highestMessageTimestamp in metadata instead.
 *
 * @see docs/architecture/whatsapp-sync.md#syncstaterepository-abstraction
 */

import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseService } from "./client";
import { syncState as syncStateTable } from "./schema/sync";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sync statistics recorded after each sync operation
 */
export interface SyncStats {
  readonly syncedCount: number;
  readonly totalCount?: number;
  readonly syncedAt: Date;
}

/**
 * Enhanced metadata for tracking sync state
 * Stored as JSON in the metadata column
 */
export interface SyncMetadata {
  readonly highestMessageTimestamp?: number;
  readonly lastEventId?: string;
  readonly syncMode?: "full" | "incremental" | "realtime";
  readonly deviceId?: string;
  readonly sessionStart?: number;
  readonly gaps?: Array<{
    from: number;
    to: number;
    reason: string;
  }>;
}

/**
 * Watermark for incremental sync
 *
 * Uses metadata.highestMessageTimestamp for WhatsApp sync
 * since WhatsApp doesn't provide delta cursors.
 */
export interface SyncWatermark {
  readonly lastSyncAt: Date;
  readonly metadata: SyncMetadata | null;
}

/**
 * Full sync state record
 */
export interface SyncStateRecord {
  readonly id: string;
  readonly channelId: string;
  readonly lastSyncAt: Date | null;
  readonly lastSyncStatus: "success" | "partial" | "failed" | null;
  readonly errorMessage: string | null;
  readonly syncedCount: number;
  readonly totalCount: number;
  readonly metadata: SyncMetadata | null;
}

// =============================================================================
// INTERFACE
// =============================================================================

/**
 * Sync State Repository Interface
 *
 * Provides operations for tracking sync state across channels.
 * Used by SyncService for watermark-based incremental sync.
 */
export interface SyncStateRepository {
  /**
   * Get current sync state for a channel
   *
   * @param channelId - Channel identifier (e.g., "whatsapp")
   * @returns Full sync state or null if not found
   */
  readonly getState: (channelId: string) => Effect.Effect<SyncStateRecord | null, Error>;

  /**
   * Get watermark for incremental sync
   *
   * @param channelId - Channel identifier
   * @returns Watermark with lastSyncAt and cursor, or null if never synced
   */
  readonly getWatermark: (channelId: string) => Effect.Effect<SyncWatermark | null, Error>;

  /**
   * Record successful sync
   *
   * @param channelId - Channel identifier
   * @param stats - Sync statistics (count, timestamp)
   */
  readonly recordSuccess: (channelId: string, stats: SyncStats) => Effect.Effect<void, Error>;

  /**
   * Record failed sync
   *
   * @param channelId - Channel identifier
   * @param error - Error message
   */
  readonly recordFailure: (channelId: string, error: string) => Effect.Effect<void, Error>;

  /**
   * Update metadata (for enhanced tracking)
   *
   * @param channelId - Channel identifier
   * @param metadata - Partial metadata to merge
   */
  readonly updateMetadata: (channelId: string, metadata: Partial<SyncMetadata>) => Effect.Effect<void, Error>;
}

// =============================================================================
// SERVICE TAG
// =============================================================================

/**
 * Service Tag for dependency injection
 */
export class SyncStateRepositoryTag extends Context.Tag("SyncStateRepository")<
  SyncStateRepositoryTag,
  SyncStateRepository
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Live implementation using SQLite
 */
export const SyncStateRepositoryLive = Layer.effect(
  SyncStateRepositoryTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;

    /**
     * Get state for a channel
     */
    const getState = (channelId: string): Effect.Effect<SyncStateRecord | null, Error> =>
      Effect.tryPromise({
        try: async () => {
          const result = await db.select().from(syncStateTable).where(eq(syncStateTable.id, channelId)).limit(1);

          if (result.length === 0) {
            return null;
          }

          const row = result[0];
          return {
            id: row.id,
            channelId: row.channelId,
            lastSyncAt: row.lastSyncAt,
            lastSyncStatus: row.lastSyncStatus as "success" | "partial" | "failed" | null,
            errorMessage: row.errorMessage,
            syncedCount: row.syncedCount ?? 0,
            totalCount: row.totalCount ?? 0,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
          };
        },
        catch: (e) => new Error(`Failed to get sync state: ${e}`),
      });

    /**
     * Get watermark for incremental sync
     */
    const getWatermark = (channelId: string): Effect.Effect<SyncWatermark | null, Error> =>
      Effect.gen(function* () {
        const state = yield* getState(channelId);

        if (!state || !state.lastSyncAt) {
          return null;
        }

        return {
          lastSyncAt: state.lastSyncAt,
          metadata: state.metadata,
        };
      });

    /**
     * Record successful sync
     */
    const recordSuccess = (channelId: string, stats: SyncStats): Effect.Effect<void, Error> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .insert(syncStateTable)
            .values({
              id: channelId,
              channelId: channelId,
              lastSyncAt: stats.syncedAt,
              lastSyncStatus: "success",
              syncedCount: stats.syncedCount,
              totalCount: stats.totalCount ?? 0,
              errorMessage: null,
            })
            .onConflictDoUpdate({
              target: syncStateTable.id,
              set: {
                lastSyncAt: stats.syncedAt,
                lastSyncStatus: "success",
                syncedCount: stats.syncedCount,
                totalCount: stats.totalCount ?? 0,
                errorMessage: null,
                updatedAt: new Date(),
              },
            });
        },
        catch: (e) => new Error(`Failed to record sync success: ${e}`),
      });

    /**
     * Record failed sync
     */
    const recordFailure = (channelId: string, error: string): Effect.Effect<void, Error> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .insert(syncStateTable)
            .values({
              id: channelId,
              channelId: channelId,
              lastSyncStatus: "failed",
              errorMessage: error,
            })
            .onConflictDoUpdate({
              target: syncStateTable.id,
              set: {
                lastSyncStatus: "failed",
                errorMessage: error,
                updatedAt: new Date(),
              },
            });
        },
        catch: (e) => new Error(`Failed to record sync failure: ${e}`),
      });

    /**
     * Update metadata
     */
    const updateMetadata = (channelId: string, metadata: Partial<SyncMetadata>): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        const existing = yield* getState(channelId);
        const mergedMetadata = { ...(existing?.metadata ?? {}), ...metadata };

        yield* Effect.tryPromise({
          try: async () => {
            await db
              .insert(syncStateTable)
              .values({
                id: channelId,
                channelId: channelId,
                metadata: JSON.stringify(mergedMetadata),
              })
              .onConflictDoUpdate({
                target: syncStateTable.id,
                set: {
                  metadata: JSON.stringify(mergedMetadata),
                  updatedAt: new Date(),
                },
              });
          },
          catch: (e) => new Error(`Failed to update metadata: ${e}`),
        });
      });

    return {
      getState,
      getWatermark,
      recordSuccess,
      recordFailure,
      updateMetadata,
    };
  }),
);
