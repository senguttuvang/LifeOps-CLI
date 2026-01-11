/**
 * Signal Extraction Service
 *
 * Extracts behavioral signals from message history and stores them for
 * use in RAG+Signals personalization system.
 *
 * Provides:
 * - Signal extraction from message history
 * - Signal refresh/update
 * - Signal retrieval from cache
 *
 * Related: docs/implementation-plan-rag-signals.md
 */

import { and, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
// Schema types are still needed for query construction
// v3: interactions → communicationEvents, interactionId → eventId, source → channelId
// behaviorSignals is backward-compatible alias for behaviorSignals
import { behaviorSignals, communicationEvents, conversations, messages } from "../../infrastructure/db/schema/index";
// Import from domain ports (not directly from infrastructure)
import { DatabaseService } from "../ports";
import {
  extractBehavioralPatterns,
  extractEmojiPatterns,
  extractMessageStructure,
  extractPhrasePatterns,
  extractPunctuationPatterns,
  extractResponseTimes,
  extractTemporalPatterns,
} from "./extractors";
import { signalCache } from "./signal-cache";

import type { MessageForSignals, UserSignals } from "./types";

/**
 * Minimum messages required for reliable signal extraction
 */
const MIN_MESSAGE_COUNT = 50;

/**
 * Signal Extraction Service Interface
 */
export interface SignalExtractionService {
  /**
   * Extract signals for a user from their message history
   *
   * @param userId - Contact ID
   * @returns Computed user signals
   * @throws Error if insufficient data or extraction fails
   */
  readonly extractSignals: (userId: string) => Effect.Effect<UserSignals, Error>;

  /**
   * Refresh signals for a user (recompute from latest data)
   *
   * @param userId - Contact ID
   * @returns void
   * @throws Error if extraction fails
   */
  readonly refreshSignals: (userId: string) => Effect.Effect<void, Error>;

  /**
   * Get signals for a user (from cache/DB, no recomputation)
   *
   * @param userId - Contact ID
   * @returns Stored user signals or undefined if not found
   */
  readonly getSignals: (userId: string) => Effect.Effect<UserSignals | undefined, Error>;
}

/**
 * Signal Extraction Service Tag (for dependency injection)
 */
export class SignalExtractionServiceTag extends Context.Tag("SignalExtractionService")<
  SignalExtractionServiceTag,
  SignalExtractionService
>() {}

/**
 * Signal Extraction Service Implementation (Layer)
 */
export const SignalExtractionLive = Layer.effect(
  SignalExtractionServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;

    /**
     * Fetch user messages from database
     */
    const fetchUserMessages = (userId: string): Effect.Effect<MessageForSignals[], Error> =>
      Effect.gen(function* () {
        const msgs = yield* Effect.tryPromise({
          try: () =>
            db
              .select({
                id: messages.eventId,
                text: messages.content,
                fromMe: communicationEvents.direction,
                timestamp: communicationEvents.occurredAt,
                contentType: messages.contentType,
              })
              .from(messages)
              .innerJoin(communicationEvents, eq(messages.eventId, communicationEvents.id))
              .innerJoin(conversations, eq(communicationEvents.conversationId, conversations.id))
              .where(
                and(
                  eq(conversations.channelId, "whatsapp"),
                  // Filter messages where user is participant (either sender or recipient)
                  // This is a simplification - in reality we'd join with conversation_participants
                ),
              )
              .orderBy(desc(communicationEvents.occurredAt))
              .limit(1000)
              .execute(),
          catch: (e) => new Error(`Failed to fetch user messages: ${e}`),
        });

        // Transform to MessageForSignals
        return msgs.map((msg) => ({
          id: msg.id,
          text: msg.text,
          fromMe: msg.fromMe === "outbound",
          timestamp: msg.timestamp || new Date(),
          mediaType: msg.contentType !== "text" ? msg.contentType : undefined,
          isEdited: false, // TODO: Add edit tracking to schema
        }));
      });

    /**
     * Calculate confidence score based on sample size and quality
     */
    const calculateConfidence = (messageCount: number): number => {
      if (messageCount < MIN_MESSAGE_COUNT) {
        return 0;
      }
      if (messageCount < 100) {
        return 0.5;
      }
      if (messageCount < 200) {
        return 0.7;
      }
      if (messageCount < 500) {
        return 0.85;
      }
      return 0.95;
    };

    /**
     * Store signals in database
     * v3: Uses single signalData JSON column instead of individual columns
     */
    const storeSignals = (signals: UserSignals): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: async () => {
            // v3 schema uses signalData JSON column for all patterns
            const signalData = {
              // Response patterns
              avgResponseTimeMinutes: signals.avgResponseTimeMinutes,
              responseTimeP50: signals.responseTimeP50,
              responseTimeP95: signals.responseTimeP95,
              initiationRate: signals.initiationRate,
              // Message structure
              avgMessageLength: signals.avgMessageLength,
              messageLengthStd: signals.messageLengthStd,
              medianMessageLength: signals.medianMessageLength,
              avgWordsPerMessage: signals.avgWordsPerMessage,
              // Expression style
              emojiPerMessage: signals.emojiPerMessage,
              emojiVariance: signals.emojiVariance,
              topEmojis: signals.topEmojis,
              emojiPosition: signals.emojiPosition,
              // Punctuation
              exclamationRate: signals.exclamationRate,
              questionRate: signals.questionRate,
              periodRate: signals.periodRate,
              ellipsisRate: signals.ellipsisRate,
              // Common patterns
              commonGreetings: signals.commonGreetings,
              commonEndings: signals.commonEndings,
              commonPhrases: signals.commonPhrases,
              fillerWords: signals.fillerWords,
              // Behavioral
              asksFollowupQuestions: signals.asksFollowupQuestions,
              usesVoiceNotes: signals.usesVoiceNotes,
              sendsMultipleMessages: signals.sendsMultipleMessages,
              editsMessages: signals.editsMessages,
              // Temporal
              activeHours: signals.activeHours,
              weekendVsWeekdayDiff: signals.weekendVsWeekdayDiff,
            };

            // Prepare database record for v3 schema
            const record = {
              id: crypto.randomUUID(),
              partyId: signals.userId, // v3: userId → partyId
              signalData: JSON.stringify(signalData),
              sampleSize: signals.messageCount, // v3: messageCount → sampleSize
              confidence: signals.confidence,
              computedAt: new Date(signals.lastComputedAt), // v3: lastComputedAt → computedAt
              validUntil: null,
              updatedAt: new Date(),
            };

            // Upsert (insert or update if exists)
            const existing = await db
              .select()
              .from(behaviorSignals)
              .where(eq(behaviorSignals.partyId, signals.userId))
              .execute();

            await (existing.length > 0
              ? db.update(behaviorSignals).set(record).where(eq(behaviorSignals.partyId, signals.userId)).execute()
              : db.insert(behaviorSignals).values(record).execute());
          },
          catch: (e) => new Error(`Failed to store signals: ${e}`),
        });
      });

    /**
     * Extract signals from message history
     */
    const extractSignals = (userId: string): Effect.Effect<UserSignals, Error> =>
      Effect.gen(function* () {
        // 1. Fetch all user messages
        const messageList = yield* fetchUserMessages(userId);

        if (messageList.length < MIN_MESSAGE_COUNT) {
          return yield* Effect.fail(
            new Error(`Insufficient data: need at least ${MIN_MESSAGE_COUNT} messages, found ${messageList.length}`),
          );
        }

        // 2. Extract all signals in parallel
        const [
          responseTimeSignals,
          emojiSignals,
          structureSignals,
          phraseSignals,
          punctuationSignals,
          behavioralSignals,
          temporalSignals,
        ] = yield* Effect.all([
          Effect.sync(() => extractResponseTimes(messageList)),
          Effect.sync(() => extractEmojiPatterns(messageList)),
          Effect.sync(() => extractMessageStructure(messageList)),
          Effect.sync(() => extractPhrasePatterns(messageList)),
          Effect.sync(() => extractPunctuationPatterns(messageList)),
          Effect.sync(() => extractBehavioralPatterns(messageList)),
          Effect.sync(() => extractTemporalPatterns(messageList)),
        ]);

        // 3. Combine into UserSignals
        const signals: UserSignals = {
          userId,

          // Response patterns
          avgResponseTimeMinutes: responseTimeSignals.avgResponseTimeMinutes,
          responseTimeP50: responseTimeSignals.responseTimeP50,
          responseTimeP95: responseTimeSignals.responseTimeP95,
          initiationRate: behavioralSignals.initiationRate,

          // Message structure
          avgMessageLength: structureSignals.avgMessageLength,
          messageLengthStd: structureSignals.messageLengthStd,
          medianMessageLength: structureSignals.medianMessageLength,
          avgWordsPerMessage: structureSignals.avgWordsPerMessage,

          // Expression style
          emojiPerMessage: emojiSignals.emojiPerMessage,
          emojiVariance: emojiSignals.emojiVariance,
          topEmojis: emojiSignals.topEmojis,
          emojiPosition: emojiSignals.emojiPosition,

          // Punctuation
          exclamationRate: punctuationSignals.exclamationRate,
          questionRate: punctuationSignals.questionRate,
          periodRate: punctuationSignals.periodRate,
          ellipsisRate: punctuationSignals.ellipsisRate,

          // Common patterns
          commonGreetings: phraseSignals.commonGreetings,
          commonEndings: phraseSignals.commonEndings,
          commonPhrases: phraseSignals.commonPhrases,
          fillerWords: phraseSignals.fillerWords,

          // Behavioral
          asksFollowupQuestions: behavioralSignals.asksFollowupQuestions,
          usesVoiceNotes: behavioralSignals.usesVoiceNotes,
          sendsMultipleMessages: behavioralSignals.sendsMultipleMessages,
          editsMessages: behavioralSignals.editsMessages,

          // Temporal
          activeHours: temporalSignals.activeHours,
          weekendVsWeekdayDiff: temporalSignals.weekendVsWeekdayDiff,

          // Metadata
          messageCount: messageList.length,
          confidence: calculateConfidence(messageList.length),
          lastComputedAt: new Date(),
        };

        // 4. Store in database
        yield* storeSignals(signals);

        // 5. Update cache
        signalCache.set(userId, signals);

        return signals;
      });

    /**
     * Refresh signals (recompute and update)
     */
    const refreshSignals = (userId: string): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* extractSignals(userId);
      });

    /**
     * Get stored signals from database (with caching)
     * v3: Parses from signalData JSON column
     */
    const getSignals = (userId: string): Effect.Effect<UserSignals | undefined, Error> =>
      Effect.gen(function* () {
        // Check cache first
        const cached = signalCache.get(userId);
        if (cached) {
          return cached;
        }

        // Fetch from database using v3 schema (partyId instead of userId)
        const result = yield* Effect.tryPromise({
          try: () => db.select().from(behaviorSignals).where(eq(behaviorSignals.partyId, userId)).execute(),
          catch: (e) => new Error(`Failed to retrieve signals: ${e}`),
        });

        if (result.length === 0) {
          return;
        }

        const record = result[0];

        // v3: Parse signalData JSON column
        const signalData = record.signalData ? JSON.parse(record.signalData) : {};

        const signals: UserSignals = {
          userId: record.partyId, // v3: partyId → userId for domain compatibility

          // Response patterns
          avgResponseTimeMinutes: signalData.avgResponseTimeMinutes || 0,
          responseTimeP50: signalData.responseTimeP50 || 0,
          responseTimeP95: signalData.responseTimeP95 || 0,
          initiationRate: signalData.initiationRate || 0,

          // Message structure
          avgMessageLength: signalData.avgMessageLength || 0,
          messageLengthStd: signalData.messageLengthStd || 0,
          medianMessageLength: signalData.medianMessageLength || 0,
          avgWordsPerMessage: signalData.avgWordsPerMessage || 0,

          // Expression style
          emojiPerMessage: signalData.emojiPerMessage || 0,
          emojiVariance: signalData.emojiVariance || 0,
          topEmojis: signalData.topEmojis || [],
          emojiPosition: signalData.emojiPosition || { start: 0, middle: 0, end: 0 },

          // Punctuation
          exclamationRate: signalData.exclamationRate || 0,
          questionRate: signalData.questionRate || 0,
          periodRate: signalData.periodRate || 0,
          ellipsisRate: signalData.ellipsisRate || 0,

          // Common patterns
          commonGreetings: signalData.commonGreetings || [],
          commonEndings: signalData.commonEndings || [],
          commonPhrases: signalData.commonPhrases || [],
          fillerWords: signalData.fillerWords || [],

          // Behavioral
          asksFollowupQuestions: signalData.asksFollowupQuestions || 0,
          usesVoiceNotes: signalData.usesVoiceNotes || 0,
          sendsMultipleMessages: signalData.sendsMultipleMessages || 0,
          editsMessages: signalData.editsMessages || 0,

          // Temporal
          activeHours: signalData.activeHours || { peak: [], low: [] },
          weekendVsWeekdayDiff: signalData.weekendVsWeekdayDiff || 0,

          // Metadata (from v3 record columns)
          messageCount: record.sampleSize, // v3: sampleSize → messageCount
          confidence: record.confidence,
          lastComputedAt: record.computedAt || new Date(), // v3: computedAt → lastComputedAt
        };

        // Cache the signals
        signalCache.set(userId, signals);

        return signals;
      });

    return {
      extractSignals,
      refreshSignals,
      getSignals,
    };
  }),
);
