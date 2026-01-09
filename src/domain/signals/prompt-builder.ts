/**
 * Signal-Aware Prompt Builder
 *
 * Builds LLM prompts that incorporate behavioral signals for style matching.
 * Creates prompts that explicitly instruct the LLM to match user's exact patterns.
 *
 * Used in RAG+Signals personalization system (Week 2 implementation).
 */

import type { UserSignals } from "./types";

/**
 * Build a signal-enhanced prompt for draft generation
 *
 * Takes incoming message, RAG examples, and behavioral signals to create
 * a prompt that enforces exact style matching.
 *
 * @param incomingMessage - Message to respond to
 * @param ragExamples - Similar past messages from RAG search
 * @param signals - User's behavioral signals
 * @returns Prompt for LLM
 */
export const buildSignalEnhancedPrompt = (
  incomingMessage: string,
  ragExamples: string[],
  signals: UserSignals,
): string => {
  const emojiPreference = getEmojiPreference(signals);
  const questionPreference = getQuestionPreference(signals);
  const lengthGuidance = getLengthGuidance(signals);
  const punctuationStyle = getPunctuationStyle(signals);

  return `
You are drafting a WhatsApp response that matches the user's EXACT communication style.

INCOMING MESSAGE:
"${incomingMessage}"

USER'S STYLE PROFILE (MUST MATCH):
${lengthGuidance}
${emojiPreference}
${questionPreference}
${punctuationStyle}

Common Patterns to Use:
${getCommonPatternsGuidance(signals)}

PAST EXAMPLES (for reference):
${ragExamples.map((ex, i) => `${i + 1}. "${ex}"`).join("\n")}

CRITICAL STYLE RULES (MUST FOLLOW):
1. Length: MUST be approximately ${signals.avgMessageLength.toFixed(0)} characters (±${signals.messageLengthStd.toFixed(0)})
2. Emojis: ${getEmojiCountRule(signals)}
3. Preferred emojis: ${
    signals.topEmojis
      .slice(0, 3)
      .map((e) => e.emoji)
      .join(", ") || "None"
  }
4. Common phrases: Try to incorporate "${signals.commonPhrases[0]?.phrase || "N/A"}"
5. Questions: ${questionPreference}
6. Tone: ${getToneGuidance(signals)}

Draft response (matching EXACT style):
`.trim();
};

/**
 * Get emoji usage preference text
 */
const getEmojiPreference = (signals: UserSignals): string => {
  const count = Math.round(signals.emojiPerMessage);
  const position = getEmojiPosition(signals.emojiPosition);
  const top = signals.topEmojis.slice(0, 3).map((e) => `${e.emoji} (${(e.frequency * 100).toFixed(0)}%)`);

  if (count === 0) {
    return "- Emojis: User rarely uses emojis. Keep response minimal or emoji-free.";
  }

  return `- Emojis: User uses ${count} emoji(s) per message, typically at the ${position}.
  Top emojis: ${top.join(", ")}`;
};

/**
 * Get emoji position preference
 */
const getEmojiPosition = (position: { start: number; middle: number; end: number }): string => {
  if (position.end > 0.6) {return "end of message";}
  if (position.start > 0.6) {return "start of message";}
  if (position.middle > 0.4) {return "middle of message";}
  return "mixed positions";
};

/**
 * Get question usage preference
 */
const getQuestionPreference = (signals: UserSignals): string => {
  if (signals.asksFollowupQuestions > 0.6) {
    return "User frequently asks follow-up questions. MUST include a question in response.";
  } if (signals.asksFollowupQuestions > 0.3) {
    return "User sometimes asks questions. Consider including a question if appropriate.";
  }
  return "User rarely asks questions. Question optional.";
};

/**
 * Get length guidance
 */
