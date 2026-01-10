/**
 * Decode Command Tests
 *
 * Tests for The Fine Decoder(tm) - relationship message analyzer
 * Validates pattern matching, punctuation analysis, and modifier detection
 */

import { describe, it, expect } from "vitest";
import { analyzeMessage } from "../src/cli/commands/decode.command";

describe("The Fine Decoder(tm)", () => {
  describe("Basic Pattern Recognition", () => {
    it('should decode "I\'m fine" as NOT_FINE_INVESTIGATE', () => {
      const result = analyzeMessage("I'm fine");
      expect(result.decoded).toBe("NOT_FINE_INVESTIGATE");
      expect(result.literal).toBe("fine");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should decode "It\'s fine" as FINAL_WARNING (escalated)', () => {
      const result = analyzeMessage("It's fine");
      expect(result.decoded).toBe("FINAL_WARNING");
      expect(result.literal).toBe("fine");
    });

    it('should decode "k" as FINAL_WARNING with high confidence', () => {
      const result = analyzeMessage("k");
      expect(result.decoded).toBe("FINAL_WARNING");
      expect(result.literal).toBe("k");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should decode "whatever" as FINAL_WARNING', () => {
      const result = analyzeMessage("whatever");
      expect(result.decoded).toBe("FINAL_WARNING");
      expect(result.literal).toBe("whatever");
    });

    it('should decode "do whatever you want" as TEST_IN_PROGRESS', () => {
      const result = analyzeMessage("do whatever you want");
      expect(result.decoded).toBe("TEST_IN_PROGRESS");
      expect(result.literal).toBe("whatever");
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should decode "nothing\'s wrong" as SHOULD_ALREADY_KNOW', () => {
      const result = analyzeMessage("nothing's wrong");
      expect(result.decoded).toBe("SHOULD_ALREADY_KNOW");
      expect(result.literal).toBe("nothing");
    });

    it('should decode "ok" as NOT_FINE_INVESTIGATE', () => {
      const result = analyzeMessage("ok");
      expect(result.decoded).toBe("NOT_FINE_INVESTIGATE");
      expect(result.literal).toBe("okay");
    });

    it('should decode "sure" as NOT_FINE_INVESTIGATE', () => {
      const result = analyzeMessage("sure");
      expect(result.decoded).toBe("NOT_FINE_INVESTIGATE");
      expect(result.literal).toBe("sure");
    });

    it('should decode "we need to talk" as FINAL_WARNING', () => {
      const result = analyzeMessage("we need to talk");
      expect(result.decoded).toBe("FINAL_WARNING");
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("Punctuation Analysis (The Silent Killers)", () => {
    it('should escalate "fine." (with period) to FINAL_WARNING', () => {
      const result = analyzeMessage("fine.");
      expect(result.decoded).toBe("FINAL_WARNING");
      // Period adds +0.15 confidence
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should increase confidence for ellipsis ("fine...")', () => {
      const withEllipsis = analyzeMessage("fine...");
      const withoutEllipsis = analyzeMessage("fine");
      expect(withEllipsis.confidence).toBeGreaterThan(withoutEllipsis.confidence);
    });

    it('should slightly decrease confidence for exclamation ("fine!")', () => {
      const withExclamation = analyzeMessage("fine!");
      const withoutExclamation = analyzeMessage("fine");
      expect(withExclamation.confidence).toBeLessThan(withoutExclamation.confidence);
    });
  });

  describe("Modifier Analysis (Words That Change Everything)", () => {
    it('should increase confidence when "just" is present', () => {
      const withJust = analyzeMessage("I'm just fine");
      const withoutJust = analyzeMessage("I'm fine");
      expect(withJust.confidence).toBeGreaterThan(withoutJust.confidence);
    });

    it('should decrease confidence when "really" is present', () => {
      const withReally = analyzeMessage("I'm really fine");
      const withoutReally = analyzeMessage("I'm fine");
      expect(withReally.confidence).toBeLessThan(withoutReally.confidence);
    });

    it('should decrease confidence when "actually" is present', () => {
      const withActually = analyzeMessage("I'm actually fine");
      const withoutActually = analyzeMessage("I'm fine");
      expect(withActually.confidence).toBeLessThan(withoutActually.confidence);
    });

    it('should apply "totally" modifier (small +0.05 increase)', () => {
      const withTotally = analyzeMessage("I'm totally fine");
      // "totally" adds +0.05 to base confidence
      expect(withTotally.decoded).toBe("NOT_FINE_INVESTIGATE");
      // Confidence should be at least the base level
      expect(withTotally.confidence).toBeGreaterThanOrEqual(0.78);
    });
  });

  describe("Response Windows", () => {
    it("should have short response window for TEST_IN_PROGRESS (30 sec)", () => {
      const result = analyzeMessage("do whatever you want");
      expect(result.responseWindowMs).toBe(30 * 1000);
    });

    it("should have short response window for SHOULD_ALREADY_KNOW (1 min)", () => {
      const result = analyzeMessage("you should know");
      expect(result.responseWindowMs).toBe(60 * 1000);
    });

    it("should have medium response window for FINAL_WARNING (2 min)", () => {
      const result = analyzeMessage("k");
      expect(result.responseWindowMs).toBe(2 * 60 * 1000);
    });

    it("should have longer response window for NOT_FINE_INVESTIGATE (5 min)", () => {
      const result = analyzeMessage("I'm fine");
      expect(result.responseWindowMs).toBe(5 * 60 * 1000);
    });
  });

  describe("Suggested Actions", () => {
    it("should provide appropriate actions for NOT_FINE_INVESTIGATE", () => {
      const result = analyzeMessage("I'm fine");
      expect(result.suggestedActions).toContain('Ask "What\'s wrong?" with eye contact');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it("should provide appropriate actions for TEST_IN_PROGRESS", () => {
      const result = analyzeMessage("do whatever you want");
      expect(result.suggestedActions).toContain("Express a genuine preference");
      expect(result.suggestedActions).toContain("Do NOT take the bait");
    });

    it("should provide appropriate actions for SHOULD_ALREADY_KNOW", () => {
      const result = analyzeMessage("nothing's wrong");
      expect(result.suggestedActions).toContain("Review calendar for forgotten events");
      expect(result.suggestedActions).toContain("Apologize first, understand later");
    });
  });

  describe("Do Not Do Actions", () => {
    it("should always include universal bad actions", () => {
      const result = analyzeMessage("I'm fine");
      expect(result.doNotDo).toContain("Say 'calm down'");
      expect(result.doNotDo).toContain("Use logic to explain why they shouldn't feel that way");
    });

    it("should include context-specific prohibitions for NOT_FINE_INVESTIGATE", () => {
      const result = analyzeMessage("I'm fine");
      expect(result.doNotDo).toContain("Accept 'fine' at face value");
    });

    it("should include context-specific prohibitions for FINAL_WARNING", () => {
      const result = analyzeMessage("k");
      expect(result.doNotDo).toContain("Make jokes");
      expect(result.doNotDo).toContain("Look at your phone");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string gracefully", () => {
      const result = analyzeMessage("");
      expect(result.decoded).toBeDefined();
    });

    it("should handle very long messages", () => {
      const longMessage = "I'm fine " + "blah ".repeat(100);
      const result = analyzeMessage(longMessage);
      expect(result.decoded).toBe("NOT_FINE_INVESTIGATE");
    });

    it("should be case-insensitive", () => {
      const lower = analyzeMessage("i'm fine");
      const upper = analyzeMessage("I'M FINE");
      const mixed = analyzeMessage("I'm FiNe");
      expect(lower.decoded).toBe(upper.decoded);
      expect(lower.decoded).toBe(mixed.decoded);
    });

    it("should trim whitespace", () => {
      const withSpaces = analyzeMessage("   fine   ");
      const withoutSpaces = analyzeMessage("fine");
      expect(withSpaces.decoded).toBe(withoutSpaces.decoded);
    });

    it("should prefer longer pattern matches", () => {
      // "do whatever you want" should match the longer pattern, not just "whatever"
      const result = analyzeMessage("do whatever you want");
      expect(result.decoded).toBe("TEST_IN_PROGRESS"); // Not just FINAL_WARNING
    });

    it("should handle unknown messages as short = concerning", () => {
      const shortUnknown = analyzeMessage("yo");
      expect(shortUnknown.decoded).toBe("NOT_FINE_INVESTIGATE");
      expect(shortUnknown.confidence).toBe(0.4);
    });

    it("should handle unknown long messages as probably fine", () => {
      // Note: Message must not contain any pattern substrings (including 'k')
      const longUnknown = analyzeMessage("Hey, I was wondering if we could grab dinner at the new Italian restaurant downtown");
      expect(longUnknown.decoded).toBe("ACTUALLY_FINE");
      expect(longUnknown.confidence).toBe(0.3);
    });
  });

  describe("Confidence Bounds", () => {
    it("should never exceed 0.97 confidence (humility)", () => {
      // Even extreme cases should stay below 0.97
      const extreme = analyzeMessage("k.");
      expect(extreme.confidence).toBeLessThanOrEqual(0.97);
    });

    it("should never go below 0.1 confidence", () => {
      // Even with many confidence reducers
      const reduced = analyzeMessage("I'm really actually fine!");
      expect(reduced.confidence).toBeGreaterThanOrEqual(0.1);
    });
  });
});
