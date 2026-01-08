/**
 * Remember Command
 *
 * The Memory Capture System™ - Stores important things to remember.
 *
 * Usage:
 *   bun run cli remember "wants the blue vase from that shop in Indiranagar"
 *   bun run cli remember "don't bring up the parking incident"
 *   bun run cli remember "anniversary is March 15"
 *
 * Auto-categorizes memories based on content analysis.
 * Because remembering things manually is so 2019.
 */

import { Effect } from "effect";
import type { Memory, MemoryCategory } from "../../domain/relationship/types";
import { displayMemoryStored, hint, warn } from "../output/relationship-output";

/**
 * Category detection patterns.
 * Order matters - more specific patterns should come first.
 */
const CATEGORY_PATTERNS: Array<{
  category: MemoryCategory;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    category: "date",
    patterns: [
      /\b(anniversary|birthday|birth\s*day)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
      /\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      /\b(first|1st)\s+(date|kiss|meeting)/i,
      /\bdon't\s+forget\s+.*(date|day)/i,
      /\bmark\s+(the\s+)?calendar/i,
    ],
    weight: 1.0,
  },
  {
    category: "boundary",
    patterns: [
      /\b(don't|do\s*not|never|avoid|stop)\b.*\b(mention|bring\s*up|talk\s*about|discuss|say|do)/i,
      /\b(sensitive|touchy|sore)\s+(topic|subject|point)/i,
      /\b(triggers?|triggered)/i,
      /\b(off[\s-]?limits?|taboo)/i,
      /\b(hate[sd]?|can't\s*stand|despise)/i,
      /\bdon't\s+ever\b/i,
      /\bnot\s+to\s+be\s+discussed/i,
    ],
    weight: 1.2, // Boundaries are important - weight them higher
  },
  {
    category: "gift",
    patterns: [
      /\b(wants?|wanted|likes?|loved?|would\s+love)\s+(the|a|that|some|those)\b/i,
      /\b(mentioned|said|noticed|saw)\s+.*(would\s+be\s+nice|looks?\s+nice|is\s+beautiful)/i,
      /\b(gift\s+idea|present\s+idea|surprise\s+with)/i,
      /\b(been\s+wanting|eye\s+on|has\s+eyes\s+on)/i,
      /\b(wish\s+list|wishlist)/i,
      /\bfrom\s+that\s+shop/i,
      /\b(dreaming\s+of|dreams?\s+about|would\s+kill\s+for)/i,
    ],
    weight: 0.9,
  },
  {
    category: "preference",
    patterns: [
      /\b(likes?|loves?|enjoys?|prefers?|favorite|favourite)/i,
      /\b(hates?|dislikes?|can't\s+stand|doesn't\s+like)/i,
      /\b(allergic|allergy|intolerant)/i,
      /\b(vegetarian|vegan|non[\s-]?veg)/i,
      /\b(morning\s+person|night\s+owl)/i,
      /\b(always\s+wants?|never\s+wants?)/i,
      /\b(comfortable|uncomfortable)\s+with/i,
    ],
    weight: 0.8,
  },
  {
    category: "context",
    patterns: [
      // Catch-all with low weight
      /.+/,
    ],
    weight: 0.1,
  },
];

/**
 * Extract tags from memory content.
 * Basic keyword extraction.
 */
function extractTags(content: string): string[] {
  const tags: string[] = [];

  // Extract quoted text as potential tags
  const quoted = content.match(/"([^"]+)"/g);
  if (quoted) {
    tags.push(...quoted.map((q) => q.replace(/"/g, "").toLowerCase()));
  }

  // Extract proper nouns (capitalized words not at start of sentence)
  const words = content.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const word = words[i] ?? "";
    if (word.match(/^[A-Z][a-z]+$/) && word.length > 2) {
      tags.push(word.toLowerCase());
    }
  }

  // Extract common keywords
  const keywords = [
    "food",
    "restaurant",
    "movie",
    "book",
    "music",
    "travel",
    "family",
    "work",
    "friend",
    "hobby",
    "sport",
    "coffee",
    "tea",
    "morning",
    "evening",
    "weekend",
    "holiday",
  ];

  for (const keyword of keywords) {
    if (content.toLowerCase().includes(keyword)) {
      tags.push(keyword);
    }
  }

  // Deduplicate and limit
  return [...new Set(tags)].slice(0, 5);
}

/**
 * Categorize memory content automatically.
 */
function categorizeMemory(content: string): { category: MemoryCategory; confidence: number } {
  let bestCategory: MemoryCategory = "context";
  let bestScore = 0;

  for (const { category, patterns, weight } of CATEGORY_PATTERNS) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        score += weight;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Normalize confidence to 0-1 range
  const confidence = Math.min(1, bestScore / 1.5);

  return { category: bestCategory, confidence };
}

/**
 * Generate a simple ID for the memory.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `mem_${timestamp}_${random}`;
}

/**
 * The remember command - captures memories for later recall.
 *
 * Currently stores to console output (persistence coming soon™).
 * The categorization is real and useful.
 */
export const rememberCommand = (content: string) =>
  Effect.gen(function* () {
    if (!content || content.trim().length === 0) {
      console.log("\nUsage: bun run cli remember <something to remember>");
      console.log("\nExamples:");
      console.log('  bun run cli remember "wants the blue vase from Indiranagar"');
      console.log('  bun run cli remember "don\'t mention the parking incident"');
      console.log('  bun run cli remember "anniversary is March 15"');
      console.log('  bun run cli remember "allergic to shellfish"');
      console.log("");
      hint("Memories are auto-categorized as: gift, preference, date, boundary, or context.");
      return;
    }

    // Categorize the memory
    const { category, confidence } = categorizeMemory(content);

    // Extract tags
    const tags = extractTags(content);

    // Create the memory object
    const memory: Memory = {
      id: generateId(),
      content: content.trim(),
      category,
      mentionedAt: new Date(),
      source: "manual",
      tags,
    };

    // Display the result
    displayMemoryStored(memory);

    // Show confidence if not high
    if (confidence < 0.5) {
      warn(`Category confidence is ${(confidence * 100).toFixed(0)}%. Review categorization.`);
    }

    // Show extracted tags
    if (tags.length > 0) {
      console.log(`  🏷️  Tags: ${tags.join(", ")}`);
    }

    // Note about persistence
    console.log("");
    hint("Memory captured! (Note: Persistence to database coming in next update)");

    // Suggest related commands based on category
    if (category === "date") {
      hint("Tip: Run 'bun run cli relationship dates' to see all remembered dates.");
    } else if (category === "gift") {
      hint("Tip: Gift ideas will appear in 'bun run cli relationship gifts' (coming soon).");
    } else if (category === "boundary") {
      hint("⚠️  Boundary noted. This will trigger warnings if mentioned in draft responses.");
    }
  });
