/**
 * WhatsApp Vision Event Extraction - Standalone Script
 *
 * Extracts events from actual image files using Claude Vision API
 */

import { Effect, Console } from "effect"
import { VisionEventExtractionService, VisionEventExtractionServiceLive } from "../../domain/whatsapp/services/vision-event-extraction.service"

/**
 * Format event as markdown with rich details
 */
function formatVisionEvent(event: any, index: number): string {
  return `### ${index}. ${event.eventName}

**📅 Date:** ${event.date || "Not specified"}
**🕐 Time:** ${event.time || "Not specified"}
**📍 Location:** ${event.location || "Not specified"}
**👤 Organizer:** ${event.organizer || "Not specified"}
**🏷️ Category:** ${event.category}
**✨ Confidence:** ${(event.confidence * 100).toFixed(0)}%

**Description:**
${event.description || "No description available"}

${event.registrationInfo ? `**📝 Registration:** ${event.registrationInfo}\n` : ''}${event.contactInfo ? `**📞 Contact:** ${event.contactInfo}\n` : ''}
**📷 Image Source:**
- Message Row ID: \`${event.sourceMessageId}\`
- Image Path: ${event.sourceImagePath.split('/').slice(-3).join('/')}
${event.caption ? `- Caption: "${event.caption.slice(0, 150)}${event.caption.length > 150 ? '...' : ''}"` : ''}

---
`
}

/**
 * Main extraction program
 */
const program = Effect.gen(function* () {
  yield* Console.log("🔍 Extracting events from actual WhatsApp images using Claude Vision...\n")

  const service = yield* VisionEventExtractionService

  // Find images with valid file paths (limit to 20 for cost control)
  yield* Console.log("📊 Finding images with valid file paths...")
  const images = yield* service.findImagesWithPaths(50)
  yield* Console.log(`   Found ${images.length} images with file paths\n`)

  if (images.length === 0) {
    yield* Console.log("❌ No images found")
    return
  }

  // Extract events using vision model
  yield* Console.log("🤖 Analyzing images with Qwen 2 VL 72B (via OpenRouter)...")
  yield* Console.log("   Processing 10 images for sampling (2 second delay between images)...")
  yield* Console.log("   ⚠️  This will take ~20 seconds and cost ~$0.02\n")

  const events = yield* service.extractEventsFromImages(images)

  yield* Console.log(`\n   ✅ Extracted ${events.length} events from images\n`)

  if (events.length === 0) {
    yield* Console.log("❌ No event posters found (filtered out ads, college posters, etc.)")
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
  const report = `# Auroville WhatsApp Vision-Based Events Report

**Generated:** ${new Date().toISOString()}
**Source:** WhatsApp image files (actual posters)
**Images Analyzed:** ${images.slice(0, 10).length} (sampling)
**Event Posters Found:** ${events.length}
**Showing:** Top ${top10.length} events (sorted by confidence)

---

## 🤖 Extraction Method

**Vision Model:** Qwen 2 VL 72B Instruct (via OpenRouter)
**Input:** Actual image files from WhatsApp backup
**Cost:** ~$0.002 per image (~$0.02 for 10 images)
**Filtering:** Automatically excludes ads, college posters, personal photos

The vision model analyzes:
- Text content in images (OCR)
- Visual layout and design patterns
- Context clues (colors, symbols, formatting)
- Event-specific elements (dates, times, locations)

**Advantages over caption-based extraction:**
- Can read text from poster images directly
- Detects visual design patterns (event vs ad)
- Extracts information not included in captions
- More accurate date/time parsing from visual format

---

## 🎉 Extracted Events

${top10.map((event, idx) => formatVisionEvent(event, idx + 1)).join('\n')}

## 📊 Statistics

**Total Event Posters:** ${events.length}
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

## 💰 Cost Analysis

**Images Processed:** ${images.slice(0, 10).length}
**Cost per Image:** ~$0.002 (Qwen 2 VL 72B via OpenRouter)
**Total Estimated Cost:** $${(images.slice(0, 10).length * 0.002).toFixed(3)}
**Event Posters Found:** ${events.length}
**Cost per Event:** $${events.length > 0 ? ((images.slice(0, 10).length * 0.002) / events.length).toFixed(3) : '0.000'}

## 🚀 Next Steps

1. **Database Storage:** Store extracted events in \`whatsapp_events\` table
2. **Calendar Export:** Export to iCal format for calendar integration
3. **Batch Processing:** Process all 39,410 images with valid file paths
4. **Deduplication:** Merge events that appear in multiple images
5. **Validation:** Review low-confidence extractions manually

## 📝 Notes

- Vision model automatically filters out non-event posters
- College admission posters, ads, and personal photos are excluded
- Some event details may be in regional languages (Tamil, etc.)
- Manual review recommended for events with confidence < 60%
`

  // Save to vault
  const vaultPath = "./reports/WhatsApp-Vision-Events-Report.md"
  yield* Effect.tryPromise({
    try: () => Bun.write(vaultPath, report),
    catch: (error) => new Error(`Failed to write report: ${error}`),
  })

  yield* Console.log(`✅ Report saved to: ${vaultPath}`)
  yield* Console.log(`\n📈 Summary:`)
  yield* Console.log(`   Images processed: ${images.slice(0, 10).length}`)
  yield* Console.log(`   Event posters found: ${events.length}`)
  yield* Console.log(`   Top events in report: ${top10.length}`)
  yield* Console.log(`   Average confidence: ${(events.reduce((sum, e) => sum + e.confidence, 0) / events.length * 100).toFixed(0)}%`)
  yield* Console.log(`   Estimated cost: $${(images.slice(0, 10).length * 0.002).toFixed(3)}`)
})

/**
 * Get statistics by category
 */
function getCategoryStats(events: ReadonlyArray<any>): string {
  const counts = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `- **${category}**: ${count}`)
    .join('\n')
}

/**
 * Export command function for CLI
 */
export const extractVisionEventsCommand = () => program.pipe(
  Effect.provide(VisionEventExtractionServiceLive)
)
