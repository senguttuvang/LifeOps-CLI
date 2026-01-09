/**
 * Temporal Pattern Signal Extractor
 *
 * Analyzes temporal patterns in messaging behavior.
 * Tracks active hours (peak/low) and weekend vs weekday differences.
 */

import type { MessageForSignals, TemporalSignals } from "../types";

/**
 * Extract temporal pattern signals from message history
 *
 * Analyzes:
 * - Peak active hours (hour of day with most activity)
 * - Low active hours (hour of day with least activity)
 * - Weekend vs weekday messaging difference
 *
 * @param messages - Message history
 * @returns Temporal pattern statistics
 */
export const extractTemporalPatterns = (messages: MessageForSignals[]): TemporalSignals => {
  const userMessages = messages.filter((m) => m.fromMe);

  if (userMessages.length === 0) {
    return {
      activeHours: { peak: [], low: [] },
      weekendVsWeekdayDiff: 0,
    };
  }

  // Analyze hourly activity
  const hourlyActivity = new Array(24).fill(0);
  for (const m of userMessages) {
    const hour = m.timestamp.getHours();
    hourlyActivity[hour]++;
  }

  // Find peak hours (top 3 hours with most activity)
  const hourlyActivityWithIndex = hourlyActivity.map((count, hour) => ({ hour, count }));
  hourlyActivityWithIndex.sort((a, b) => b.count - a.count);

  const peakHours = hourlyActivityWithIndex.slice(0, 3).map((h) => h.hour);
  const lowHours = hourlyActivityWithIndex.slice(-3).map((h) => h.hour);

  // Analyze weekend vs weekday activity
  let weekdayCount = 0;
  let weekendCount = 0;

  for (const m of userMessages) {
    const day = m.timestamp.getDay(); // 0 = Sunday, 6 = Saturday

    if (day === 0 || day === 6) {
      weekendCount++;
    } else {
      weekdayCount++;
    }
  }

  // Calculate weekend vs weekday ratio
  // >1 means more active on weekends, <1 means more active on weekdays
  const weekdayDays = countWeekdaysInRange(messages);
  const weekendDays = countWeekendsInRange(messages);

  const avgWeekdayMessages = weekdayDays > 0 ? weekdayCount / weekdayDays : 0;
  const avgWeekendMessages = weekendDays > 0 ? weekendCount / weekendDays : 0;

  const weekendVsWeekdayDiff = avgWeekdayMessages > 0 ? avgWeekendMessages / avgWeekdayMessages : 1;

  return {
    activeHours: {
      peak: peakHours,
      low: lowHours,
    },
    weekendVsWeekdayDiff,
  };
};

/**
 * Count number of weekdays in the message date range
 */
const countWeekdaysInRange = (messages: MessageForSignals[]): number => {
  if (messages.length === 0) {return 0;}

  const firstDate = messages[0].timestamp;
  const lastDate = messages[messages.length - 1].timestamp;

  const diffMs = lastDate.getTime() - firstDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Rough estimate: 5 weekdays per 7 days
  return Math.ceil((diffDays * 5) / 7);
};

/**
 * Count number of weekend days in the message date range
 */
const countWeekendsInRange = (messages: MessageForSignals[]): number => {
  if (messages.length === 0) {return 0;}

  const firstDate = messages[0].timestamp;
  const lastDate = messages[messages.length - 1].timestamp;

  const diffMs = lastDate.getTime() - firstDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Rough estimate: 2 weekend days per 7 days
  return Math.ceil((diffDays * 2) / 7);
};
