// @ts-nocheck - Experimental feature (vision event extraction)
/**
 * WhatsApp Vision-Based Event Extraction Service (Effect-TS)
 *
 * Extracts events from actual image files using Claude Vision API
 */

import { Database } from "bun:sqlite";
import { Context, Effect, Layer } from "effect";

import { ClaudeError, DatabaseError } from "../errors";

/**
 * Image message with actual file path
 */
export interface ImageMessageWithPath {
  readonly id: string;
  readonly messageRowId: number;
  readonly timestamp: number;
  readonly filePath: string; // Relative path from msgstore.db
  readonly fullPath: string; // Absolute path to actual file
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly caption: string | undefined;
}

/**
 * Event extracted from image using vision model
 */
export interface VisionExtractedEvent {
  readonly eventName: string;
  readonly date: string | undefined;
  readonly time: string | undefined;
  readonly location: string | undefined;
  readonly organizer: string | undefined;
  readonly description: string | undefined;
  readonly category: "workshop" | "class" | "performance" | "gathering" | "ceremony" | "sports" | "notice" | "other";
  readonly registrationInfo: string | undefined;
  readonly contactInfo: string | undefined;
  readonly sourceMessageId: number;
  readonly sourceImagePath: string;
  readonly caption: string | undefined;
  readonly confidence: number;
  readonly isEventPoster: boolean; // Filter out ads, college posters, personal photos
}

/**
 * Vision Event Extraction Service
 */
export class VisionEventExtractionService extends Context.Tag("VisionEventExtractionService")<
  VisionEventExtractionService,
  {
    readonly findImagesWithPaths: (limit: number) => Effect.Effect<ReadonlyArray<ImageMessageWithPath>, DatabaseError>;
    readonly extractEventFromImage: (
      image: ImageMessageWithPath,
    ) => Effect.Effect<VisionExtractedEvent | null, ClaudeError>;
    readonly extractEventsFromImages: (
      images: ReadonlyArray<ImageMessageWithPath>,
    ) => Effect.Effect<ReadonlyArray<VisionExtractedEvent>, ClaudeError>;
  }
>() {}

/**
 * Implementation
 */
