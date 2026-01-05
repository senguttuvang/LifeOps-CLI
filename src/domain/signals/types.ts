/**
 * Signal Extraction Domain Types
 *
 * Type definitions for behavioral signal extraction and enforcement.
 * Used for RAG+Signals personalization system.
 */

/**
 * User behavioral signals extracted from message history
 *
 * These signals represent quantified communication patterns used to
 * enforce style consistency in AI-generated drafts.
 */
export interface UserSignals {
  userId: string;

  // Response patterns
  avgResponseTimeMinutes: number;
  responseTimeP50: number;
  responseTimeP95: number;
  initiationRate: number;

  // Message structure
  avgMessageLength: number;
  messageLengthStd: number;
  medianMessageLength: number;
  avgWordsPerMessage: number;

  // Expression style
  emojiPerMessage: number;
  emojiVariance: number;
  topEmojis: Array<{ emoji: string; frequency: number }>;
  emojiPosition: { start: number; middle: number; end: number };

  // Punctuation
  exclamationRate: number;
  questionRate: number;
  periodRate: number;
  ellipsisRate: number;

  // Common patterns
  commonGreetings: string[];
  commonEndings: string[];
  commonPhrases: Array<{ phrase: string; frequency: number }>;
  fillerWords: string[];

  // Behavioral
  asksFollowupQuestions: number;
  usesVoiceNotes: number;
  sendsMultipleMessages: number;
  editsMessages: number;

  // Temporal
  activeHours: { peak: number[]; low: number[] };
  weekendVsWeekdayDiff: number;

  // Metadata
  messageCount: number;
  confidence: number;
  lastComputedAt: Date;
}

/**
 * Message data for signal extraction
 *
 * Simplified message representation containing only fields needed
 * for behavioral analysis.
 */
export interface MessageForSignals {
  id: string;
  text: string | null;
  fromMe: boolean;
  timestamp: Date;
  mediaType?: string;
  isEdited?: boolean;
}

/**
 * Response time analysis results
 */
export interface ResponseTimeSignals {
  avgResponseTimeMinutes: number;
  responseTimeP50: number;
  responseTimeP95: number;
  sampleSize: number;
}

/**
 * Emoji usage analysis results
 */
export interface EmojiSignals {
  emojiPerMessage: number;
  emojiVariance: number;
  topEmojis: Array<{ emoji: string; frequency: number }>;
  emojiPosition: { start: number; middle: number; end: number };
}

/**
 * Message structure analysis results
 */
export interface MessageStructureSignals {
  avgMessageLength: number;
  messageLengthStd: number;
  medianMessageLength: number;
  avgWordsPerMessage: number;
}

/**
 * Phrase pattern analysis results
 */
export interface PhraseSignals {
  commonGreetings: string[];
  commonEndings: string[];
  commonPhrases: Array<{ phrase: string; frequency: number }>;
  fillerWords: string[];
}

/**
 * Punctuation pattern analysis results
 */
export interface PunctuationSignals {
  exclamationRate: number;
  questionRate: number;
  periodRate: number;
  ellipsisRate: number;
}

/**
 * Behavioral pattern analysis results
 */
export interface BehavioralSignals {
  asksFollowupQuestions: number;
  usesVoiceNotes: number;
  sendsMultipleMessages: number;
  editsMessages: number;
  initiationRate: number;
}

/**
 * Temporal pattern analysis results
 */
export interface TemporalSignals {
  activeHours: { peak: number[]; low: number[] };
  weekendVsWeekdayDiff: number;
}
