/**
 * Draft Quality Scorer
 *
 * Scores generated drafts against behavioral signals for quality assurance.
 * Used for monitoring, A/B testing, and debugging.
 *
 * Week 3 implementation (testing & optimization).
 */

import type { UserSignals } from "./types";

/**
 * Draft quality score with detailed breakdown
 */
export interface DraftQualityScore {
  /** Overall score (0-100) */
  overallScore: number;

  /** Individual dimension scores (0-1 each) */
  styleMatch: {
    lengthMatch: number;
    emojiMatch: number;
    phraseMatch: number;
    punctuationMatch: number;
    questionMatch: number;
  };

  /** List of specific issues found */
  deviations: string[];

  /** Quality tier: excellent, good, fair, poor */
  tier: "excellent" | "good" | "fair" | "poor";
}

/**
 * Score a draft's quality against user signals
 *
 * Evaluates how well the draft matches the user's behavioral patterns.
 * Higher score = better style matching.
 *
 * @param draft - Generated draft text
 * @param signals - User's behavioral signals
 * @returns Quality score with breakdown
 */
export const scoreDraftQuality = (draft: string, signals: UserSignals): DraftQualityScore => {
  const scores = {
    lengthMatch: scoreLengthMatch(draft, signals),
    emojiMatch: scoreEmojiMatch(draft, signals),
    phraseMatch: scorePhraseMatch(draft, signals),
    punctuationMatch: scorePunctuationMatch(draft, signals),
    questionMatch: scoreQuestionMatch(draft, signals),
  };

  // Weighted average (length and emojis are most important)
  const overallScore =
    scores.lengthMatch * 0.25 +
    scores.emojiMatch * 0.25 +
    scores.phraseMatch * 0.2 +
    scores.punctuationMatch * 0.15 +
    scores.questionMatch * 0.15;

  const overallScorePercent = Math.round(overallScore * 100);

  // Identify deviations
  const deviations: string[] = [];
  if (scores.lengthMatch < 0.8) {deviations.push("Length mismatch");}
  if (scores.emojiMatch < 0.8) {deviations.push("Emoji count/position off");}
  if (scores.phraseMatch < 0.5) {deviations.push("Missing common phrases");}
  if (scores.punctuationMatch < 0.7) {deviations.push("Punctuation style mismatch");}
  if (scores.questionMatch < 0.8) {deviations.push("Question pattern mismatch");}

  // Determine tier
  let tier: "excellent" | "good" | "fair" | "poor";
  if (overallScorePercent >= 90) {tier = "excellent";}
  else if (overallScorePercent >= 75) {tier = "good";}
  else if (overallScorePercent >= 60) {tier = "fair";}
  else {tier = "poor";}

  return {
    overallScore: overallScorePercent,
    styleMatch: scores,
    deviations,
    tier,
  };
};

/**
 * Score length match (0-1)
 */
const scoreLengthMatch = (draft: string, signals: UserSignals): number => {
  const draftLength = draft.length;
  const targetLength = signals.avgMessageLength;
  const tolerance = signals.messageLengthStd || targetLength * 0.2;

  const diff = Math.abs(draftLength - targetLength);

  if (diff === 0) {return 1.0;}
  if (diff <= tolerance) {return 1.0 - (diff / tolerance) * 0.2;} // 0.8-1.0
  if (diff <= tolerance * 2) {return 0.6 - ((diff - tolerance) / tolerance) * 0.3;} // 0.3-0.6
  return Math.max(0, 0.3 - ((diff - tolerance * 2) / tolerance) * 0.3); // 0-0.3
};

/**
 * Score emoji match (0-1)
 */
const scoreEmojiMatch = (draft: string, signals: UserSignals): number => {
  const draftEmojis = draft.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || [];
  const draftEmojiCount = draftEmojis.length;
  const targetEmojiCount = Math.round(signals.emojiPerMessage);

  // Count match score
  const countDiff = Math.abs(draftEmojiCount - targetEmojiCount);
  let countScore: number;
  if (countDiff === 0) {countScore = 1.0;}
  else if (countDiff === 1) {countScore = 0.7;}
  else if (countDiff === 2) {countScore = 0.4;}
  else {countScore = 0.1;}

  // Type match score (using top emojis)
  const topEmojiSet = new Set(signals.topEmojis.slice(0, 3).map((e) => e.emoji));
  const matchingEmojis = draftEmojis.filter((e) => topEmojiSet.has(e)).length;
  const typeScore = draftEmojiCount > 0 ? matchingEmojis / draftEmojiCount : 1.0;

  // Position match score (simplified)
  const positionScore = scoreEmojiPosition(draft, draftEmojis, signals.emojiPosition);

  // Weighted average
  return countScore * 0.5 + typeScore * 0.3 + positionScore * 0.2;
};

