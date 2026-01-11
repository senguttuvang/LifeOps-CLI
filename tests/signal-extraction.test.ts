/**
 * Signal Extraction Tests
 *
 * Tests for RAG+Signals behavioral pattern extraction system.
 * Validates extractors, prompt building, enforcement, and quality scoring.
 */

import { describe, it, expect } from "vitest";
import {
  extractResponseTimes,
  extractEmojiPatterns,
  extractMessageStructure,
  extractPhrasePatterns,
  extractPunctuationPatterns,
  extractBehavioralPatterns,
  extractTemporalPatterns,
} from "../src/domain/signals/extractors";
import {
  buildSignalEnhancedPrompt,
  buildBasicPrompt,
} from "../src/domain/signals/prompt-builder";
import {
  enforceSignals,
  validateDraftAgainstSignals,
} from "../src/domain/signals/signal-enforcer";
import {
  scoreDraftQuality,
  compareDrafts,
} from "../src/domain/signals/quality-scorer";
import type { MessageForSignals, UserSignals } from "../src/domain/signals/types";

// Test data
const mockMessages: MessageForSignals[] = [
  {
    id: "1",
    text: "Hey jaan! How are you? ❤️",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:00:00Z"),
  },
  {
    id: "2",
    text: "I'm good! Just tired from work",
    fromMe: false,
    timestamp: new Date("2024-01-01T10:05:00Z"),
  },
  {
    id: "3",
    text: "Oh no, that sounds tough. Want to talk? ❤️",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:07:00Z"),
  },
  {
    id: "4",
    text: "Yeah, let's call later",
    fromMe: false,
    timestamp: new Date("2024-01-01T10:10:00Z"),
  },
  {
    id: "5",
    text: "Sounds good! Love you ❤️",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:12:00Z"),
  },
];

const mockSignals: UserSignals = {
  userId: "test-user",
  avgResponseTimeMinutes: 3.5,
  responseTimeP50: 2.0,
  responseTimeP95: 7.0,
  initiationRate: 0.5,
  avgMessageLength: 35,
  messageLengthStd: 10,
  medianMessageLength: 32,
  avgWordsPerMessage: 6,
  emojiPerMessage: 1,
  emojiVariance: 0.2,
  topEmojis: [
    { emoji: "❤️", frequency: 0.8 },
    { emoji: "😊", frequency: 0.1 },
  ],
  emojiPosition: { start: 0.1, middle: 0.2, end: 0.7 },
  exclamationRate: 0.6,
  questionRate: 0.4,
  periodRate: 0.2,
  ellipsisRate: 0.1,
  commonGreetings: ["hey jaan", "hey love"],
  commonEndings: ["love you", "❤️"],
  commonPhrases: [
    { phrase: "want to talk", frequency: 0.4 },
    { phrase: "sounds good", frequency: 0.3 },
  ],
  fillerWords: ["just", "like"],
  asksFollowupQuestions: 0.7,
  usesVoiceNotes: 0.0,
  sendsMultipleMessages: 0.2,
  editsMessages: 0.0,
  activeHours: { peak: [18, 20, 22], low: [2, 4, 6] },
  weekendVsWeekdayDiff: 1.2,
  messageCount: 100,
  confidence: 0.85,
  lastComputedAt: new Date(),
};

