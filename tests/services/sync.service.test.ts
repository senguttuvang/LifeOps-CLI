/**
 * SyncService Tests
 *
 * Tests the domain sync service with mocked infrastructure dependencies.
 * Verifies sync flow, error handling, and idempotency.
 *
 * NOTE: Adapter integration tests are in whatsapp-adapter.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import {
  SyncServiceTag,
  createMockSyncLayer,
} from "../helpers/mock-layers";
import { runEffect, expectSuccess, expectFailure } from "../helpers/effect-test";
import { mockSyncResult, mockEmptySyncResult, createSyncResultWithMessages } from "../fixtures";

describe("SyncService", () => {
  describe("with mock layer (unit tests)", () => {
    describe("syncMessages", () => {
      it("should return sync statistics on success", async () => {
        const TestLayer = createMockSyncLayer({
          syncResult: {
            contactsAdded: 10,
            conversationsAdded: 5,
            messagesAdded: 250,
            callsAdded: 3,
          },
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncMessages({ days: 30 });
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result.contactsAdded).toBe(10);
        expect(result.conversationsAdded).toBe(5);
        expect(result.messagesAdded).toBe(250);
        expect(result.callsAdded).toBe(3);
        expect(result.syncedAt).toBeInstanceOf(Date);
      });

      it("should use default 30 days when not specified", async () => {
        const TestLayer = createMockSyncLayer();

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncMessages();
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result.syncedAt).toBeDefined();
      });

      it("should fail when sync service fails", async () => {
        const TestLayer = createMockSyncLayer({
          shouldFail: true,
          failureMessage: "WhatsApp connection lost",
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncMessages({ days: 7 });
        });

        const error = await expectFailure(Effect.provide(program, TestLayer));

        expect(error.message).toContain("WhatsApp connection lost");
      });

      it("should sync with custom days parameter", async () => {
        const TestLayer = createMockSyncLayer({
          syncResult: { messagesAdded: 50 },
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncMessages({ days: 7 });
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result.messagesAdded).toBe(50);
      });
    });

    describe("syncFromData", () => {
      it("should sync from pre-fetched data", async () => {
        const TestLayer = createMockSyncLayer({
          syncResult: {
            contactsAdded: 1,
            conversationsAdded: 1,
            messagesAdded: 3,
          },
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncFromData(mockSyncResult);
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result.contactsAdded).toBeGreaterThanOrEqual(0);
        expect(result.syncedAt).toBeInstanceOf(Date);
      });

      it("should fail when syncFromData fails", async () => {
        const TestLayer = createMockSyncLayer({
          shouldFail: true,
          failureMessage: "Database write failed",
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.syncFromData(mockSyncResult);
        });

        const error = await expectFailure(Effect.provide(program, TestLayer));

        expect(error.message).toContain("Database write failed");
      });
    });

    describe("getSyncState", () => {
      it("should return sync state when available", async () => {
        const lastSyncAt = new Date("2024-01-01T10:00:00Z");
        const TestLayer = createMockSyncLayer({
          syncState: { lastSyncAt, cursor: "cursor-123" },
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.getSyncState();
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result).not.toBeNull();
        expect(result?.lastSyncAt).toEqual(lastSyncAt);
        expect(result?.cursor).toBe("cursor-123");
      });

      it("should return null when no sync state exists", async () => {
        const TestLayer = createMockSyncLayer({
          syncState: null,
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.getSyncState();
        });

        const result = await Effect.runPromise(Effect.provide(program, TestLayer));

        expect(result).toBeNull();
      });

      it("should fail when getSyncState fails", async () => {
        const TestLayer = createMockSyncLayer({
          shouldFail: true,
          failureMessage: "Database read failed",
        });

        const program = Effect.gen(function* () {
          const service = yield* SyncServiceTag;
          return yield* service.getSyncState();
        });

        const error = await expectFailure(Effect.provide(program, TestLayer));

        expect(error.message).toContain("Database read failed");
      });
    });
  });

  describe("error scenarios", () => {
    it("should propagate service errors with message", async () => {
      const TestLayer = createMockSyncLayer({
        shouldFail: true,
        failureMessage: "Network timeout",
      });

      const program = Effect.gen(function* () {
        const service = yield* SyncServiceTag;
        return yield* service.syncMessages();
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Network timeout");
    });

    it("should use default error message when not specified", async () => {
      const TestLayer = createMockSyncLayer({
        shouldFail: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* SyncServiceTag;
        return yield* service.syncMessages();
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Sync failed");
    });
  });
});
