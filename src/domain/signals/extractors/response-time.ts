/**
 * Response Time Signal Extractor
 *
 * Analyzes response time patterns from message history.
 * Calculates average, median (p50), and 95th percentile response times.
 */

import type { MessageForSignals, ResponseTimeSignals } from "../types";

/**
 * Extract response time signals from message history
 *
 * Analyzes how quickly the user responds to incoming messages.
 * Measures time between partner's message and user's response.
 *
 * @param messages - Chronologically ordered messages
 * @returns Response time statistics
 */
export const extractResponseTimes = (messages: MessageForSignals[]): ResponseTimeSignals => {
  const responseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];

    // User responding to partner (fromMe=true after fromMe=false)
    if (current.fromMe && !previous.fromMe) {
      const diffMs = current.timestamp.getTime() - previous.timestamp.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // Filter outliers (responses > 24 hours are probably not immediate responses)
      if (diffMinutes <= 1440) {
        // 24 hours
        responseTimes.push(diffMinutes);
      }
    }
  }

  // Handle insufficient data
  if (responseTimes.length === 0) {
    return {
      avgResponseTimeMinutes: 0,
      responseTimeP50: 0,
      responseTimeP95: 0,
      sampleSize: 0,
    };
  }

  // Sort for percentile calculation
  responseTimes.sort((a, b) => a - b);

  // Calculate statistics
  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const p50Index = Math.floor(responseTimes.length * 0.5);
  const p95Index = Math.floor(responseTimes.length * 0.95);

  return {
    avgResponseTimeMinutes: avg,
    responseTimeP50: responseTimes[p50Index] || 0,
    responseTimeP95: responseTimes[p95Index] || 0,
    sampleSize: responseTimes.length,
  };
};
