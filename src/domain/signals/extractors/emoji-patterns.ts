/**
 * Emoji Pattern Signal Extractor
 *
 * Analyzes emoji usage patterns from message history.
 * Tracks frequency, top emojis, position preferences, and variance.
 */

import type { EmojiSignals, MessageForSignals } from "../types";

/**
 * Extract emoji pattern signals from message history
 *
 * Analyzes:
 * - Average emojis per message
 * - Emoji usage variance
 * - Top 10 most-used emojis with frequencies
 * - Position preferences (start, middle, end)
 *
 * @param messages - Message history
 * @returns Emoji usage statistics
 */
export const extractEmojiPatterns = (messages: MessageForSignals[]): EmojiSignals => {
  const userMessages = messages.filter((m) => m.fromMe && m.text);

  if (userMessages.length === 0) {
    return {
      emojiPerMessage: 0,
      emojiVariance: 0,
      topEmojis: [],
      emojiPosition: { start: 0, middle: 0, end: 0 },
    };
  }

  // Count emojis per message
  const emojiCounts = userMessages.map((m) => {
    const text = m.text || "";
    const emojis = text.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || [];
    return emojis.length;
  });

  // Calculate average and variance
  const avgEmojis = emojiCounts.reduce((a, b) => a + b, 0) / emojiCounts.length;
  const variance = calculateVariance(emojiCounts, avgEmojis);

  // Find top emojis
  const emojiFreq = new Map<string, number>();
  for (const m of userMessages) {
    const text = m.text || "";
    const emojis = text.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || [];
    for (const emoji of emojis) {
      emojiFreq.set(emoji, (emojiFreq.get(emoji) || 0) + 1);
    }
  }

  const topEmojis = [...emojiFreq.entries()]
    .map(([emoji, count]) => ({
      emoji,
      frequency: count / userMessages.length,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Analyze emoji position (start, middle, end)
  const positions = { start: 0, middle: 0, end: 0 };
  for (const m of userMessages) {
    const text = m.text || "";
    const emojis = text.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu);
    if (!emojis || emojis.length === 0) {
      continue;
    }

    const firstEmojiPos = text.indexOf(emojis[0]);
    const textLength = text.length;

    if (textLength === 0) {
      continue;
    }

    // Categorize position
    const relativePos = firstEmojiPos / textLength;
    if (relativePos < 0.2) {
      positions.start++;
    } else if (relativePos > 0.8) {
      positions.end++;
    } else {
      positions.middle++;
    }
  }

  const totalWithEmojis = positions.start + positions.middle + positions.end;
  const emojiPosition =
    totalWithEmojis > 0
      ? {
          start: positions.start / totalWithEmojis,
          middle: positions.middle / totalWithEmojis,
          end: positions.end / totalWithEmojis,
        }
      : { start: 0, middle: 0, end: 0 };

  return {
    emojiPerMessage: avgEmojis,
    emojiVariance: variance,
    topEmojis,
    emojiPosition,
  };
};

/**
 * Calculate variance for a dataset
 */
const calculateVariance = (values: number[], mean: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
};
