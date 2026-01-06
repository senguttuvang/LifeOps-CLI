// @ts-nocheck - Experimental feature (vision event extraction)
/**
 * WhatsApp Image Event Extraction Service (Effect-TS)
 *
 * Extracts events from images (posters/flyers) using vision models
 */

import { Context, Effect, Layer } from "effect"
import { Database } from "bun:sqlite"
import { DatabaseError, ClaudeError } from "../errors"

/**
 * Image message with event poster
 */
export interface ImageMessage {
  readonly id: string
  readonly chatId: string
  readonly mediaUrl: string
  readonly caption: string | undefined
  readonly timestamp: number
  readonly messageType: string
}

/**
 * Event extracted from image
 */
export interface ImageExtractedEvent {
  readonly eventName: string
  readonly date: string | undefined
  readonly time: string | undefined
  readonly location: string | undefined
  readonly organizer: string | undefined
  readonly description: string | undefined
  readonly category: "workshop" | "class" | "performance" | "gathering" | "ceremony" | "sports" | "notice" | "other"
  readonly registrationInfo: string | undefined
  readonly contactInfo: string | undefined
  readonly sourceMessageId: string
  readonly sourceImageUrl: string
  readonly caption: string | undefined
  readonly confidence: number
}

/**
 * Image Event Extraction Service
 */
export class ImageEventExtractionService extends Context.Tag("ImageEventExtractionService")<
  ImageEventExtractionService,
  {
    readonly findImageMessages: (days: number) => Effect.Effect<ReadonlyArray<ImageMessage>, DatabaseError>
    readonly extractEventFromImage: (message: ImageMessage) => Effect.Effect<ImageExtractedEvent | null, ClaudeError>
    readonly extractEventsFromImages: (messages: ReadonlyArray<ImageMessage>) => Effect.Effect<ReadonlyArray<ImageExtractedEvent>, ClaudeError>
  }
>() {}

/**
 * Implementation
 */
export const ImageEventExtractionServiceLive = Layer.effect(
  ImageEventExtractionService,
  Effect.gen(function* () {
    // Get OpenRouter API key
    const openRouterKey = yield* Effect.sync(() => {
      const key = process.env.OPENROUTER_API_KEY
      if (!key) {
        throw new Error("OPENROUTER_API_KEY not set")
      }
      return key
    })

    return {
      /**
       * Find messages with image attachments
       * Note: Android backup doesn't include media files, but captions often contain event details
       */
      findImageMessages: (days: number) => Effect.gen(function* () {
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
            SELECT id, chat_id, content, timestamp, message_type
            FROM whatsapp_messages
            WHERE message_type = 'image'
            AND content IS NOT NULL
            AND content != ''
            AND (
              content LIKE '%event%'
              OR content LIKE '%workshop%'
              OR content LIKE '%class%'
              OR content LIKE '%session%'
              OR content LIKE '%gathering%'
              OR content LIKE '%performance%'
              OR content LIKE '%ceremony%'
              OR content LIKE '%meeting%'
              OR content LIKE '%concert%'
              OR content LIKE '%screening%'
              OR content LIKE '%exhibition%'
              OR content LIKE '%📍%'
              OR content LIKE '%🕰%'
              OR content LIKE '%📅%'
            )
            AND timestamp >= ?
            ORDER BY timestamp DESC
            LIMIT 100
          `

          const results = db.prepare(query).all(cutoff) as Array<{
            id: string
            chat_id: string
            content: string | null
            timestamp: number
            message_type: string
          }>

          db.close()

          return results.map(r => ({
            id: r.id,
            chatId: r.chat_id,
            mediaUrl: "", // No actual media URL in Android backup
            caption: r.content || undefined,
            timestamp: r.timestamp,
            messageType: r.message_type,
          }))
        } catch (error) {
          db.close()
          return yield* Effect.fail(
            new DatabaseError({
              message: `Query failed: ${error}`,
              query: "findImageMessages",
            })
          )
        }
      }),

      /**
       * Extract event from image caption using text LLM
       * Note: Android backup doesn't include media files, so we extract from captions
       */
      extractEventFromImage: (message: ImageMessage) => Effect.gen(function* () {
        if (!message.caption) {
          return null
        }

        // Prepare prompt for text-based extraction
        const prompt = `Extract event information from this WhatsApp image caption. Image captions in Auroville groups often contain event details even without seeing the actual poster.

Caption text:
"${message.caption}"

Extract the following details if present:
- Event name/title
- Date (in YYYY-MM-DD format if possible)
- Time
- Location/venue
- Organizer/host
- Description/details
- Registration information (URL, email, phone)
- Contact information
- Category (workshop, class, performance, gathering, ceremony, sports, notice, other)

Return ONLY valid JSON with this structure:
{
  "eventName": "string",
  "date": "YYYY-MM-DD or null",
  "time": "string or null",
  "location": "string or null",
  "organizer": "string or null",
  "description": "string or null",
  "category": "workshop|class|performance|gathering|ceremony|sports|notice|other",
  "registrationInfo": "string or null",
  "contactInfo": "string or null",
  "confidence": 0.0-1.0
}

If this caption doesn't contain event information, return null.

Examples:
- "Today 📍ArtForest 🕰️6:30 pm onwards 🎸 Bring your instrument" → extract event at ArtForest at 6:30pm
- "Workshop on mindfulness, April 12, Unity Pavilion" → extract workshop details
- "Hello Everyone." → return null (not an event)`

        // Call OpenRouter with cheap text model (Groq Llama)
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
                model: "meta-llama/llama-3.3-70b-instruct",  // Using Llama 3.3 70B (cheap and good)
                messages: [
                  {
                    role: "user",
                    content: prompt
                  }
                ],
                max_tokens: 600,
                temperature: 0.2,
              })
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
            // Extract JSON from response
            const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                             response.match(/(\{[\s\S]*\})/)

            if (!jsonMatch) {
              return null
            }

            const json = JSON.parse(jsonMatch[1])

            // Return null if not an event
            if (json === null || json.eventName === null) {
              return null
            }

            return json
          },
          catch: () => null,
        })

        if (!parsed) {
          return null
        }

        return {
          eventName: parsed.eventName,
          date: parsed.date || undefined,
          time: parsed.time || undefined,
          location: parsed.location || undefined,
          organizer: parsed.organizer || undefined,
          description: parsed.description || undefined,
          category: parsed.category || "other",
          registrationInfo: parsed.registrationInfo || undefined,
          contactInfo: parsed.contactInfo || undefined,
          sourceMessageId: message.id,
          sourceImageUrl: message.mediaUrl,
          caption: message.caption,
          confidence: parsed.confidence || 0.5,
        }
      }),

      /**
       * Extract events from multiple images (batch processing)
       */
      extractEventsFromImages: (messages: ReadonlyArray<ImageMessage>) => Effect.gen(function* () {
        const events: ImageExtractedEvent[] = []
        const service = yield* ImageEventExtractionService

        // Process images one by one (to avoid rate limits)
        for (const message of messages.slice(0, 15)) {  // Limit to 15 captions
          try {
            const event = yield* service.extractEventFromImage(message)

            if (event) {
              events.push(event)
            }

            // Small delay to avoid rate limiting
            yield* Effect.sleep("500 millis")
          } catch (error) {
            console.error(`Failed to extract from caption ${message.id}:`, error)
            // Continue with next message
          }
        }

        return events
      }),
    }
  })
)
