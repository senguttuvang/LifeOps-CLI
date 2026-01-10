/**
 * Sync Pipeline Integration Tests
 *
 * Tests layer composition and service interactions.
 *
 * NOTE: WhatsApp adapter integration tests are in whatsapp-adapter.test.ts
 * which tests the actual adapter directly without the bun:sqlite issue.
 */

import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import {
  SyncServiceTag,
  WhatsAppServiceTag,
  createMockWhatsAppLayer,
  createMockSyncLayer,
} from "../helpers/mock-layers";
import { expectSuccess, expectFailure } from "../helpers/effect-test";
import { mockSyncResult, mockEmptySyncResult, createSyncResultWithMessages } from "../fixtures";

describe("Sync Pipeline Integration", () => {
  describe("service layer composition", () => {
    it("should resolve WhatsApp service from layer", async () => {
      const TestLayer = createMockWhatsAppLayer({ syncData: mockSyncResult });

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        return yield* whatsapp.syncMessages({ days: 30 });
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.chats.length).toBeGreaterThan(0);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should resolve Sync service from layer", async () => {
      const TestLayer = createMockSyncLayer({
        syncResult: { messagesAdded: 100 },
      });

      const program = Effect.gen(function* () {
        const sync = yield* SyncServiceTag;
        return yield* sync.syncMessages({ days: 30 });
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.messagesAdded).toBe(100);
    });

    it("should compose multiple service layers", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({ syncData: mockSyncResult }),
        createMockSyncLayer({ syncResult: { messagesAdded: 50 } }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        const rawData = yield* whatsapp.syncMessages({ days: 30 });
        const stats = yield* sync.syncMessages({ days: 30 });

        return { rawCount: rawData.messages.length, syncedCount: stats.messagesAdded };
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.rawCount).toBeGreaterThan(0);
      expect(result.syncedCount).toBe(50);
    });
  });

  describe("error propagation", () => {
    it("should propagate WhatsApp service errors", async () => {
      const TestLayer = createMockWhatsAppLayer({
        shouldFail: true,
        failureMessage: "Connection refused",
      });

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        return yield* whatsapp.syncMessages();
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Connection refused");
    });

    it("should propagate Sync service errors", async () => {
      const TestLayer = createMockSyncLayer({
        shouldFail: true,
        failureMessage: "Database unavailable",
      });

      const program = Effect.gen(function* () {
        const sync = yield* SyncServiceTag;
        return yield* sync.syncMessages();
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Database unavailable");
    });

    it("should handle errors in composed pipeline", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({ syncData: mockSyncResult }),
        createMockSyncLayer({ shouldFail: true }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        // WhatsApp succeeds
        const rawData = yield* whatsapp.syncMessages();

        // Sync fails
        return yield* sync.syncFromData(rawData);
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Sync");
    });
  });

  describe("data flow scenarios", () => {
    it("should handle empty sync result", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({ syncData: mockEmptySyncResult }),
        createMockSyncLayer({
          syncResult: {
            contactsAdded: 0,
            conversationsAdded: 0,
            messagesAdded: 0,
            callsAdded: 0,
          },
        }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        const rawData = yield* whatsapp.syncMessages();
        const stats = yield* sync.syncFromData(rawData);

        return { raw: rawData, stats };
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.raw.chats).toHaveLength(0);
      expect(result.raw.messages).toHaveLength(0);
      expect(result.stats.contactsAdded).toBe(0);
    });

    it("should handle large message counts", async () => {
      const largeSyncResult = createSyncResultWithMessages(1000);

      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({ syncData: largeSyncResult }),
        createMockSyncLayer({ syncResult: { messagesAdded: 1000 } }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        const rawData = yield* whatsapp.syncMessages();
        const stats = yield* sync.syncFromData(rawData);

        return { rawCount: rawData.messages.length, syncedCount: stats.messagesAdded };
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.rawCount).toBe(1000);
      expect(result.syncedCount).toBe(1000);
    });
  });

  describe("health check integration", () => {
    it("should combine health check with sync state", async () => {
      const lastSyncAt = new Date("2024-01-01T10:00:00Z");

      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({
          isAvailable: true,
          isAuthenticated: true,
        }),
        createMockSyncLayer({
          syncState: { lastSyncAt, cursor: null },
        }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        const health = yield* whatsapp.healthCheck();
        const syncState = yield* sync.getSyncState();

        return { health, syncState };
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.health.available).toBe(true);
      expect(result.health.authenticated).toBe(true);
      expect(result.syncState?.lastSyncAt).toEqual(lastSyncAt);
    });

    it("should handle unhealthy system state", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({
          isAvailable: false,
          isAuthenticated: false,
        }),
        createMockSyncLayer({
          syncState: null,
        }),
      );

      const program = Effect.gen(function* () {
        const whatsapp = yield* WhatsAppServiceTag;
        const sync = yield* SyncServiceTag;

        const health = yield* whatsapp.healthCheck();
        const syncState = yield* sync.getSyncState();

        return { health, syncState };
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.health.available).toBe(false);
      expect(result.health.authenticated).toBe(false);
      expect(result.syncState).toBeNull();
    });
  });
});
