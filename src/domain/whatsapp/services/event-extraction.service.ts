// @ts-nocheck - Experimental feature (vision event extraction)
/**
 * WhatsApp Event Extraction Service (Effect-TS)
 *
 * Extracts, classifies, and deduplicates events from WhatsApp messages
 */

import { Context, Effect, Layer } from "effect"
import { Database } from "bun:sqlite"
import { DatabaseError, ClaudeError } from "../errors"

/**
 * Extracted event structure
 */
export interface ExtractedEvent {
  readonly eventName: string
  readonly date: string | undefined
  readonly time: string | undefined
  readonly location: string | undefined
  readonly organizer: string | undefined
  readonly description: string | undefined
  readonly category: "workshop" | "class" | "performance" | "gathering" | "ceremony" | "sports" | "notice" | "other"
  readonly sourceMessages: ReadonlyArray<string> // Message IDs
  readonly confidence: number // 0-1
}

/**
 * Message with potential event info
 */
interface EventCandidate {
  readonly id: string
  readonly chatId: string
  readonly content: string
  readonly timestamp: number
}

/**
 * Event Extraction Service
 */
export class EventExtractionService extends Context.Tag("EventExtractionService")<
  EventExtractionService,
  {
    readonly findEventCandidates: (days: number) => Effect.Effect<ReadonlyArray<EventCandidate>, DatabaseError>
    readonly extractEvents: (messages: ReadonlyArray<EventCandidate>) => Effect.Effect<ReadonlyArray<ExtractedEvent>, ClaudeError>
    readonly deduplicateEvents: (events: ReadonlyArray<ExtractedEvent>) => Effect.Effect<ReadonlyArray<ExtractedEvent>, never>
  }
>() {}

/**
 * Implementation
 */
