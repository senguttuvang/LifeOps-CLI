/**
 * Remember Command Tests
 *
 * Tests for The Memory Capture System™ - memory categorization and tag extraction
 * Validates pattern matching, category assignment, and tag extraction
 */

import { describe, it, expect } from "vitest";
import { categorizeMemory, extractTags } from "../src/cli/commands/remember.command";

describe("The Memory Capture System™", () => {
  describe("Memory Categorization", () => {
    describe("Date Category", () => {
      it("should categorize 'anniversary is March 15' as date", () => {
        const result = categorizeMemory("anniversary is March 15");
        expect(result.category).toBe("date");
      });

      it("should categorize 'birthday is on December 25' as date", () => {
        const result = categorizeMemory("her birthday is on December 25");
        expect(result.category).toBe("date");
      });

      it("should categorize 'our first date was at the cafe' as date", () => {
        const result = categorizeMemory("our first date was at the cafe");
        expect(result.category).toBe("date");
      });

      it("should categorize 'don't forget the date on Friday' as date", () => {
        const result = categorizeMemory("don't forget the date on Friday");
        expect(result.category).toBe("date");
      });

      it("should categorize 'mark the calendar for our trip' as date", () => {
        const result = categorizeMemory("mark the calendar for our trip");
        expect(result.category).toBe("date");
      });
    });

    describe("Boundary Category", () => {
      it("should categorize 'don't mention the parking incident' as boundary", () => {
        const result = categorizeMemory("don't mention the parking incident");
        expect(result.category).toBe("boundary");
      });

      it("should categorize 'never bring up her ex' as boundary", () => {
        const result = categorizeMemory("never bring up her ex");
        expect(result.category).toBe("boundary");
      });

      it("should categorize 'sensitive topic: work stress' as boundary", () => {
        const result = categorizeMemory("sensitive topic: work stress");
        expect(result.category).toBe("boundary");
      });

      it("should categorize 'avoid discussing politics' as boundary", () => {
        // Note: pattern matches "discuss" but not "talking about"
        const result = categorizeMemory("avoid discussing politics");
        expect(result.category).toBe("boundary");
      });

      it("should categorize 'triggers anxiety when discussing finances' as boundary", () => {
        const result = categorizeMemory("triggers anxiety when discussing finances");
        expect(result.category).toBe("boundary");
      });

      it("should categorize 'hates it when I check my phone' as boundary", () => {
        const result = categorizeMemory("hates it when I check my phone");
        expect(result.category).toBe("boundary");
      });

      it("should weight boundaries higher than other categories", () => {
        // Boundaries have weight 1.2 vs 0.8-1.0 for others
        const result = categorizeMemory("don't ever mention that topic");
        expect(result.category).toBe("boundary");
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    describe("Gift Category", () => {
      it("should categorize 'wants the blue vase from that shop' as gift", () => {
        const result = categorizeMemory("wants the blue vase from that shop");
        expect(result.category).toBe("gift");
      });

      it("should categorize 'mentioned she would love a new watch' as gift", () => {
        const result = categorizeMemory("mentioned she would love a new watch");
        expect(result.category).toBe("gift");
      });

      it("should categorize 'gift idea: noise canceling headphones' as gift", () => {
        const result = categorizeMemory("gift idea: noise canceling headphones");
        expect(result.category).toBe("gift");
      });

      it("should categorize 'has been wanting that book' as gift", () => {
        const result = categorizeMemory("has been wanting that book");
        expect(result.category).toBe("gift");
      });

      it("should categorize 'on her wishlist: fancy tea set' as gift", () => {
        const result = categorizeMemory("on her wishlist: fancy tea set");
        expect(result.category).toBe("gift");
      });

      it("should categorize 'dreaming of a trip to Paris' as gift", () => {
        const result = categorizeMemory("dreaming of a trip to Paris");
        expect(result.category).toBe("gift");
      });
    });

    describe("Preference Category", () => {
      it("should categorize 'likes dark chocolate over milk' as preference", () => {
        const result = categorizeMemory("likes dark chocolate over milk");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'prefers window seats on flights' as preference", () => {
        const result = categorizeMemory("prefers window seats on flights");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'allergic to shellfish' as preference", () => {
        const result = categorizeMemory("allergic to shellfish");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'vegetarian, no eggs' as preference", () => {
        const result = categorizeMemory("vegetarian, no eggs");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'morning person, wakes up at 6am' as preference", () => {
        const result = categorizeMemory("morning person, wakes up at 6am");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'dislikes crowded places' as preference", () => {
        const result = categorizeMemory("dislikes crowded places");
        expect(result.category).toBe("preference");
      });

      it("should categorize 'favorite color is purple' as preference", () => {
        const result = categorizeMemory("favorite color is purple");
        expect(result.category).toBe("preference");
      });
    });

    describe("Context Category (Fallback)", () => {
      it("should categorize general notes as context", () => {
        const result = categorizeMemory("met her parents last weekend");
        expect(result.category).toBe("context");
      });

      it("should have low confidence for context fallback", () => {
        const result = categorizeMemory("random note about something");
        expect(result.confidence).toBeLessThan(0.5);
      });
    });

    describe("Confidence Scoring", () => {
      it("should have higher confidence for clear matches", () => {
        const clearMatch = categorizeMemory("anniversary is March 15");
        const vagueMatch = categorizeMemory("something about march maybe");
        expect(clearMatch.confidence).toBeGreaterThan(vagueMatch.confidence);
      });

      it("should normalize confidence to 0-1 range", () => {
        const results = [
          categorizeMemory("anniversary is March 15"),
          categorizeMemory("don't mention the parking incident"),
          categorizeMemory("wants the blue vase"),
          categorizeMemory("likes chocolate"),
          categorizeMemory("random context note"),
        ];

        for (const result of results) {
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe("Tag Extraction", () => {
    describe("Quoted Text Extraction", () => {
      it("should extract text within quotes as tags", () => {
        const tags = extractTags('She mentioned "blue vase" at the store');
        expect(tags).toContain("blue vase");
      });

      it("should handle multiple quoted phrases", () => {
        const tags = extractTags('Likes "dark chocolate" and "red wine"');
        expect(tags).toContain("dark chocolate");
        expect(tags).toContain("red wine");
      });

      it("should lowercase quoted tags", () => {
        const tags = extractTags('Mentioned "The Italian Restaurant"');
        expect(tags).toContain("the italian restaurant");
      });
    });

    describe("Proper Noun Extraction", () => {
      it("should extract capitalized words as potential names", () => {
        const tags = extractTags("Went to dinner with Sarah");
        expect(tags).toContain("sarah");
      });

      it("should not extract first word even if capitalized", () => {
        const tags = extractTags("Paris would be a nice trip");
        // "Paris" is first word, should not be extracted as proper noun
        expect(tags).not.toContain("paris");
      });

      it("should extract multiple proper nouns", () => {
        const tags = extractTags("Meeting John and Mary this weekend");
        expect(tags).toContain("john");
        expect(tags).toContain("mary");
      });
    });

    describe("Keyword Extraction", () => {
      it("should extract 'restaurant' keyword", () => {
        const tags = extractTags("New restaurant opened downtown");
        expect(tags).toContain("restaurant");
      });

      it("should extract 'coffee' keyword", () => {
        const tags = extractTags("Loves her morning coffee");
        expect(tags).toContain("coffee");
        expect(tags).toContain("morning");
      });

      it("should extract 'travel' keyword", () => {
        const tags = extractTags("Planning to travel next month");
        expect(tags).toContain("travel");
      });

      it("should extract 'family' keyword", () => {
        const tags = extractTags("Family dinner on Sunday");
        expect(tags).toContain("family");
      });

      it("should extract 'weekend' keyword", () => {
        const tags = extractTags("Free this weekend for hiking");
        expect(tags).toContain("weekend");
      });
    });

    describe("Tag Limits and Deduplication", () => {
      it("should limit tags to 5 maximum", () => {
        const tags = extractTags(
          'Loves "coffee" and "tea" with "family" at "restaurant" during "travel" on "weekend" for "holiday" with "friends"'
        );
        expect(tags.length).toBeLessThanOrEqual(5);
      });

      it("should deduplicate tags", () => {
        const tags = extractTags("coffee coffee coffee morning morning");
        const coffeeCount = tags.filter((t) => t === "coffee").length;
        expect(coffeeCount).toBeLessThanOrEqual(1);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty content", () => {
        const tags = extractTags("");
        expect(tags).toEqual([]);
      });

      it("should handle content with no extractable tags", () => {
        const tags = extractTags("a b c d e f");
        expect(tags.length).toBe(0);
      });

      it("should handle special characters in quotes", () => {
        const tags = extractTags('Mentioned "café & bistro" downtown');
        expect(tags).toContain("café & bistro");
      });
    });
  });
});