export const VisionEventExtractionServiceLive = Layer.effect(
  VisionEventExtractionService,
  Effect.gen(function* () {
    // Get OpenRouter API key
    const openRouterKey = yield* Effect.sync(() => {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) {
        throw new Error("OPENROUTER_API_KEY not set");
      }
      return key;
    });

    // WhatsApp Export base path
    const whatsappExportPath = process.env.WHATSAPP_EXPORT_PATH ?? "./data/whatsapp-export";

    return {
      /**
       * Find messages with image file paths that exist
       */
      findImagesWithPaths: (limit: number) =>
        Effect.gen(function* () {
          const dbPath = process.env.WHATSAPP_DB_PATH ?? "./data/msgstore.db";
          const db = yield* Effect.try({
            try: () => new Database(dbPath, { readonly: true }),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to open database: ${error}`,
                query: undefined,
              }),
          });

          const results = yield* Effect.try({
            try: () => {
              // Query for images with file paths, prioritizing larger images (likely posters)
              const query = `
              SELECT
                m._id,
                m.key_id,
                m.timestamp,
                mm.file_path,
                mm.width,
                mm.height,
                mm.media_caption
              FROM message m
              JOIN message_media mm ON m._id = mm.message_row_id
              WHERE mm.mime_type = 'image/jpeg'
              AND mm.file_path IS NOT NULL
              AND mm.file_path <> ''
              AND mm.file_path LIKE '%WhatsApp Images%'
              AND mm.width > 600
              AND m.timestamp < 1715904000000
              ORDER BY m.timestamp DESC
              LIMIT ?
            `;

              return db.prepare(query).all(limit) as Array<{
                _id: number;
                key_id: string;
                timestamp: number;
                file_path: string;
                width: number | null;
                height: number | null;
                media_caption: string | null;
              }>;
            },
            catch: (error) =>
              new DatabaseError({
                message: `Query failed: ${error}`,
                query: "findImagesWithPaths",
              }),
          });

          db.close();

          // Filter for images that actually exist on disk
          const imagesWithPaths = results.map((r) => ({
            id: r.key_id,
            messageRowId: r._id,
            timestamp: r.timestamp,
            filePath: r.file_path,
            fullPath: `${whatsappExportPath}/${r.file_path}`,
            width: r.width ?? undefined,
            height: r.height ?? undefined,
            caption: r.media_caption ?? undefined,
          }));

          // Verify files exist (using Effect)
          const existingImages: ImageMessageWithPath[] = [];
          for (const img of imagesWithPaths) {
            const exists = yield* Effect.tryPromise({
              try: async () => await Bun.file(img.fullPath).exists(),
              catch: () => false,
            });
            if (exists) {
              existingImages.push(img);
            }
          }

          return existingImages;
        }),

      /**
       * Extract event from image using Claude Vision
       */
      extractEventFromImage: (image: ImageMessageWithPath) =>
        Effect.gen(function* () {
          // Read image file
          const imageFile = yield* Effect.tryPromise({
            try: async () => {
              const file = Bun.file(image.fullPath);
              const exists = await file.exists();
              if (!exists) {
                throw new Error(`Image file not found: ${image.fullPath}`);
              }
              return file;
            },
            catch: (error) =>
              new ClaudeError({
                message: `Failed to read image: ${error}`,
                prompt: undefined,
              }),
          });

          // Convert to base64
          const imageBytes = yield* Effect.tryPromise({
            try: async () => await imageFile.arrayBuffer(),
            catch: (error) =>
              new ClaudeError({
                message: `Failed to read image bytes: ${error}`,
                prompt: undefined,
              }),
          });

          const base64Image = Buffer.from(imageBytes).toString("base64");

          // Prepare vision prompt
          const prompt = `Analyze this image and determine if it's an EVENT POSTER for Auroville community events.

EVENT POSTERS include:
- Workshops, classes, sessions
- Performances, concerts, screenings
- Gatherings, ceremonies, celebrations
- Sports events, exhibitions
- Community meetings, talks

NOT event posters (return null for these):
- Educational institution ads (college/school admissions)
- Product advertisements
- Personal photos
- Memes or social media posts
- Government announcements
- Job postings

If this IS an event poster, extract:
- Event name/title
- Date (in YYYY-MM-DD format if possible, or text like "Next Sunday")
- Time
- Location/venue
- Organizer/host
- Description/details
- Registration info (URL, email, phone)
- Contact information
- Category (workshop, class, performance, gathering, ceremony, sports, notice, other)

${image.caption ? `\nImage caption from WhatsApp: "${image.caption}"` : ""}

Return ONLY valid JSON:
{
  "isEventPoster": true/false,
  "eventName": "string or null",
  "date": "string or null",
  "time": "string or null",
  "location": "string or null",
  "organizer": "string or null",
  "description": "string or null",
  "category": "workshop|class|performance|gathering|ceremony|sports|notice|other",
  "registrationInfo": "string or null",
  "contactInfo": "string or null",
  "confidence": 0.0-1.0
}

If not an event poster, return: {"isEventPoster": false, "confidence": 0.0}`;

          // Call OpenRouter Vision API (Google Gemini Flash for cost-effectiveness)
          const response = yield* Effect.tryPromise({
            try: async () => {
              const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${openRouterKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://lifeops.local",
                  "X-Title": "LifeOps WhatsApp Vision Event Extraction",
                },
                body: JSON.stringify({
                  model: "qwen/qwen-2-vl-72b-instruct", // Cost-effective vision model ($0.19/M tokens)
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: prompt,
                        },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                          },
                        },
                      ],
                    },
                  ],
                  max_tokens: 1024,
                  temperature: 0.2,
                }),
              });

              if (!res.ok) {
                const error = await res.text();
                throw new Error(`OpenRouter API error: ${error}`);
              }

              const data = (await res.json()) as any;
              return data.choices[0].message.content;
            },
            catch: (error) =>
              new ClaudeError({
                message: `Vision API failed: ${error}`,
                prompt: prompt.slice(0, 200),
              }),
          });

          // Parse JSON response
          const parsed = yield* Effect.try({
            try: () => {
              // Extract JSON from response
              const jsonMatch =
                response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || response.match(/(\{[\s\S]*\})/);

              if (!jsonMatch) {
                return null;
              }

              const json = JSON.parse(jsonMatch[1]);

              // Return null if not an event poster
              if (!json.isEventPoster) {
                return null;
              }

              return json;
            },
            catch: () => null,
          });

          if (!parsed) {
            return null;
          }

          return {
            eventName: parsed.eventName ?? "Unknown Event",
            date: parsed.date ?? undefined,
            time: parsed.time ?? undefined,
            location: parsed.location ?? undefined,
            organizer: parsed.organizer ?? undefined,
            description: parsed.description ?? undefined,
            category: parsed.category ?? "other",
            registrationInfo: parsed.registrationInfo ?? undefined,
            contactInfo: parsed.contactInfo ?? undefined,
            sourceMessageId: image.messageRowId,
            sourceImagePath: image.fullPath,
            caption: image.caption,
            confidence: parsed.confidence ?? 0.5,
            isEventPoster: true,
          };
        }),

      /**
       * Extract events from multiple images (batch processing with rate limiting)
       */
      extractEventsFromImages: (images: ReadonlyArray<ImageMessageWithPath>) =>
        Effect.gen(function* () {
          const events: VisionExtractedEvent[] = [];
          const service = yield* VisionEventExtractionService;

          // Process images one by one with rate limiting (for sampling/testing)
          for (const image of images.slice(0, 10)) {
            // Limit to 10 images for sampling
            try {
              const event = yield* service.extractEventFromImage(image);

              if (event && event.isEventPoster) {
                events.push(event);
              }

              // Rate limiting: Claude Vision has limits, add delay
              yield* Effect.sleep("2 seconds");
            } catch (error) {
              console.error(`Failed to extract from image ${image.id}:`, error);
              // Continue with next image
            }
          }

          return events;
        }),
    };
  }),
);
