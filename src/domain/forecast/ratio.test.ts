/**
 * Ratio Analyzer Tests
 *
 * Tests for Gottman's 5:1 Magic Ratio tracking.
 */

import { describe, expect, it } from "bun:test";
import { analyzeMessage, calculateRatio } from "./ratio.analyzer";

describe("Ratio Analyzer", () => {
  describe("analyzeMessage", () => {
    it("should classify positive messages", () => {
      const message = {
        id: "msg-1",
        text: "I love you so much! Thank you for being amazing 😍",
        timestamp: new Date(),
        fromMe: true,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("positive");
      expect(result.score).toBeGreaterThan(0);
    });

    it("should classify negative messages", () => {
      const message = {
        id: "msg-2",
        text: "I'm so frustrated with you. This is annoying.",
        timestamp: new Date(),
        fromMe: true,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("negative");
      expect(result.score).toBeLessThan(0);
    });

    it("should classify neutral messages", () => {
      const message = {
        id: "msg-3",
        text: "I'll be home at 6pm",
        timestamp: new Date(),
        fromMe: true,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("neutral");
    });

    it("should detect positive emojis", () => {
      const message = {
        id: "msg-4",
        text: "❤️💕😊",
        timestamp: new Date(),
        fromMe: true,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("positive");
    });

    it("should detect negative emojis", () => {
      const message = {
        id: "msg-5",
        text: "😢😭😤",
        timestamp: new Date(),
        fromMe: false,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("negative");
    });

    it("should handle empty messages", () => {
      const message = {
        id: "msg-6",
        text: "",
        timestamp: new Date(),
        fromMe: true,
      };

      const result = analyzeMessage(message);

      expect(result.valence).toBe("neutral");
      expect(result.confidence).toBe(0.5);
    });

    it("should track sender correctly", () => {
      const userMessage = {
        id: "msg-7",
        text: "Love you",
        timestamp: new Date(),
        fromMe: true,
      };

      const partnerMessage = {
        id: "msg-8",
        text: "Love you too",
        timestamp: new Date(),
        fromMe: false,
      };

      expect(analyzeMessage(userMessage).sender).toBe("user");
      expect(analyzeMessage(partnerMessage).sender).toBe("partner");
    });
  });

  describe("calculateRatio", () => {
    it("should calculate healthy ratio (5:1)", () => {
      const valences = [
        { messageId: "1", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "2", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "3", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "partner" as const },
        { messageId: "4", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "partner" as const },
        { messageId: "5", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "6", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "user" as const },
      ];

      const result = calculateRatio(valences);

      expect(result.ratio).toBe(5); // 5 positive : 1 negative
      expect(result.status).toBe("healthy");
      expect(result.score).toBe(100); // Perfect 5:1
    });

    it("should identify borderline ratio (3:1)", () => {
      const valences = [
        { messageId: "1", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "2", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "3", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "partner" as const },
        { messageId: "4", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "user" as const },
      ];

      const result = calculateRatio(valences);

      expect(result.ratio).toBe(3);
      expect(result.status).toBe("borderline");
    });

    it("should identify danger zone ratio (<2:1)", () => {
      const valences = [
        { messageId: "1", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "2", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "user" as const },
      ];

      const result = calculateRatio(valences);

      expect(result.ratio).toBe(1);
      expect(result.status).toBe("danger");
    });

    it("should handle all neutral messages", () => {
      const valences = [
        { messageId: "1", valence: "neutral" as const, score: 0, confidence: 0.5, sender: "user" as const },
        { messageId: "2", valence: "neutral" as const, score: 0, confidence: 0.5, sender: "partner" as const },
      ];

      const result = calculateRatio(valences);

      // Default to 5:1 if all neutral
      expect(result.ratio).toBe(5);
      expect(result.status).toBe("healthy");
    });

    it("should track per-sender positive rates", () => {
      const valences = [
        { messageId: "1", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "2", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "3", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "partner" as const },
        { messageId: "4", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "partner" as const },
      ];

      const result = calculateRatio(valences);

      expect(result.userPositiveRate).toBe(1); // 100% positive from user
      expect(result.partnerPositiveRate).toBe(0); // 0% positive from partner
    });

    it("should calculate trend when previous score provided", () => {
      const valences = [
        { messageId: "1", valence: "positive" as const, score: 0.5, confidence: 0.8, sender: "user" as const },
        { messageId: "2", valence: "negative" as const, score: -0.5, confidence: 0.8, sender: "user" as const },
      ];

      const previousScore = {
        positiveCount: 5,
        negativeCount: 1,
        neutralCount: 0,
        ratio: 5,
        status: "healthy" as const,
        score: 100,
        trend: "stable" as const,
        weekOverWeekDelta: 0,
        userPositiveRate: 0.8,
        partnerPositiveRate: 0.8,
      };

      const result = calculateRatio(valences, previousScore);

      expect(result.trend).toBe("worsening"); // Dropped from 100 to 20
    });
  });
});