/**
 * Score emoji position match (0-1)
 */
const scoreEmojiPosition = (
  draft: string,
  emojis: string[],
  targetPosition: { start: number; middle: number; end: number },
): number => {
  if (emojis.length === 0) {return 1.0;}

  const firstEmojiPos = draft.indexOf(emojis[0]);
  const draftLength = draft.length;

  if (draftLength === 0) {return 0;}

  const relativePos = firstEmojiPos / draftLength;

  // Check which position this matches
  if (relativePos < 0.2 && targetPosition.start > 0.5) {return 1.0;}
  if (relativePos > 0.8 && targetPosition.end > 0.5) {return 1.0;}
  if (relativePos >= 0.3 && relativePos <= 0.7 && targetPosition.middle > 0.4) {return 1.0;}

  // Partial match
  return 0.5;
};

/**
 * Score phrase match (0-1)
 */
const scorePhraseMatch = (draft: string, signals: UserSignals): number => {
  if (signals.commonPhrases.length === 0) {return 1.0;}

  const draftLower = draft.toLowerCase();
  let matchCount = 0;

  // Check top 5 common phrases
  const topPhrases = signals.commonPhrases.slice(0, 5);
  for (const { phrase } of topPhrases) {
    if (draftLower.includes(phrase.toLowerCase())) {
      matchCount++;
    }
  }

  // Score based on matches
  if (matchCount === 0) {return 0.3;} // No matches, but not completely wrong
  if (matchCount === 1) {return 0.7;}
  if (matchCount >= 2) {return 1.0;}

  return 0.5;
};

/**
 * Score punctuation match (0-1)
 */
const scorePunctuationMatch = (draft: string, signals: UserSignals): number => {
  let score = 0;
  let checks = 0;

  // Exclamation marks
  const hasExclamation = draft.includes("!");
  const shouldHaveExclamation = signals.exclamationRate > 0.3;
  if (hasExclamation === shouldHaveExclamation) {score++;}
  checks++;

  // Question marks
  const hasQuestion = draft.includes("?");
  const shouldHaveQuestion = signals.questionRate > 0.5;
  if (hasQuestion === shouldHaveQuestion) {score++;}
  checks++;

  // Ellipsis
  const hasEllipsis = draft.includes("...") || draft.includes("…");
  const shouldHaveEllipsis = signals.ellipsisRate > 0.2;
  if (hasEllipsis === shouldHaveEllipsis) {score++;}
  checks++;

  // Period usage
  const periodCount = (draft.match(/\./g) || []).length;
  const expectedPeriodCount = signals.periodRate > 0.5 ? 1 : 0;
  if (periodCount >= expectedPeriodCount) {score++;}
  checks++;

  return score / checks;
};

/**
 * Score question pattern match (0-1)
 */
const scoreQuestionMatch = (draft: string, signals: UserSignals): number => {
  const hasQuestion = draft.includes("?");
  const shouldHaveQuestion = signals.asksFollowupQuestions > 0.6;

  if (hasQuestion === shouldHaveQuestion) {return 1.0;}
  if (signals.asksFollowupQuestions > 0.3 && signals.asksFollowupQuestions <= 0.6) {return 0.7;} // Optional, so not critical
  return 0.3;
};

/**
 * Compare two drafts (for A/B testing)
 *
 * @param draftA - First draft (e.g., basic RAG)
 * @param draftB - Second draft (e.g., signal-enhanced RAG)
 * @param signals - User signals
 * @returns Comparison result
 */
export interface DraftComparison {
  draftA: {
    text: string;
    score: DraftQualityScore;
  };
  draftB: {
    text: string;
    score: DraftQualityScore;
  };
  winner: "A" | "B" | "tie";
  improvement: number; // Percentage points
}

export const compareDrafts = (draftA: string, draftB: string, signals: UserSignals): DraftComparison => {
  const scoreA = scoreDraftQuality(draftA, signals);
  const scoreB = scoreDraftQuality(draftB, signals);

  const improvement = scoreB.overallScore - scoreA.overallScore;

  let winner: "A" | "B" | "tie";
  if (Math.abs(improvement) < 5) {winner = "tie";}
  else if (improvement > 0) {winner = "B";}
  else {winner = "A";}

  return {
    draftA: { text: draftA, score: scoreA },
    draftB: { text: draftB, score: scoreB },
    winner,
    improvement,
  };
};