describe("Signal Extractors", () => {
  describe("extractResponseTimes", () => {
    it("should calculate response time statistics", () => {
      const result = extractResponseTimes(mockMessages);

      expect(result.sampleSize).toBeGreaterThan(0);
      expect(result.avgResponseTimeMinutes).toBeGreaterThan(0);
      expect(result.responseTimeP50).toBeGreaterThan(0);
      expect(result.responseTimeP95).toBeGreaterThan(0);
    });

    it("should handle messages with no responses", () => {
      const noResponses: MessageForSignals[] = [
        {
          id: "1",
          text: "Hello",
          fromMe: false,
          timestamp: new Date(),
        },
      ];

      const result = extractResponseTimes(noResponses);
      expect(result.sampleSize).toBe(0);
    });
  });

  describe("extractEmojiPatterns", () => {
    it("should extract emoji usage patterns", () => {
      const result = extractEmojiPatterns(mockMessages);

      expect(result.emojiPerMessage).toBeGreaterThan(0);
      expect(result.topEmojis).toBeDefined();
      expect(result.topEmojis.length).toBeGreaterThan(0);
      // Emoji might be parsed as ❤ or ❤️ depending on encoding
      expect(result.topEmojis[0].emoji).toMatch(/❤/);
    });

    it("should handle messages without emojis", () => {
      const noEmojis: MessageForSignals[] = [
        {
          id: "1",
          text: "Hello there",
          fromMe: true,
          timestamp: new Date(),
        },
      ];

      const result = extractEmojiPatterns(noEmojis);
      expect(result.emojiPerMessage).toBe(0);
      expect(result.topEmojis).toEqual([]);
    });
  });

  describe("extractMessageStructure", () => {
    it("should analyze message structure", () => {
      const result = extractMessageStructure(mockMessages);

      expect(result.avgMessageLength).toBeGreaterThan(0);
      expect(result.messageLengthStd).toBeGreaterThanOrEqual(0);
      expect(result.medianMessageLength).toBeGreaterThan(0);
      expect(result.avgWordsPerMessage).toBeGreaterThan(0);
    });
  });

  describe("extractPhrasePatterns", () => {
    it("should extract common phrases", () => {
      const result = extractPhrasePatterns(mockMessages);

      expect(result.commonGreetings).toBeDefined();
      expect(result.commonEndings).toBeDefined();
      expect(result.commonPhrases).toBeDefined();
      expect(result.fillerWords).toBeDefined();
    });
  });

  describe("extractPunctuationPatterns", () => {
    it("should analyze punctuation usage", () => {
      const result = extractPunctuationPatterns(mockMessages);

      expect(result.exclamationRate).toBeGreaterThanOrEqual(0);
      expect(result.exclamationRate).toBeLessThanOrEqual(1);
      expect(result.questionRate).toBeGreaterThanOrEqual(0);
      expect(result.questionRate).toBeLessThanOrEqual(1);
    });
  });

  describe("extractBehavioralPatterns", () => {
    it("should analyze behavioral patterns", () => {
      const result = extractBehavioralPatterns(mockMessages);

      expect(result.asksFollowupQuestions).toBeGreaterThanOrEqual(0);
      expect(result.asksFollowupQuestions).toBeLessThanOrEqual(1);
      expect(result.usesVoiceNotes).toBeGreaterThanOrEqual(0);
      expect(result.initiationRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("extractTemporalPatterns", () => {
    it("should analyze temporal patterns", () => {
      const result = extractTemporalPatterns(mockMessages);

      expect(result.activeHours.peak).toBeDefined();
      expect(result.activeHours.peak.length).toBeGreaterThan(0);
      expect(result.weekendVsWeekdayDiff).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Prompt Builder", () => {
  it("should build signal-enhanced prompt", () => {
    const prompt = buildSignalEnhancedPrompt(
      "I had a terrible day",
      ["That sounds tough", "Want to talk?"],
      mockSignals
    );

    expect(prompt).toContain("I had a terrible day");
    expect(prompt).toContain("EXACT communication style");
    expect(prompt).toContain("35 characters");
    expect(prompt).toContain("❤️");
  });

  it("should build basic prompt without signals", () => {
    const prompt = buildBasicPrompt("I had a terrible day", ["That sounds tough"]);

    expect(prompt).toContain("I had a terrible day");
    expect(prompt).toContain("That sounds tough");
  });
});

describe("Signal Enforcer", () => {
  it("should enforce emoji count", () => {
    const draft = "Oh no, that sounds tough"; // 0 emojis
    const enforced = enforceSignals(draft, mockSignals);

    // Should have emojis added (at least 1, allowing for encoding variations)
    expect(enforced).toMatch(/❤/);
    const emojiCount = (enforced.match(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu) || []).length;
    expect(emojiCount).toBeGreaterThanOrEqual(1);
  });

  it("should add follow-up question when required", () => {
    const signalsWithQuestions = { ...mockSignals, asksFollowupQuestions: 0.8 };
    const draft = "That sounds tough"; // No question

    const enforced = enforceSignals(draft, signalsWithQuestions);
    expect(enforced).toContain("?");
  });

  it("should validate draft against signals", () => {
    const goodDraft = "That sounds tough! Want to talk? ❤️"; // Matches signals well
    const result = validateDraftAgainstSignals(goodDraft, mockSignals);

    expect(result.issues.length).toBeLessThan(3); // Should have minimal issues
  });
});

describe("Quality Scorer", () => {
  it("should score draft quality", () => {
    const draft = "That sounds tough! Want to talk? ❤️";
    const score = scoreDraftQuality(draft, mockSignals);

    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.overallScore).toBeLessThanOrEqual(100);
    expect(score.styleMatch).toBeDefined();
    expect(score.tier).toMatch(/excellent|good|fair|poor/);
  });

  it("should assign higher scores to better-matching drafts", () => {
    const goodDraft = "That sounds tough! Want to talk? ❤️"; // Matches signals
    const badDraft = "I'm sorry to hear that. Would you like to discuss this matter further with me at your earliest convenience?"; // Too formal, too long

    const goodScore = scoreDraftQuality(goodDraft, mockSignals);
    const badScore = scoreDraftQuality(badDraft, mockSignals);

    expect(goodScore.overallScore).toBeGreaterThan(badScore.overallScore);
  });

  it("should compare drafts and identify winner", () => {
    const basicDraft = "That's tough. How can I help?";
    const signalDraft = "That sounds tough! Want to talk? ❤️";

    const comparison = compareDrafts(basicDraft, signalDraft, mockSignals);

    expect(comparison.winner).toBe("B"); // Signal-enhanced should win
    expect(comparison.improvement).toBeGreaterThan(0);
  });
});

describe("Integration Test", () => {
  it("should complete full signal extraction -> enforcement -> scoring flow", () => {
    // 1. Extract signals from messages
    const emojiSignals = extractEmojiPatterns(mockMessages);
    const structureSignals = extractMessageStructure(mockMessages);

    expect(emojiSignals.emojiPerMessage).toBeGreaterThan(0);
    expect(structureSignals.avgMessageLength).toBeGreaterThan(0);

    // 2. Build prompt
    const prompt = buildSignalEnhancedPrompt(
      "I'm stressed",
      ["That sounds tough", "Want to talk?"],
      mockSignals
    );

    expect(prompt).toBeDefined();

    // 3. Simulate LLM generation (basic draft)
    const simulatedDraft = "That sounds tough! Want to talk?";

    // 4. Enforce signals
    const enforced = enforceSignals(simulatedDraft, mockSignals);

    // 5. Score quality
    const score = scoreDraftQuality(enforced, mockSignals);

    expect(score.overallScore).toBeGreaterThan(50); // Should be reasonably good
  });
});
