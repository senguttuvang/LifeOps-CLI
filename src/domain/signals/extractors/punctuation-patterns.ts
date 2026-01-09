/**
 * Punctuation Pattern Signal Extractor
 *
 * Analyzes punctuation usage patterns in messages.
 * Tracks exclamation marks, question marks, periods, and ellipsis usage.
 */

import type { MessageForSignals, PunctuationSignals } from "../types";

/**
 * Extract punctuation pattern signals from message history
 *
 * Analyzes:
 * - Exclamation mark usage rate
 * - Question mark usage rate
 * - Period usage rate
 * - Ellipsis usage rate
 *
 * All rates are 0-1 (percentage of messages containing the punctuation)
 *
 * @param messages - Message history
 * @returns Punctuation usage statistics
 */
export const extractPunctuationPatterns = (messages: MessageForSignals[]): PunctuationSignals => {
  const userMessages = messages.filter((m) => m.fromMe && m.text);

  if (userMessages.length === 0) {
    return {
      exclamationRate: 0,
      questionRate: 0,
      periodRate: 0,
      ellipsisRate: 0,
    };
  }

  let exclamationCount = 0;
  let questionCount = 0;
  let periodCount = 0;
  let ellipsisCount = 0;

  for (const m of userMessages) {
    const text = m.text || "";

    if (text.includes("!")) {exclamationCount++;}
    if (text.includes("?")) {questionCount++;}
    if (text.includes(".") && !text.includes("...")) {periodCount++;} // Period but not ellipsis
    if (text.includes("...") || text.includes("…")) {ellipsisCount++;} // Ellipsis (3 dots or unicode)
  }

  const total = userMessages.length;

  return {
    exclamationRate: exclamationCount / total,
    questionRate: questionCount / total,
    periodRate: periodCount / total,
    ellipsisRate: ellipsisCount / total,
  };
};
