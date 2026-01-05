/**
 * Phrase Pattern Signal Extractor
 *
 * Extracts common phrases, greetings, endings, and filler words
 * using N-gram analysis and pattern matching.
 */

import type { MessageForSignals, PhraseSignals } from "../types";

/**
 * Common stop phrases to ignore (not meaningful patterns)
 */
const STOP_PHRASES = new Set([
  "i am",
  "you are",
  "to the",
  "in the",
  "of the",
  "and the",
  "is a",
  "it is",
  "that is",
  "this is",
  "for the",
  "on the",
  "at the",
  "from the",
]);

/**
 * Common filler words in Indian English
 */
const COMMON_FILLERS = [
  "like",
  "just",
  "basically",
  "actually",
  "literally",
  "seriously",
  "totally",
  "really",
  "kinda",
  "sorta",
  "yaar", // Hinglish
  "na", // Hinglish
  "naa", // Hinglish
  "re", // Hinglish
];

/**
 * Extract phrase pattern signals from message history
 *
 * Analyzes:
 * - Common greetings (message starters)
 * - Common endings (message closers)
 * - Common 2-3 word phrases (n-grams)
 * - Filler words usage
 *
 * @param messages - Message history
 * @returns Phrase pattern statistics
 */
export const extractPhrasePatterns = (messages: MessageForSignals[]): PhraseSignals => {
  const userMessages = messages.filter((m) => m.fromMe && m.text);

  if (userMessages.length === 0) {
    return {
      commonGreetings: [],
      commonEndings: [],
      commonPhrases: [],
      fillerWords: [],
    };
  }

  // Extract greetings (first 3 words of messages)
  const greetings = extractGreetings(userMessages);

  // Extract endings (last 3 words of messages)
  const endings = extractEndings(userMessages);

  // Extract common phrases (n-grams)
  const phrases = extractCommonNGrams(userMessages);

  // Extract filler words
  const fillers = extractFillerWords(userMessages);

  return {
    commonGreetings: greetings,
    commonEndings: endings,
    commonPhrases: phrases,
    fillerWords: fillers,
  };
};

/**
 * Extract common greetings from message starters
 */
const extractGreetings = (messages: MessageForSignals[]): string[] => {
  const greetingFreq = new Map<string, number>();

  messages.forEach((m) => {
    const text = (m.text || "").toLowerCase().trim();
    const words = text.split(/\s+/);

    // Take first 1-3 words as potential greeting
    for (let len = 1; len <= 3 && len <= words.length; len++) {
      const greeting = words.slice(0, len).join(" ");

      // Filter out very short or common words
      if (greeting.length > 2 && !isStopPhrase(greeting)) {
        greetingFreq.set(greeting, (greetingFreq.get(greeting) || 0) + 1);
      }
    }
  });

  // Return greetings used in >10% of messages
  const threshold = messages.length * 0.1;
  return Array.from(greetingFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([greeting, _]) => greeting);
};

/**
 * Extract common endings from message closers
 */
const extractEndings = (messages: MessageForSignals[]): string[] => {
  const endingFreq = new Map<string, number>();

  messages.forEach((m) => {
    const text = (m.text || "").toLowerCase().trim();

    // Remove emojis for ending analysis
    const textWithoutEmojis = text.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, "").trim();

    const words = textWithoutEmojis.split(/\s+/);

    // Take last 1-3 words as potential ending
    for (let len = 1; len <= 3 && len <= words.length; len++) {
      const ending = words.slice(-len).join(" ");

      if (ending.length > 2 && !isStopPhrase(ending)) {
        endingFreq.set(ending, (endingFreq.get(ending) || 0) + 1);
      }
    }

    // Also capture emoji-only endings
    const emojiMatch = (m.text || "").match(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]+$/gu);
    if (emojiMatch) {
      const emojiEnding = emojiMatch[0];
      endingFreq.set(emojiEnding, (endingFreq.get(emojiEnding) || 0) + 1);
    }
  });

  // Return endings used in >10% of messages
  const threshold = messages.length * 0.1;
  return Array.from(endingFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ending, _]) => ending);
};

/**
 * Extract common n-grams (2-3 word phrases)
 */
const extractCommonNGrams = (messages: MessageForSignals[]): Array<{ phrase: string; frequency: number }> => {
  const phraseFreq = new Map<string, number>();

  messages.forEach((m) => {
    const text = (m.text || "").toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    // Extract 2-grams and 3-grams
    for (const nGramSize of [2, 3]) {
      for (let i = 0; i <= words.length - nGramSize; i++) {
        const phrase = words.slice(i, i + nGramSize).join(" ");

        // Filter stop phrases and very short phrases
        if (!isStopPhrase(phrase) && phrase.length > 4) {
          phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
        }
      }
    }
  });

  // Return phrases appearing in >5% of messages
  const threshold = messages.length * 0.05;

  return Array.from(phraseFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([phrase, count]) => ({
      phrase,
      frequency: count / messages.length,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
};

/**
 * Extract filler words usage
 */
const extractFillerWords = (messages: MessageForSignals[]): string[] => {
  const fillerFreq = new Map<string, number>();

  messages.forEach((m) => {
    const text = (m.text || "").toLowerCase();
    const words = text.split(/\s+/);

    words.forEach((word) => {
      // Remove punctuation
      const cleanWord = word.replace(/[^\p{L}]/gu, "");

      if (COMMON_FILLERS.includes(cleanWord)) {
        fillerFreq.set(cleanWord, (fillerFreq.get(cleanWord) || 0) + 1);
      }
    });
  });

  // Return fillers used in >5% of messages
  const threshold = messages.length * 0.05;
  return Array.from(fillerFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([filler, _]) => filler);
};

/**
 * Check if a phrase is a stop phrase (not meaningful)
 */
const isStopPhrase = (phrase: string): boolean => {
  return STOP_PHRASES.has(phrase) || phrase.length < 3;
};
