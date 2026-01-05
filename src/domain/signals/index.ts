/**
 * Signal Domain - Public API
 *
 * Exports all signal extraction, enforcement, and quality scoring functionality.
 * RAG+Signals personalization system for LifeOps.
 */

// Core types
export type {
  UserSignals,
  MessageForSignals,
  ResponseTimeSignals,
  EmojiSignals,
  MessageStructureSignals,
  PhraseSignals,
  PunctuationSignals,
  BehavioralSignals,
  TemporalSignals,
} from "./types";

// Service
export { SignalExtractionServiceTag, SignalExtractionLive } from "./signal-extraction.service";
export type { SignalExtractionService } from "./signal-extraction.service";

// Extractors
export {
  extractResponseTimes,
  extractEmojiPatterns,
  extractMessageStructure,
  extractPhrasePatterns,
  extractPunctuationPatterns,
  extractBehavioralPatterns,
  extractTemporalPatterns,
} from "./extractors";

// Prompt building
export { buildSignalEnhancedPrompt, buildBasicPrompt } from "./prompt-builder";

// Signal enforcement
export { enforceSignals, validateDraftAgainstSignals } from "./signal-enforcer";

// Quality scoring
export { scoreDraftQuality, compareDrafts } from "./quality-scorer";
export type { DraftQualityScore, DraftComparison } from "./quality-scorer";

// Caching
export { signalCache } from "./signal-cache";