export const EventExtractionServiceLive = Layer.effect(
  EventExtractionService,
  Effect.gen(function* () {
    // Get OpenRouter API key from environment
    const openRouterKey = yield* Effect.sync(() => {
      const key = process.env.OPENROUTER_API_KEY
      if (!key) {
        throw new Error("OPENROUTER_API_KEY not set")
      }
      return key
    })

    return {
      /**
       * Find messages that likely contain event information
       */
      findEventCandidates: (days: number) => Effect.gen(function* () {
        const dbPath = process.env.LIFEOPS_DB_PATH ?? "./lifeops.db"
        const db = yield* Effect.try({
          try: () => new Database(dbPath, { readonly: true }),
          catch: (error) => new DatabaseError({
            message: `Failed to open database: ${error}`,
            query: undefined,
          }),
        })

        try {
          const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

          const query = `
            SELECT id, chat_id, content, timestamp
            FROM whatsapp_messages
            WHERE content IS NOT NULL
            AND timestamp >= ?
            AND (
              content LIKE '%event%'
              OR content LIKE '%workshop%'
              OR content LIKE '%class%'
              OR content LIKE '%session%'
              OR content LIKE '%gathering%'
              OR content LIKE '%performance%'
              OR content LIKE '%ceremony%'
              OR content LIKE '%meeting%'
              OR content LIKE '%talk%'
              OR content LIKE '%concert%'
              OR content LIKE '%screening%'
              OR content LIKE '%exhibition%'
            )
            ORDER BY timestamp DESC
            LIMIT 500
          `

          const results = db.prepare(query).all(cutoff) as Array<{
            id: string
            chat_id: string
            content: string
            timestamp: number
          }>

          db.close()

          return results.map(r => ({
            id: r.id,
            chatId: r.chat_id,
            content: r.content,
            timestamp: r.timestamp,
          }))
        } catch (error) {
          db.close()
          return yield* Effect.fail(
            new DatabaseError({
              message: `Query failed: ${error}`,
              query: "findEventCandidates",
            })
          )
        }
      }),

      /**
       * Extract structured events from messages using Claude
       */
      extractEvents: (messages: ReadonlyArray<EventCandidate>) => Effect.gen(function* () {
        if (messages.length === 0) {
          return []
        }

        // Build batch prompt
        const messageBatch = messages.slice(0, 50).map((m, idx) =>
          `[${idx}] ${new Date(m.timestamp * 1000).toISOString().split('T')[0]}: ${m.content}`
        ).join('\n\n')

        const prompt = `Extract events from these WhatsApp messages. For each event found, provide:
- Event name
- Date (YYYY-MM-DD format if mentioned, or estimate from context)
- Time (if mentioned)
- Location/venue
- Organizer/host
- Brief description
- Category: workshop, class, performance, gathering, ceremony, sports, notice, or other
- Confidence score (0.0-1.0)

Messages:
${messageBatch}

Return ONLY a valid JSON array of events. Each event must have this structure:
{
  "eventName": "string",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or time description or null",
  "location": "string or null",
  "organizer": "string or null",
  "description": "string or null",
  "category": "workshop|class|performance|gathering|ceremony|sports|notice|other",
  "sourceMessageIndex": 0,
  "confidence": 0.0-1.0
}

Important:
- Skip messages that are just casual mentions without actual event details
- If a date is mentioned like "April 12" or "12th", use the current year (2025)
- If a message mentions multiple events, extract them separately
- Return empty array [] if no events found`

        // Call OpenRouter with Llama 3.3 70B
        const response = yield* Effect.tryPromise({
          try: async () => {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://lifeops.local",
                "X-Title": "LifeOps WhatsApp Event Extraction",
              },
              body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 2000,
                temperature: 0.2,
              }),
            })

            if (!res.ok) {
              const error = await res.text()
              throw new Error(`OpenRouter API error: ${error}`)
            }

            const data = await res.json() as any
            return data.choices[0].message.content
          },
          catch: (error) => new ClaudeError({
            message: `LLM API failed: ${error}`,
            prompt: prompt.slice(0, 200),
          }),
        })

        // Parse JSON response
        const parsed = yield* Effect.try({
          try: () => {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
                             response.match(/(\[[\s\S]*\])/)

            if (!jsonMatch) {
              return []
            }

            return JSON.parse(jsonMatch[1])
          },
          catch: (error) => new ClaudeError({
            message: `Failed to parse Claude response: ${error}`,
            prompt: response.slice(0, 200),
          }),
        })

        // Map to ExtractedEvent with source message IDs
        return parsed.map((event: any) => ({
          eventName: event.eventName,
          date: event.date || undefined,
          time: event.time || undefined,
          location: event.location || undefined,
          organizer: event.organizer || undefined,
          description: event.description || undefined,
          category: event.category || "other",
          sourceMessages: [messages[event.sourceMessageIndex]?.id || "unknown"],
          confidence: event.confidence || 0.5,
        }))
      }),

      /**
       * Deduplicate events based on name, date, and location similarity
       */
      deduplicateEvents: (events: ReadonlyArray<ExtractedEvent>) => Effect.gen(function* () {
        const unique: ExtractedEvent[] = []
        const seen = new Set<string>()

        for (const event of events) {
          // Create a normalized key for deduplication
          const key = [
            event.eventName.toLowerCase().trim(),
            event.date || "no-date",
            event.location?.toLowerCase().trim() || "no-location"
          ].join("|")

          if (!seen.has(key)) {
            seen.add(key)
            unique.push(event)
          } else {
            // Merge source messages if duplicate
            const existing = unique.find(e =>
              e.eventName.toLowerCase() === event.eventName.toLowerCase() &&
              e.date === event.date &&
              e.location?.toLowerCase() === event.location?.toLowerCase()
            )

            if (existing) {
              ;(existing as any).sourceMessages = [
                ...existing.sourceMessages,
                ...event.sourceMessages
              ]
              // Use higher confidence score
              ;(existing as any).confidence = Math.max(existing.confidence, event.confidence)
            }
          }
        }

        // Sort by date (most recent first), then confidence
        return unique.sort((a, b) => {
          if (a.date && b.date) {
            return new Date(b.date).getTime() - new Date(a.date).getTime()
          }
          if (a.date) return -1
          if (b.date) return 1
          return b.confidence - a.confidence
        })
      }),
    }
  })
)
