/**
 * Message Structure Signal Extractor
 *
 * Analyzes message length and word count patterns.
 * Tracks average, median, standard deviation for message lengths.
 */

import type { MessageForSignals, MessageStructureSignals } from "../types";

/**
 * Extract message structure signals from message history
 *
 * Analyzes:
 * - Average message length (characters)
 * - Standard deviation of message length
 * - Median message length
 * - Average words per message
 *
 * @param messages - Message history
 * @returns Message structure statistics
 */
export const extractMessageStructure = (messages: MessageForSignals[]): MessageStructureSignals => {
  const userMessages = messages.filter((m) => m.fromMe && m.text);

  if (userMessages.length === 0) {
    return {
      avgMessageLength: 0,
      messageLengthStd: 0,
      medianMessageLength: 0,
      avgWordsPerMessage: 0,
    };
  }

  // Extract message lengths and word counts
  const lengths = userMessages.map((m) => (m.text || "").length);
  const wordCounts = userMessages.map((m) => {
    const text = m.text || "";
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return words.length;
  });

  // Calculate average length
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Calculate standard deviation
  const squaredDiffs = lengths.map((len) => (len - avgLength) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // Calculate median length
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedLengths.length / 2);
  const median = sortedLengths[medianIndex] || 0;

  // Calculate average words per message
  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;

  return {
    avgMessageLength: avgLength,
    messageLengthStd: stdDev,
    medianMessageLength: median,
    avgWordsPerMessage: avgWords,
  };
};
