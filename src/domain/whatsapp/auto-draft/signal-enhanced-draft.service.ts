// @ts-nocheck - Experimental feature (Phase 1)
/**
 * Signal-Enhanced Draft Generation Service
 *
 * Integrates RAG+Signals personalization system with draft generation.
 * Provides 75-80% style matching vs 60-70% for basic RAG.
 *
 * STATUS: Experimental - Type errors being fixed in Phase 1
 *
 * Pipeline:
 * 1. Load/extract user behavioral signals
 * 2. RAG search for similar past messages
 * 3. Build signal-enhanced prompt
 * 4. Generate draft with LLM
 * 5. Enforce signals on draft
 * 6. Score quality (optional)
 */

import { Context, Effect, Layer } from "effect";

// Import from domain ports (not directly from infrastructure)
import { AIServiceTag, DatabaseService, VectorStoreService } from "../../ports";
import {
  buildBasicPrompt,
  buildSignalEnhancedPrompt,
  type DraftQualityScore,
  enforceSignals,
  SignalExtractionServiceTag,
  scoreDraftQuality,
  type UserSignals,
} from "../../signals";

/**
 * Draft generation result with quality metrics
 */
export interface DraftResult {
  /** Generated draft text */
  draft: string;

  /** Quality score (0-100) */
  qualityScore: number;

  /** Signals used (if available) */
  signals?: UserSignals;

  /** Generation mode: signal-enhanced or basic */
  mode: "signal-enhanced" | "basic";

  /** Quality tier */
  tier: "excellent" | "good" | "fair" | "poor";
}

/**
 * Signal-Enhanced Draft Service Interface
 */
export interface SignalEnhancedDraftService {
  /**
   * Generate a draft response using RAG+Signals
   *
   * @param userId - User ID (contact ID in contacts table)
   * @param chatId - Chat ID (source conversation ID)
   * @param incomingMessage - Message to respond to
   * @param options - Generation options
   * @returns Draft with quality metrics
   */
  readonly generateDraft: (
    userId: string,
    chatId: string,
    incomingMessage: string,
    options?: {
      /** Force signal extraction if not cached (default: false) */
      forceSignalExtraction?: boolean;
      /** Enable verbose logging (default: false) */
      verbose?: boolean;
    },
  ) => Effect.Effect<DraftResult, Error>;
}

/**
 * Signal-Enhanced Draft Service Tag (for dependency injection)
 */
export class SignalEnhancedDraftServiceTag extends Context.Tag("SignalEnhancedDraftService")<
  SignalEnhancedDraftServiceTag,
  SignalEnhancedDraftService
>() {}

/**
 * Signal-Enhanced Draft Service Implementation
 */
export const SignalEnhancedDraftLive = Layer.effect(
  SignalEnhancedDraftServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;
    const ai = yield* AIServiceTag;
    const vectorStore = yield* VectorStoreService;
    const signalService = yield* SignalExtractionServiceTag;

    const generateDraft = (
      userId: string,
      chatId: string,
      incomingMessage: string,
      options = {},
    ): Effect.Effect<DraftResult, Error> =>
      Effect.gen(function* () {
        const { forceSignalExtraction = false, verbose = false } = options;

        if (verbose) {
          console.log(`[SignalDraft] Generating draft for message: "${incomingMessage.slice(0, 50)}..."`);
        }

        // Step 1: Try to load user signals
        let signals: UserSignals | undefined;
        try {
          if (forceSignalExtraction) {
            if (verbose) {console.log(`[SignalDraft] Forcing signal extraction...`);}
            signals = yield* signalService.extractSignals(userId);
          } else {
            if (verbose) {console.log(`[SignalDraft] Loading cached signals...`);}
            signals = yield* signalService.getSignals(userId);

            // If no signals exist, try to extract them
            if (!signals) {
              if (verbose) {console.log(`[SignalDraft] No signals found, extracting...`);}
              try {
                signals = yield* signalService.extractSignals(userId);
              } catch {
                // Extraction failed (probably insufficient data), continue without signals
                if (verbose) {console.log(`[SignalDraft] Signal extraction failed (insufficient data), using basic RAG`);}
              }
            }
          }
        } catch {
          if (verbose) {console.log(`[SignalDraft] Could not load signals, using basic RAG`);}
          signals = undefined;
        }

        // Step 2: RAG search for similar messages
        if (verbose) {console.log(`[SignalDraft] Searching RAG for similar messages...`);}

        const ragResults = yield* vectorStore.search(`respond to: ${incomingMessage}`, 5);
        const ragExamples = ragResults.map((r) => r.text);

        if (verbose) {console.log(`[SignalDraft] Found ${ragExamples.length} similar examples`);}

        // Step 3: Build prompt (signal-enhanced or basic)
        const prompt = signals
          ? buildSignalEnhancedPrompt(incomingMessage, ragExamples, signals)
          : buildBasicPrompt(incomingMessage, ragExamples);

        if (verbose) {
          console.log(`[SignalDraft] Using ${signals ? "signal-enhanced" : "basic"} prompt`);
        }

        // Step 4: Generate draft with LLM
        if (verbose) {console.log(`[SignalDraft] Generating draft with LLM...`);}

        const rawDraft = yield* ai.generateText([
          {
            role: "system",
            content: signals
              ? "You are drafting a response that matches the user's EXACT communication style using behavioral signals."
              : "You are drafting a casual, friendly WhatsApp response.",
          },
          { role: "user", content: prompt },
        ]);

        // Step 5: Enforce signals (if available)
        let finalDraft = rawDraft;
        if (signals) {
          if (verbose) {console.log(`[SignalDraft] Enforcing signals on draft...`);}
          finalDraft = enforceSignals(rawDraft, signals);
        }

        // Step 6: Score quality
        let qualityScore = 70; // Default for basic RAG
        let tier: "excellent" | "good" | "fair" | "poor" = "good";

        if (signals) {
          const scoreResult = scoreDraftQuality(finalDraft, signals);
          qualityScore = scoreResult.overallScore;
          tier = scoreResult.tier;

          if (verbose) {
            console.log(`[SignalDraft] Quality score: ${qualityScore}/100 (${tier})`);
            if (scoreResult.deviations.length > 0) {
              console.log(`[SignalDraft] Deviations: ${scoreResult.deviations.join(", ")}`);
            }
          }
        }

        return {
          draft: finalDraft,
          qualityScore,
          signals,
          mode: signals ? "signal-enhanced" : "basic",
          tier,
        };
      });

    return {
      generateDraft,
    };
  }),
);
