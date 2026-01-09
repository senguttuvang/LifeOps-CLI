/**
 * WhatsApp Event Extraction Command
 *
 * Extracts events from WhatsApp messages and generates a report.
 * Usage: bun run cli extract-events
 */

import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

import {
  EventExtractionService,
  EventExtractionServiceLive,
} from "../../domain/whatsapp/services/event-extraction.service";

/**
 * Format event as markdown
 */
function formatEvent(event: any, index: number): string {
  return `### ${index}. ${event.eventName}

**Date:** ${event.date || "Not specified"}
**Time:** ${event.time || "Not specified"}
**Location:** ${event.location || "Not specified"}
**Organizer:** ${event.organizer || "Not specified"}
**Category:** ${event.category}
**Confidence:** ${(event.confidence * 100).toFixed(0)}%

**Description:**
${event.description || "No description provided"}

**Source Messages:** ${event.sourceMessages.length} message(s)

---
`;
}

/**
 * Get statistics by category
 */
function getCategoryStats(events: ReadonlyArray<{ category: string }>): string {
  const counts = events.reduce(
    (acc: Record<string, number>, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `- **${category}**: ${count}`)
    .join("\n");
}

/**
 * Extract Events Command - @effect/cli based
 *
 * Extracts events from WhatsApp messages using AI analysis.
 */
export const extractEventsCommand = Command.make("extract-events", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("🔍 Extracting events from WhatsApp messages...\n");

    const service = yield* EventExtractionService;

    // Find candidate messages (last 365 days)
    yield* Console.log("📊 Finding event candidates...");
    const candidates = yield* service.findEventCandidates(365);
    yield* Console.log(`   Found ${candidates.length} candidate messages\n`);

    if (candidates.length === 0) {
      yield* Console.log("❌ No event candidates found");
      return;
    }

    // Extract events
    yield* Console.log("🤖 Extracting events with Claude...");
    const events = yield* service.extractEvents(candidates);
    yield* Console.log(`   Extracted ${events.length} events\n`);

    if (events.length === 0) {
      yield* Console.log("❌ No events extracted");
      return;
    }

    // Deduplicate
    yield* Console.log("🔄 Deduplicating events...");
    const uniqueEvents = yield* service.deduplicateEvents(events);
    yield* Console.log(`   ${uniqueEvents.length} unique events\n`);

    // Generate report (first 10)
    const top10 = uniqueEvents.slice(0, 10);
    const report = `# Auroville WhatsApp Events Report

**Generated:** ${new Date().toISOString()}
**Source:** WhatsApp group messages (last 365 days)
**Total Candidates:** ${candidates.length} messages
**Events Extracted:** ${events.length}
**Unique Events:** ${uniqueEvents.length}
**Showing:** First ${top10.length} events

---

${top10.map((event, idx) => formatEvent(event, idx + 1)).join("\n")}

## Statistics by Category

${getCategoryStats(uniqueEvents)}

## Extraction Methodology

1. **Candidate Filtering**: Messages containing event-related keywords (event, workshop, class, performance, etc.)
2. **AI Extraction**: Claude Sonnet analyzes message content and extracts structured event data
3. **Deduplication**: Events merged based on name, date, and location similarity
4. **Confidence Scoring**: Each event has a confidence score (0-1) indicating extraction reliability

## Future Work

- Image-based event extraction (event posters/flyers)
- Calendar integration (iCal export)
- Automatic event reminders
- Location geocoding for mapping
`;

    // Save to vault (configurable via environment variable)
    const vaultPath = process.env.LIFEOPS_REPORT_PATH ?? "./reports/WhatsApp-Events-Report.md";
    yield* Effect.tryPromise({
      try: () => Bun.write(vaultPath, report),
      catch: (error) => new Error(`Failed to write report: ${error}`),
    });

    yield* Console.log(`✅ Report saved to: ${vaultPath}`);
    yield* Console.log(`\n📈 Summary:`);
    yield* Console.log(`   Total events: ${uniqueEvents.length}`);
    yield* Console.log(`   Report includes: First ${top10.length} events`);
  }).pipe(Effect.provide(EventExtractionServiceLive)),
);
