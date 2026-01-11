/**
 * Sync State Repository Tests
 *
 * Tests the SyncStateRepository interface and mock implementation.
 * Uses the in-memory mock for unit tests.
 *
 * @see src/infrastructure/db/sync-state.repository.ts
 * @see docs/architecture/whatsapp-sync.md#syncstaterepository-abstraction
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Effect } from "effect";
import {
  SyncStateRepositoryTag,
  createMockSyncStateRepositoryLayer,
  type SyncStateRecord,
} from "./helpers/mock-layers";
import { expectSuccess, expectFailure } from "./helpers/effect-test";

describe("SyncStateRepository", () => {
  describe("getState", () => {
    it("should return null for non-existent channel", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).toBeNull();
    });

    it("should return state for existing channel", async () => {
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: new Date("2026-01-10"),
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: 100,
        totalCount: 500,
        metadata: { syncMode: "full" },
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).toEqual(existingState);
    });
  });

  describe("getWatermark", () => {
    it("should return null when no sync has occurred", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        return yield* repo.getWatermark("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).toBeNull();
    });

    it("should return watermark from existing state", async () => {
      const lastSync = new Date("2026-01-10T10:00:00Z");
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: lastSync,
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: 100,
        totalCount: 500,
        metadata: { highestMessageTimestamp: 1704931200 },
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        return yield* repo.getWatermark("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).not.toBeNull();
      expect(result?.lastSyncAt).toEqual(lastSync);
      expect(result?.metadata?.highestMessageTimestamp).toBe(1704931200);
    });
  });

  describe("recordSuccess", () => {
    it("should create new state on first sync", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();
      const syncedAt = new Date();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.recordSuccess("whatsapp", { syncedCount: 50, totalCount: 200, syncedAt });
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).not.toBeNull();
      expect(result?.channelId).toBe("whatsapp");
      expect(result?.lastSyncStatus).toBe("success");
      expect(result?.syncedCount).toBe(50);
      expect(result?.totalCount).toBe(200);
      expect(result?.lastSyncAt).toEqual(syncedAt);
    });

    it("should update existing state on subsequent sync", async () => {
      const firstSync = new Date("2026-01-09");
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: firstSync,
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: 50,
        totalCount: 200,
        metadata: { syncMode: "full" },
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });
      const secondSync = new Date("2026-01-10");

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.recordSuccess("whatsapp", { syncedCount: 25, totalCount: 225, syncedAt: secondSync });
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.syncedCount).toBe(25);
      expect(result?.totalCount).toBe(225);
      expect(result?.lastSyncAt).toEqual(secondSync);
      // Metadata should be preserved
      expect(result?.metadata?.syncMode).toBe("full");
    });

    it("should clear error message on success", async () => {
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: new Date("2026-01-08"),
        lastSyncStatus: "failed",
        errorMessage: "Previous error",
        syncedCount: 0,
        totalCount: 0,
        metadata: null,
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.recordSuccess("whatsapp", { syncedCount: 10, syncedAt: new Date() });
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.lastSyncStatus).toBe("success");
      expect(result?.errorMessage).toBeNull();
    });
  });

  describe("recordFailure", () => {
    it("should record failure status and error message", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.recordFailure("whatsapp", "Connection timeout");
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.lastSyncStatus).toBe("failed");
      expect(result?.errorMessage).toBe("Connection timeout");
    });

    it("should preserve lastSyncAt from previous successful sync", async () => {
      const previousSync = new Date("2026-01-09");
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: previousSync,
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: 100,
        totalCount: 500,
        metadata: null,
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.recordFailure("whatsapp", "Network error");
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.lastSyncStatus).toBe("failed");
      expect(result?.lastSyncAt).toEqual(previousSync); // Preserved
      expect(result?.syncedCount).toBe(100); // Preserved
    });
  });

  describe("updateMetadata", () => {
    it("should create state with metadata if none exists", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.updateMetadata("whatsapp", { syncMode: "incremental", deviceId: "device123" });
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.metadata?.syncMode).toBe("incremental");
      expect(result?.metadata?.deviceId).toBe("device123");
    });

    it("should merge metadata with existing", async () => {
      const existingState: SyncStateRecord = {
        id: "whatsapp",
        channelId: "whatsapp",
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: 100,
        totalCount: 500,
        metadata: { syncMode: "full", deviceId: "device123" },
      };

      const TestLayer = createMockSyncStateRepositoryLayer({ state: existingState });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        yield* repo.updateMetadata("whatsapp", { highestMessageTimestamp: 1704931200 });
        return yield* repo.getState("whatsapp");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result?.metadata?.syncMode).toBe("full"); // Preserved
      expect(result?.metadata?.deviceId).toBe("device123"); // Preserved
      expect(result?.metadata?.highestMessageTimestamp).toBe(1704931200); // Added
    });
  });

  describe("error handling", () => {
    it("should propagate errors when shouldFail is true", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer({
        shouldFail: true,
        failureMessage: "Database connection lost",
      });

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;
        return yield* repo.getState("whatsapp");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));
      expect(error.message).toBe("Database connection lost");
    });
  });

  describe("incremental sync workflow", () => {
    it("should support complete incremental sync workflow", async () => {
      const TestLayer = createMockSyncStateRepositoryLayer();

      const program = Effect.gen(function* () {
        const repo = yield* SyncStateRepositoryTag;

        // 1. Check watermark (should be null initially)
        const initialWatermark = yield* repo.getWatermark("whatsapp");
        expect(initialWatermark).toBeNull();

        // 2. First sync - record success
        const firstSync = new Date("2026-01-10T10:00:00Z");
        yield* repo.recordSuccess("whatsapp", { syncedCount: 100, totalCount: 100, syncedAt: firstSync });

        // 3. Update metadata with highest timestamp (used as watermark for incremental sync)
        yield* repo.updateMetadata("whatsapp", {
          highestMessageTimestamp: 1704931200,
          syncMode: "full",
        });

        // 4. Check watermark after first sync
        const firstWatermark = yield* repo.getWatermark("whatsapp");
        expect(firstWatermark?.lastSyncAt).toEqual(firstSync);
        expect(firstWatermark?.metadata?.highestMessageTimestamp).toBe(1704931200);

        // 5. Second sync - incremental (uses highestMessageTimestamp from metadata)
        const secondSync = new Date("2026-01-10T12:00:00Z");
        yield* repo.recordSuccess("whatsapp", { syncedCount: 20, totalCount: 120, syncedAt: secondSync });

        // 6. Update metadata with new highest timestamp
        yield* repo.updateMetadata("whatsapp", {
          highestMessageTimestamp: 1704938400,
          syncMode: "incremental",
        });

        // 7. Final state check
        const finalState = yield* repo.getState("whatsapp");
        expect(finalState?.lastSyncAt).toEqual(secondSync);
        expect(finalState?.syncedCount).toBe(20);
        expect(finalState?.totalCount).toBe(120);
        expect(finalState?.metadata?.highestMessageTimestamp).toBe(1704938400);
        expect(finalState?.metadata?.syncMode).toBe("incremental");

        return finalState;
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));
      expect(result).not.toBeNull();
    });
  });
});
