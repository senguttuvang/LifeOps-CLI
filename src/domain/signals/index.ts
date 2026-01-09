/**
 * Signal Domain - Public API
 *
 * Exports all signal extraction, enforcement, and quality scoring functionality.
 * RAG+Signals personalization system for LifeOps.
 */

// Extractors
export {
  extractBehavioralPatterns,
  extractEmojiPatterns,
  extractMessageStructure,
  extractPhrasePatterns,
  extractPunctuationPatterns,
  extractResponseTimes,
  extractTemporalPatterns,
} from "./extractors";
// Prompt building
export { buildBasicPrompt, buildSignalEnhancedPrompt } from "./prompt-builder";
export type { DraftComparison, DraftQualityScore } from "./quality-scorer";
// Quality scoring
export { compareDrafts, scoreDraftQuality } from "./quality-scorer";
// Caching
export { signalCache } from "./signal-cache";

// Signal enforcement
export { enforceSignals, validateDraftAgainstSignals } from "./signal-enforcer";
export type { SignalExtractionService } from "./signal-extraction.service";
// Service
export { SignalExtractionLive, SignalExtractionServiceTag } from "./signal-extraction.service";
// Core types
export type {
  BehavioralSignals,
  EmojiSignals,
  MessageForSignals,
  MessageStructureSignals,
  PhraseSignals,
  PunctuationSignals,
  ResponseTimeSignals,
  TemporalSignals,
  UserSignals,
} from "./types";
