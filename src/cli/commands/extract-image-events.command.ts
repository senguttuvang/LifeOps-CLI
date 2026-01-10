/**
 * WhatsApp Image Event Extraction Command
 *
 * Extracts events from image captions using LLM.
 * Usage: bun run cli extract-image-events
 */

import { Command } from "@effect/cli"
import { Effect, Console } from "effect"
import { ImageEventExtractionService, ImageEventExtractionServiceLive } from "../../domain/whatsapp/services/image-event-extraction.service"
import { isVisionExtractionEnabled } from "../../config/feature-flags"

/**
 * Format event as markdown with rich details
 */
function formatImageEvent(event: any, index: number): string {
  return `### ${index}. ${event.eventName}

**📅 Date:** ${event.date || "Not specified"}
**🕐 Time:** ${event.time || "Not specified"}
**📍 Location:** ${event.location || "Not specified"}
**👤 Organizer:** ${event.organizer || "Not specified"}
**🏷️ Category:** ${event.category}
**✨ Confidence:** ${(event.confidence * 100).toFixed(0)}%

**Description:**
${event.description || "No description available"}

${event.registrationInfo ? `**📝 Registration:** ${event.registrationInfo}` : ''}
${event.contactInfo ? `**📞 Contact:** ${event.contactInfo}` : ''}

**📷 Image Source:**
- Message ID: \`${event.sourceMessageId}\`
- Image URL: ${event.sourceImageUrl.slice(0, 80)}...
${event.caption ? `- Caption: "${event.caption.slice(0, 150)}${event.caption.length > 150 ? '...' : ''}"` : ''}

---
`
}

/**
 * Get statistics by category
 */
function getCategoryStats(events: ReadonlyArray<{ category: string }>): string {
  const counts = events.reduce((acc: Record<string, number>, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `- **${category}**: ${count}`)
    .join('\n')
}

/**
 * Extract Image Events Command - @effect/cli based
 *
 * Extracts events from image captions using LLM analysis.
 */
export const extractImageEventsCommand = Command.make(
  "extract-image-events",
  {},
  () =>
    Effect.gen(function* () {
      // Feature flag check
      if (!isVisionExtractionEnabled()) {
        yield* Console.log("⚠️  Vision extraction is disabled via ENABLE_VISION_EXTRACTION flag")
        yield* Console.log("   Set ENABLE_VISION_EXTRACTION=true in .env to enable this feature\n")
        return
      }

      yield* Console.log("🖼️  Extracting events from WhatsApp image captions...\n")
      yield* Console.log("ℹ️  Note: Android backup doesn't include media files")
      yield* Console.log("   Extracting from image captions instead (often contain full event details)\n")

      const service = yield* ImageEventExtractionService

      // Find image messages (last 365 days)
      yield* Console.log("📊 Finding image messages with event-related captions...")
      const imageMessages = yield* service.findImageMessages(365)
      yield* Console.log(`   Found ${imageMessages.length} candidate image captions\n`)

      if (imageMessages.length === 0) {
        yield* Console.log("❌ No image messages with event captions found")
        return
      }

      // Extract events from captions
      yield* Console.log("🤖 Extracting events with LLM (Llama 3.3 70B via OpenRouter)...")
      yield* Console.log("   Processing up to 15 captions...\n")

      const events = yield* service.extractEventsFromImages(imageMessages)

      yield* Console.log(`   ✅ Extracted ${events.length} events from images\n`)

      if (events.length === 0) {
        yield* Console.log("❌ No events extracted from images")
        return
      }

      // Sort by confidence and date
      const sortedEvents = events.sort((a, b) => {
        // First by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence
        }
        // Then by date
        if (a.date && b.date) {
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        }
        return 0
      })

      // Take top 10
      const top10 = sortedEvents.slice(0, 10)

      // Generate report
      const report = `# Auroville WhatsApp Image Events Report

**Generated:** ${new Date().toISOString()}
**Source:** WhatsApp image message captions (last 365 days)
**Captions Processed:** ${Math.min(imageMessages.length, 15)}
**Events Extracted:** ${events.length}
**Showing:** Top ${top10.length} events (sorted by confidence)

---

## 🤖 Extraction Method

**Note:** Android WhatsApp backup doesn't include media files (images), only captions.

However, in Auroville groups, image captions often contain complete event details:
- Date, time, location
- Organizer information
- Registration links
- Contact details

**Model:** Llama 3.3 70B Instruct (via OpenRouter)
**Cost:** ~$0.59 per million tokens (extremely cost-effective)
**Method:** Text extraction from rich captions using LLM

---

## 🎉 Extracted Events

${top10.map((event, idx) => formatImageEvent(event, idx + 1)).join('\n')}

## 📊 Statistics

**Total Events Found:** ${events.length}
**Average Confidence:** ${(events.reduce((sum, e) => sum + e.confidence, 0) / events.length * 100).toFixed(0)}%
**Events with Complete Info:** ${events.filter(e => e.date && e.time && e.location).length}
**Events with Registration Info:** ${events.filter(e => e.registrationInfo).length}
**Events with Contact Info:** ${events.filter(e => e.contactInfo).length}

### By Category
${getCategoryStats(events)}

## 🔍 Extraction Quality

**High Confidence (>80%):** ${events.filter(e => e.confidence > 0.8).length}
**Medium Confidence (60-80%):** ${events.filter(e => e.confidence >= 0.6 && e.confidence <= 0.8).length}
**Low Confidence (<60%):** ${events.filter(e => e.confidence < 0.6).length}

## 🚀 Next Steps

1. **Database Storage:** Store extracted events in \`whatsapp_events\` table
2. **Calendar Export:** Export to iCal format for calendar integration
3. **Deduplication:** Merge with text-based event extraction
4. **Validation:** Review low-confidence extractions manually
5. **Automation:** Run daily to capture new event posters

## 💰 Cost Analysis

**Images Processed:** ${Math.min(imageMessages.length, 15)}
**Estimated Cost:** $${(Math.min(imageMessages.length, 15) * 0.0002).toFixed(4)} (at ~$0.0002 per image)
**Model:** Qwen2-VL is 10x cheaper than Claude Vision while maintaining good accuracy
`

      // Save to vault
      const vaultPath = process.env.LIFEOPS_REPORT_PATH ?? "./reports/WhatsApp-Image-Events-Report.md"
      yield* Effect.tryPromise({
        try: () => Bun.write(vaultPath, report),
        catch: (error) => new Error(`Failed to write report: ${error}`),
      })

      yield* Console.log(`✅ Report saved to: ${vaultPath}`)
      yield* Console.log(`\n📈 Summary:`)
      yield* Console.log(`   Images processed: ${Math.min(imageMessages.length, 15)}`)
      yield* Console.log(`   Events extracted: ${events.length}`)
      yield* Console.log(`   Top events in report: ${top10.length}`)
      yield* Console.log(`   Average confidence: ${(events.reduce((sum, e) => sum + e.confidence, 0) / events.length * 100).toFixed(0)}%`)
    }).pipe(Effect.provide(ImageEventExtractionServiceLive)),
)
