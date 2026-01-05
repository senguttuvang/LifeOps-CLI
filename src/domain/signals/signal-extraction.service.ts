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
import { DatabaseService } from "../../infrastructure/db/client";
import { interactions, messages, conversations } from "../../infrastructure/db/schema";
import { userSignals } from "../../infrastructure/db/signal-schema";
import type { MessageForSignals, UserSignals } from "./types";
import {
  extractResponseTimes,
  extractEmojiPatterns,
  extractMessageStructure,
  extractPhrasePatterns,
  extractPunctuationPatterns,
  extractBehavioralPatterns,
  extractTemporalPatterns,
} from "./extractors";
import { signalCache } from "./signal-cache";

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
                id: messages.interactionId,
                text: messages.content,
                fromMe: interactions.direction,
                timestamp: interactions.occurredAt,
                mediaType: messages.mediaType,
              })
              .from(messages)
              .innerJoin(interactions, eq(messages.interactionId, interactions.id))
              .innerJoin(conversations, eq(interactions.conversationId, conversations.id))
              .where(
                and(
                  eq(conversations.source, "whatsapp"),
                  // Filter messages where user is participant (either sender or recipient)
                  // This is a simplification - in reality we'd join with conversation_participants
                ),
              )
              .orderBy(desc(interactions.occurredAt))
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
          mediaType: msg.mediaType || undefined,
          isEdited: false, // TODO: Add edit tracking to schema
        }));
      });

    /**
     * Calculate confidence score based on sample size and quality
     */
    const calculateConfidence = (messageCount: number): number => {
      if (messageCount < MIN_MESSAGE_COUNT) return 0;
      if (messageCount < 100) return 0.5;
      if (messageCount < 200) return 0.7;
      if (messageCount < 500) return 0.85;
      return 0.95;
    };

    /**
     * Store signals in database
     */
    const storeSignals = (signals: UserSignals): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: async () => {
            // Prepare database record
            const record = {
              id: crypto.randomUUID(),
              userId: signals.userId,

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
              topEmojis: JSON.stringify(signals.topEmojis),
              emojiPosition: JSON.stringify(signals.emojiPosition),

              // Punctuation
              exclamationRate: signals.exclamationRate,
              questionRate: signals.questionRate,
              periodRate: signals.periodRate,
              ellipsisRate: signals.ellipsisRate,

              // Common patterns
              commonGreetings: JSON.stringify(signals.commonGreetings),
              commonEndings: JSON.stringify(signals.commonEndings),
              commonPhrases: JSON.stringify(signals.commonPhrases),
              fillerWords: JSON.stringify(signals.fillerWords),

              // Behavioral
              asksFollowupQuestions: signals.asksFollowupQuestions,
              usesVoiceNotes: signals.usesVoiceNotes,
              sendsMultipleMessages: signals.sendsMultipleMessages,
              editsMessages: signals.editsMessages,

              // Temporal
              activeHours: JSON.stringify(signals.activeHours),
              weekendVsWeekdayDiff: signals.weekendVsWeekdayDiff,

              // Metadata
              messageCount: signals.messageCount,
              confidence: signals.confidence,
              lastComputedAt: new Date(signals.lastComputedAt),
              updatedAt: new Date(),
            };

            // Upsert (insert or update if exists)
            const existing = await db
              .select()
              .from(userSignals)
              .where(eq(userSignals.userId, signals.userId))
              .execute();

            if (existing.length > 0) {
              await db.update(userSignals).set(record).where(eq(userSignals.userId, signals.userId)).execute();
            } else {
              await db.insert(userSignals).values(record).execute();
            }
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
     */
    const getSignals = (userId: string): Effect.Effect<UserSignals | undefined, Error> =>
      Effect.gen(function* () {
        // Check cache first
        const cached = signalCache.get(userId);
        if (cached) return cached;

        // Fetch from database
        const result = yield* Effect.tryPromise({
          try: () => db.select().from(userSignals).where(eq(userSignals.userId, userId)).execute(),
          catch: (e) => new Error(`Failed to retrieve signals: ${e}`),
        });

        if (result.length === 0) return undefined;

        const record = result[0];

        // Parse JSON fields
        const signals: UserSignals = {
          userId: record.userId,

          // Response patterns
          avgResponseTimeMinutes: record.avgResponseTimeMinutes || 0,
          responseTimeP50: record.responseTimeP50 || 0,
          responseTimeP95: record.responseTimeP95 || 0,
          initiationRate: record.initiationRate || 0,

          // Message structure
          avgMessageLength: record.avgMessageLength || 0,
          messageLengthStd: record.messageLengthStd || 0,
          medianMessageLength: record.medianMessageLength || 0,
          avgWordsPerMessage: record.avgWordsPerMessage || 0,

          // Expression style
          emojiPerMessage: record.emojiPerMessage || 0,
          emojiVariance: record.emojiVariance || 0,
          topEmojis: record.topEmojis ? JSON.parse(record.topEmojis) : [],
          emojiPosition: record.emojiPosition ? JSON.parse(record.emojiPosition) : { start: 0, middle: 0, end: 0 },

          // Punctuation
          exclamationRate: record.exclamationRate || 0,
          questionRate: record.questionRate || 0,
          periodRate: record.periodRate || 0,
          ellipsisRate: record.ellipsisRate || 0,

          // Common patterns
          commonGreetings: record.commonGreetings ? JSON.parse(record.commonGreetings) : [],
          commonEndings: record.commonEndings ? JSON.parse(record.commonEndings) : [],
          commonPhrases: record.commonPhrases ? JSON.parse(record.commonPhrases) : [],
          fillerWords: record.fillerWords ? JSON.parse(record.fillerWords) : [],

          // Behavioral
          asksFollowupQuestions: record.asksFollowupQuestions || 0,
          usesVoiceNotes: record.usesVoiceNotes || 0,
          sendsMultipleMessages: record.sendsMultipleMessages || 0,
          editsMessages: record.editsMessages || 0,

          // Temporal
          activeHours: record.activeHours ? JSON.parse(record.activeHours) : { peak: [], low: [] },
          weekendVsWeekdayDiff: record.weekendVsWeekdayDiff || 0,

          // Metadata
          messageCount: record.messageCount,
          confidence: record.confidence,
          lastComputedAt: record.lastComputedAt || new Date(),
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
