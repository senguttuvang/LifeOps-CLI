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

import { Command, Args } from "@effect/cli";
import { Effect } from "effect";
import { Box, Text } from "ink";
import type { Memory, MemoryCategory } from "../../domain/relationship/types";
import {
  InkRenderer,
  InkRendererLive,
  MemoryStored,
  Warning,
  Hint,
} from "../ui/index.js";

/**
 * Category detection patterns.
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
    weight: 1.2,
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
    patterns: [/.+/],
    weight: 0.1,
  },
];

/**
 * Extract tags from memory content.
 * @public Exported for testing
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];

  const quoted = content.match(/"([^"]+)"/g);
  if (quoted) {
    tags.push(...quoted.map((q) => q.replace(/"/g, "").toLowerCase()));
  }

  const words = content.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const word = words[i] ?? "";
    if (word.match(/^[A-Z][a-z]+$/) && word.length > 2) {
      tags.push(word.toLowerCase());
    }
  }

  const keywords = [
    "food", "restaurant", "movie", "book", "music", "travel",
    "family", "work", "friend", "hobby", "sport", "coffee",
    "tea", "morning", "evening", "weekend", "holiday",
  ];

  for (const keyword of keywords) {
    if (content.toLowerCase().includes(keyword)) {
      tags.push(keyword);
    }
  }

  return [...new Set(tags)].slice(0, 5);
}

/**
 * Categorize memory content automatically.
 * @public Exported for testing
 */
export function categorizeMemory(content: string): { category: MemoryCategory; confidence: number } {
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
 * Usage display component
 */
function UsageDisplay() {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text>Usage: bun run cli remember {"<something to remember>"}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Examples:</Text>
        <Text>  bun run cli remember "wants the blue vase from Indiranagar"</Text>
        <Text>  bun run cli remember "don't mention the parking incident"</Text>
        <Text>  bun run cli remember "anniversary is March 15"</Text>
        <Text>  bun run cli remember "allergic to shellfish"</Text>
      </Box>
      <Box marginTop={1}>
        <Hint>Memories are auto-categorized as: gift, preference, date, boundary, or context.</Hint>
      </Box>
    </Box>
  );
}

/**
 * Memory result display component
 */
function MemoryResult({
  memory,
  confidence,
  tags,
}: {
  readonly memory: Memory;
  readonly confidence: number;
  readonly tags: string[];
}) {
  return (
    <Box flexDirection="column" gap={1}>
      <MemoryStored memory={memory} />

      {confidence < 0.5 && (
        <Warning>Category confidence is {(confidence * 100).toFixed(0)}%. Review categorization.</Warning>
      )}

      {tags.length > 0 && (
        <Text>  🏷️  Tags: {tags.join(", ")}</Text>
      )}

      <Hint>Memory captured! (Note: Persistence to database coming in next update)</Hint>

      {memory.category === "date" && (
        <Hint>Tip: Run 'bun run cli relationship dates' to see all remembered dates.</Hint>
      )}
      {memory.category === "gift" && (
        <Hint>Tip: Gift ideas will appear in 'bun run cli relationship gifts' (coming soon).</Hint>
      )}
      {memory.category === "boundary" && (
        <Box>
          <Text color="yellow">⚠️  Boundary noted. This will trigger warnings if mentioned in draft responses.</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Remember Command - @effect/cli based with Ink UI
 */
export const rememberCommand = Command.make(
  "remember",
  {
    content: Args.text({ name: "content" }).pipe(Args.repeated),
  },
  ({ content }) =>
    Effect.gen(function* () {
      const renderer = yield* InkRenderer;
      const fullContent = content.join(" ");

      if (!fullContent || fullContent.trim().length === 0) {
        yield* renderer.render(<UsageDisplay />);
        return;
      }

      const { category, confidence } = categorizeMemory(fullContent);
      const tags = extractTags(fullContent);

      const memory: Memory = {
        id: generateId(),
        content: fullContent.trim(),
        category,
        mentionedAt: new Date(),
        source: "manual",
        tags,
      };

      yield* renderer.render(
        <MemoryResult memory={memory} confidence={confidence} tags={tags} />
      );
    }).pipe(Effect.provide(InkRendererLive)),
);