const getLengthGuidance = (signals: UserSignals): string => {
  const avg = signals.avgMessageLength.toFixed(0);
  const min = Math.max(0, signals.avgMessageLength - signals.messageLengthStd).toFixed(0);
  const max = (signals.avgMessageLength + signals.messageLengthStd).toFixed(0);

  return `- Message length: Average ${avg} characters (typically ${min}-${max} characters)`;
};

/**
 * Get punctuation style description
 */
const getPunctuationStyle = (signals: UserSignals): string => {
  const styles: string[] = [];

  if (signals.exclamationRate > 0.3) {
    styles.push(`Uses exclamation marks often (${(signals.exclamationRate * 100).toFixed(0)}% of messages)`);
  }

  if (signals.questionRate > 0.5) {
    styles.push(`Asks many questions (${(signals.questionRate * 100).toFixed(0)}% of messages)`);
  }

  if (signals.ellipsisRate > 0.2) {
    styles.push(`Uses ellipsis frequently (${(signals.ellipsisRate * 100).toFixed(0)}% of messages)`);
  }

  if (signals.periodRate < 0.2) {
    styles.push("Rarely uses periods (casual style)");
  }

  if (styles.length === 0) {
    return "- Punctuation: Standard casual punctuation";
  }

  return `- Punctuation: ${styles.join(", ")}`;
};

/**
 * Get common patterns guidance
 */
const getCommonPatternsGuidance = (signals: UserSignals): string => {
  const parts: string[] = [];

  if (signals.commonGreetings.length > 0) {
    parts.push(
      `- Greetings: ${signals.commonGreetings
        .slice(0, 3)
        .map((g) => `"${g}"`)
        .join(", ")}`,
    );
  }

  if (signals.commonEndings.length > 0) {
    parts.push(
      `- Endings: ${signals.commonEndings
        .slice(0, 3)
        .map((e) => `"${e}"`)
        .join(", ")}`,
    );
  }

  if (signals.commonPhrases.length > 0) {
    const topPhrases = signals.commonPhrases.slice(0, 3).map((p) => `"${p.phrase}"`);
    parts.push(`- Common phrases: ${topPhrases.join(", ")}`);
  }

  if (signals.fillerWords.length > 0) {
    parts.push(`- Filler words: ${signals.fillerWords.join(", ")}`);
  }

  return parts.join("\n");
};

/**
 * Get emoji count rule
 */
const getEmojiCountRule = (signals: UserSignals): string => {
  const count = Math.round(signals.emojiPerMessage);

  if (count === 0) {return "Do not use emojis";}
  if (count === 1) {return "Use exactly 1 emoji";}
  return `Use exactly ${count} emojis`;
};

/**
 * Get tone guidance based on signals
 */
const getToneGuidance = (signals: UserSignals): string => {
  const tones: string[] = [];

  // Formality (based on punctuation and length)
  if (signals.periodRate > 0.5 && signals.avgMessageLength > 100) {
    tones.push("Formal");
  } else if (signals.periodRate < 0.2 && signals.exclamationRate > 0.3) {
    tones.push("Very casual");
  } else {
    tones.push("Casual");
  }

  // Enthusiasm (based on exclamation rate)
  if (signals.exclamationRate > 0.5) {
    tones.push("Enthusiastic");
  }

  // Warmth (based on emoji usage)
  if (signals.emojiPerMessage > 2) {
    tones.push("Warm/Expressive");
  }

  // Supportive (based on question rate)
  if (signals.asksFollowupQuestions > 0.6) {
    tones.push("Engaged/Supportive");
  }

  return tones.join(", ");
};

/**
 * Build a basic prompt without signal enhancement (for A/B testing)
 */
export const buildBasicPrompt = (incomingMessage: string, ragExamples: string[]): string => {
  return `
You are drafting a WhatsApp response in a casual, friendly style.

INCOMING MESSAGE:
"${incomingMessage}"

PAST EXAMPLES (for reference):
${ragExamples.map((ex, i) => `${i + 1}. "${ex}"`).join("\n")}

Draft a natural, caring response:
`.trim();
};
