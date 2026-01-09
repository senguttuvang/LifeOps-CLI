/**
 * AnalysisService Tests
 *
 * Tests the relationship analysis service with mocked infrastructure dependencies.
 * Verifies analysis flow, indexing, draft generation, and error handling.
 */

import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { AnalysisServiceTag, createMockAnalysisLayer } from "../helpers/mock-layers";
import { expectFailure } from "../helpers/effect-test";

describe("AnalysisService", () => {
  describe("analyze", () => {
    it("should return relationship analysis on success", async () => {
      const TestLayer = createMockAnalysisLayer();

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.analyze("chat-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      expect(result).toContain("Relationship State Report");
      expect(result).toContain("Current Emotional Tone");
      expect(result).toContain("Key Topics");
      expect(result).toContain("Suggestions");
    });

    it("should return custom analysis result when provided", async () => {
      const customAnalysis = "Custom analysis: Everything looks great!";
      const TestLayer = createMockAnalysisLayer({
        analysisResult: customAnalysis,
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.analyze("chat-456");
      });

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      expect(result).toBe(customAnalysis);
    });

    it("should return 'no messages' when chat is empty", async () => {
      const TestLayer = createMockAnalysisLayer({
        noMessages: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.analyze("empty-chat");
      });

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      expect(result).toBe("No messages found for this chat.");
    });

    it("should fail when analysis fails", async () => {
      const TestLayer = createMockAnalysisLayer({
        shouldFail: true,
        failureMessage: "LLM service unavailable",
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.analyze("chat-789");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("LLM service unavailable");
    });
  });

  describe("indexChat", () => {
    it("should complete indexing successfully", async () => {
      const TestLayer = createMockAnalysisLayer();

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.indexChat("chat-123");
      });

      // Should not throw
      await expect(Effect.runPromise(Effect.provide(program, TestLayer))).resolves.toBeUndefined();
    });

    it("should fail when indexing fails", async () => {
      const TestLayer = createMockAnalysisLayer({
        shouldFail: true,
        failureMessage: "Vector store write failed",
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.indexChat("chat-456");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Vector store write failed");
    });
  });

  describe("draftResponse", () => {
    it("should generate draft response on success", async () => {
      const TestLayer = createMockAnalysisLayer();

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.draftResponse("chat-123", "apologize for being late");
      });

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      expect(result).toContain("Hey!");
      expect(result.length).toBeGreaterThan(10);
    });

    it("should return custom draft when provided", async () => {
      const customDraft = "Sorry I'm running late! Be there in 10.";
      const TestLayer = createMockAnalysisLayer({
        draftResult: customDraft,
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.draftResponse("chat-456", "apologize");
      });

      const result = await Effect.runPromise(Effect.provide(program, TestLayer));

      expect(result).toBe(customDraft);
    });

    it("should fail when draft generation fails", async () => {
      const TestLayer = createMockAnalysisLayer({
        shouldFail: true,
        failureMessage: "AI service rate limited",
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.draftResponse("chat-789", "say hello");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("AI service rate limited");
    });
  });

  describe("error scenarios", () => {
    it("should use default error message when not specified", async () => {
      const TestLayer = createMockAnalysisLayer({
        shouldFail: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.analyze("chat-fail");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toContain("Analysis failed");
    });

    it("should propagate specific error messages", async () => {
      const TestLayer = createMockAnalysisLayer({
        shouldFail: true,
        failureMessage: "Database connection lost",
      });

      const program = Effect.gen(function* () {
        const service = yield* AnalysisServiceTag;
        return yield* service.indexChat("chat-db-fail");
      });

      const error = await expectFailure(Effect.provide(program, TestLayer));

      expect(error.message).toBe("Database connection lost");
    });
  });
});
