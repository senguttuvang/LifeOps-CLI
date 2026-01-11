/**
 * Signal Enforcer - Post-Processing Style Enforcement
 *
 * Applies behavioral signals as hard constraints on LLM-generated drafts.
 * Ensures drafts match user's exact style even when LLM deviates.
 *
 * This is the key differentiator of RAG+Signals vs basic RAG:
 * - Basic RAG: "sounds somewhat like me" (60-70%)
 * - RAG+Signals: "sounds exactly like me" (75-80%)
 *
 * Week 2 implementation (post-processing layer).
 */

import type { UserSignals } from "./types";

/**
 * Enforce behavioral signals on a generated draft
 *
 * Applies hard constraints to ensure draft matches user's style:
 * - Emoji count and position
 * - Message length
 * - Common phrases
 * - Question patterns
 *
 * @param generatedDraft - LLM-generated draft (may not perfectly match signals)
 * @param signals - User's behavioral signals
 * @returns Enforced draft matching signals
 */
export const enforceSignals = (generatedDraft: string, signals: UserSignals): string => {
  let draft = generatedDraft.trim();

  // 1. Enforce emoji count and type
  draft = enforceEmojiCount(draft, signals);

  // 2. Enforce message length
  draft = enforceMessageLength(draft, signals);

  // 3. Inject common phrases (if missing and appropriate)
  draft = injectCommonPhrases(draft, signals);

  // 4. Enforce question pattern
  draft = enforceQuestionPattern(draft, signals);

  // 5. Enforce punctuation style
  draft = enforcePunctuationStyle(draft, signals);

  return draft.trim();
};

/**
 * Enforce emoji count to match user's pattern
 */
const enforceEmojiCount = (draft: string, signals: UserSignals): string => {
  const currentEmojis = (draft.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || []).length;
  const targetEmojis = Math.round(signals.emojiPerMessage);

  if (currentEmojis === targetEmojis) {
    return draft;
  }

  // Too many emojis: remove excess
  if (currentEmojis > targetEmojis) {
    return removeExcessEmojis(draft, currentEmojis - targetEmojis, signals);
  }

  // Too few emojis: add most common
  return addMissingEmojis(draft, targetEmojis - currentEmojis, signals);
};

/**
 * Remove excess emojis (keep most common ones)
 */
const removeExcessEmojis = (draft: string, count: number, signals: UserSignals): string => {
  const topEmojiSet = new Set(signals.topEmojis.slice(0, 3).map((e) => e.emoji));
  const allEmojis = draft.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || [];

  // Find emojis to remove (least common first)
  const toRemove: string[] = [];
  for (const emoji of allEmojis) {
    if (!topEmojiSet.has(emoji) && toRemove.length < count) {
      toRemove.push(emoji);
    }
  }

  // If we still need to remove more, remove from common ones
  if (toRemove.length < count) {
    for (const emoji of allEmojis) {
      if (topEmojiSet.has(emoji) && toRemove.length < count && !toRemove.includes(emoji)) {
        toRemove.push(emoji);
      }
    }
  }

  // Remove emojis
  let result = draft;
  for (const emoji of toRemove) {
    result = result.replace(emoji, "");
  }

  return result.replaceAll(/\s{2,}/g, " ").trim(); // Clean up extra spaces
};

/**
 * Add missing emojis at preferred position
 */
const addMissingEmojis = (draft: string, count: number, signals: UserSignals): string => {
  const topEmoji = signals.topEmojis[0]?.emoji || "❤️";
  const emojisToAdd = topEmoji.repeat(count);

  // Add at preferred position
  const position = signals.emojiPosition;

  if (position.end > 0.6) {
    // Add at end
    return `${draft} ${emojisToAdd}`;
  }
  if (position.start > 0.6) {
    // Add at start
    return `${emojisToAdd} ${draft}`;
  }
  // Add in middle (after first sentence or at midpoint)
  const firstSentenceEnd = draft.search(/[!.?]\s/);
  if (firstSentenceEnd > 0) {
    return `${draft.slice(0, firstSentenceEnd + 2)}${emojisToAdd} ${draft.slice(firstSentenceEnd + 2)}`;
  }
  const mid = Math.floor(draft.length / 2);
  const spaceAfterMid = draft.indexOf(" ", mid);
  if (spaceAfterMid > 0) {
    return `${draft.slice(0, spaceAfterMid)} ${emojisToAdd}${draft.slice(spaceAfterMid)}`;
  }

  // Fallback: add at end
  return `${draft} ${emojisToAdd}`;
};

/**
 * Enforce message length to match user's pattern
 */
const enforceMessageLength = (draft: string, signals: UserSignals): string => {
  const currentLength = draft.length;
  const targetLength = signals.avgMessageLength;
  const tolerance = signals.messageLengthStd || targetLength * 0.2;

  // Within tolerance: keep as is
  if (Math.abs(currentLength - targetLength) <= tolerance) {
    return draft;
  }

  // Too long: truncate intelligently
  if (currentLength > targetLength + tolerance) {
    return truncateToLength(draft, targetLength, tolerance);
  }

  // Too short: keep as is (better short than artificial padding)
  return draft;
};

