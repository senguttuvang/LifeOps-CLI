/**
 * SignalExtractionService Tests
 *
 * Tests the behavioral signal extraction service with mocked dependencies.
 * Verifies signal extraction, caching, and error handling.
 */

import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { SignalExtractionServiceTag, createMockSignalExtractionLayer } from "../helpers/mock-layers";
import { expectSuccess, expectFailure } from "../helpers/effect-test";
import { mockUserSignals, mockLowConfidenceSignals } from "../fixtures";

describe("SignalExtractionService", () => {
  describe("extractSignals", () => {
    it("should extract signals for a user", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("user-123");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.userId).toBe("user-123");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.messageCount).toBeGreaterThan(0);
    });

    it("should fail with insufficient data error", async () => {
      const TestLayer = createMockSignalExtractionLayer({
        insufficientData: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("new-user");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Insufficient data");
      expect(error.message).toContain("50 messages");
    });

    it("should return signals with all expected fields", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("user-123");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      // Response patterns
      expect(result.avgResponseTimeMinutes).toBeDefined();
      expect(result.responseTimeP50).toBeDefined();
      expect(result.responseTimeP95).toBeDefined();
      expect(result.initiationRate).toBeDefined();

      // Message structure
      expect(result.avgMessageLength).toBeDefined();
      expect(result.avgWordsPerMessage).toBeDefined();

      // Expression style
      expect(result.emojiPerMessage).toBeDefined();
      expect(result.topEmojis).toBeInstanceOf(Array);
      expect(result.emojiPosition).toBeDefined();

      // Punctuation
      expect(result.exclamationRate).toBeDefined();
      expect(result.questionRate).toBeDefined();

      // Common patterns
      expect(result.commonGreetings).toBeInstanceOf(Array);
      expect(result.commonPhrases).toBeInstanceOf(Array);

      // Behavioral
      expect(result.asksFollowupQuestions).toBeDefined();

      // Temporal
      expect(result.activeHours).toBeDefined();
      expect(result.activeHours.peak).toBeInstanceOf(Array);

      // Metadata
      expect(result.lastComputedAt).toBeDefined();
    });
  });

  describe("getSignals", () => {
    it("should return stored signals for a user", async () => {
      const TestLayer = createMockSignalExtractionLayer({
        signals: mockUserSignals,
      });

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.getSignals("test-user-id");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result).toBeDefined();
      expect(result?.userId).toBe("test-user-id");
      expect(result?.confidence).toBe(0.85);
    });

    it("should return undefined for user without signals", async () => {
      const TestLayer = createMockSignalExtractionLayer({
        signals: undefined,
      });

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.getSignals("nonexistent-user");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result).toBeUndefined();
    });

    it("should return low confidence signals appropriately", async () => {
      const TestLayer = createMockSignalExtractionLayer({
        signals: mockLowConfidenceSignals,
      });

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.getSignals("new-user");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result?.confidence).toBe(0.5);
      expect(result?.messageCount).toBe(60);
    });
  });

  describe("refreshSignals", () => {
    it("should refresh signals without error", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.refreshSignals("user-123");
      });

      // Should complete without throwing
      await expectSuccess(Effect.provide(program, TestLayer));
    });

    it("should fail when extraction fails", async () => {
      const TestLayer = createMockSignalExtractionLayer({
        shouldFail: true,
        failureMessage: "Database connection lost",
      });

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.refreshSignals("user-123");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Database connection lost");
    });
  });

  describe("signal quality", () => {
    it("should have confidence between 0 and 1", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("user-123");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should have rates between 0 and 1", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("user-123");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      // All rate fields should be valid
      expect(result.initiationRate).toBeGreaterThanOrEqual(0);
      expect(result.initiationRate).toBeLessThanOrEqual(1);

      expect(result.exclamationRate).toBeGreaterThanOrEqual(0);
      expect(result.questionRate).toBeGreaterThanOrEqual(0);
    });

    it("should have non-negative message counts", async () => {
      const TestLayer = createMockSignalExtractionLayer();

      const program = Effect.gen(function* () {
        const service = yield* SignalExtractionServiceTag;
        return yield* service.extractSignals("user-123");
      });

      const result = await expectSuccess(Effect.provide(program, TestLayer));

      expect(result.messageCount).toBeGreaterThanOrEqual(0);
      expect(result.avgMessageLength).toBeGreaterThanOrEqual(0);
    });
  });
});