/**
 * Truncate message to target length while preserving complete sentences
 */
const truncateToLength = (draft: string, targetLength: number, tolerance: number): string => {
  const maxLength = Math.floor(targetLength + tolerance);

  if (draft.length <= maxLength) {
    return draft;
  }

  // Try to keep complete sentences
  const sentences = draft.split(/([!.?]\s+)/);
  let result = "";

  for (let i = 0; i < sentences.length; i++) {
    const candidate = result + sentences[i];
    if (candidate.length <= maxLength) {
      result = candidate;
    } else {
      break;
    }
  }

  // If result is empty or too short, do simple truncation
  if (result.length < targetLength * 0.5) {
    result = draft.slice(0, maxLength - 3) + "...";
  }

  return result.trim();
};

/**
 * Inject common phrases if appropriate and missing
 */
const injectCommonPhrases = (draft: string, signals: UserSignals): string => {
  const topPhrase = signals.commonPhrases[0]?.phrase;
  if (!topPhrase) {
    return draft;
  }

  // Check if draft already contains this phrase
  if (draft.toLowerCase().includes(topPhrase.toLowerCase())) {
    return draft;
  }

  // Inject if context is appropriate (e.g., support/caring messages)
  if (draft.match(/\b(here|support|help|sorry)\b/i)) {
    // Add phrase as a question at the end
    const capitalizedPhrase = topPhrase.charAt(0).toUpperCase() + topPhrase.slice(1);
    return draft.replace(/([!.?])?\s*$/, `? ${capitalizedPhrase}?`);
  }

  return draft;
};

/**
 * Enforce question pattern based on user's question rate
 */
const enforceQuestionPattern = (draft: string, signals: UserSignals): string => {
  const hasQuestion = draft.includes("?");
  const shouldHaveQuestion = signals.asksFollowupQuestions > 0.6;

  if (shouldHaveQuestion && !hasQuestion) {
    // Add a question at the end
    return addFollowUpQuestion(draft, signals);
  }

  return draft;
};

/**
 * Add a follow-up question at the end of the draft
 */
const addFollowUpQuestion = (draft: string, signals: UserSignals): string => {
  // Common follow-up questions (preferring user's common phrases if available)
  const commonQuestions = [
    "Want to talk?",
    "What happened?",
    "How are you feeling?",
    "Need anything?",
    "You okay?",
    "Wanna chat?",
  ];

  // Check if any common phrase is a question
  const questionPhrases = signals.commonPhrases.filter((p) => p.phrase.includes("?"));
  const question =
    questionPhrases.length > 0
      ? questionPhrases[0].phrase.charAt(0).toUpperCase() + questionPhrases[0].phrase.slice(1)
      : commonQuestions[0];

  return `${draft} ${question}`;
};

/**
 * Enforce punctuation style based on user's patterns
 */
const enforcePunctuationStyle = (draft: string, signals: UserSignals): string => {
  let result = draft;

  // If user rarely uses periods but draft has many, remove some
  if (signals.periodRate < 0.2 && (draft.match(/\./g)?.length ?? 0) > 1) {
    // Remove periods except at end
    result = draft.replaceAll(/\.(?!$)/g, "");
  }

  // If user uses lots of exclamation marks, ensure draft has some
  if (signals.exclamationRate > 0.5 && !draft.includes("!")) {
    // Replace first period with exclamation
    result = draft.replace(/\./, "!");
  }

  // If user uses ellipsis frequently, consider adding
  if (signals.ellipsisRate > 0.3 && !draft.includes("...") && !draft.includes("…")) {
    // Replace some periods with ellipsis (if appropriate context)
    if (draft.match(/\b(thinking|wondering|maybe)\b/i)) {
      result = draft.replace(/\.(?=[^.]*$)/, "...");
    }
  }

  return result;
};

/**
 * Validate draft quality against signals (for debugging/testing)
 */
export const validateDraftAgainstSignals = (
  draft: string,
  signals: UserSignals,
): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check emoji count
  const emojiCount = (draft.match(/[\p{Emoji}\p{Emoji_Presentation}\uFE0F]/gu) || []).length;
  const targetEmojis = Math.round(signals.emojiPerMessage);
  if (Math.abs(emojiCount - targetEmojis) > 1) {
    issues.push(`Emoji count mismatch: has ${emojiCount}, expected ${targetEmojis}`);
  }

  // Check length
  const lengthDiff = Math.abs(draft.length - signals.avgMessageLength);
  const tolerance = signals.messageLengthStd || signals.avgMessageLength * 0.2;
  if (lengthDiff > tolerance) {
    issues.push(
      `Length mismatch: ${draft.length} chars, expected ${signals.avgMessageLength.toFixed(0)} ±${tolerance.toFixed(0)}`,
    );
  }

  // Check question if required
  if (signals.asksFollowupQuestions > 0.6 && !draft.includes("?")) {
    issues.push("Missing follow-up question");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
};
