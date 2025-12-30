/**
 * Behavioral Pattern Signal Extractor
 *
 * Analyzes behavioral patterns in messaging style.
 * Tracks follow-up questions, voice notes, multi-message sends, edits, and conversation initiation.
 */

import type { MessageForSignals, BehavioralSignals } from "../types";

/**
 * Extract behavioral pattern signals from message history
 *
 * Analyzes:
 * - Follow-up question rate (% messages with ?)
 * - Voice note usage rate
 * - Multiple message send rate (burst sending)
 * - Message edit rate
 * - Conversation initiation rate
 *
 * @param messages - Message history (chronologically ordered)
 * @returns Behavioral pattern statistics
 */
export const extractBehavioralPatterns = (messages: MessageForSignals[]): BehavioralSignals => {
  const userMessages = messages.filter((m) => m.fromMe);

  if (userMessages.length === 0) {
    return {
      asksFollowupQuestions: 0,
      usesVoiceNotes: 0,
      sendsMultipleMessages: 0,
      editsMessages: 0,
      initiationRate: 0,
    };
  }

  // Analyze follow-up questions
  let questionCount = 0;
  userMessages.forEach((m) => {
    if ((m.text || "").includes("?")) {
      questionCount++;
    }
  });

  // Analyze voice note usage
  let voiceNoteCount = 0;
  userMessages.forEach((m) => {
    if (m.mediaType === "audio" || m.mediaType === "voice") {
      voiceNoteCount++;
    }
  });

  // Analyze multi-message sends (burst sending)
  // Count sequences where user sends 2+ messages consecutively
  let multiSendCount = 0;
  let consecutiveUserMessages = 0;

  messages.forEach((m) => {
    if (m.fromMe) {
      consecutiveUserMessages++;
    } else {
      // Partner message, check if we just sent multiple
      if (consecutiveUserMessages >= 2) {
        multiSendCount++;
      }
      consecutiveUserMessages = 0;
    }
  });

  // Check for trailing consecutive messages
  if (consecutiveUserMessages >= 2) {
    multiSendCount++;
  }

  // Analyze edits
  let editCount = 0;
  userMessages.forEach((m) => {
    if (m.isEdited) {
      editCount++;
    }
  });

  // Analyze conversation initiation
  // Count how many conversations the user started
  let initiationCount = 0;

  // Group messages by conversation (simplified: look for gaps > 4 hours)
  const CONVERSATION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];

    const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();

    // New conversation if gap > 4 hours AND current message is from user
    if (timeDiff > CONVERSATION_GAP_MS && current.fromMe) {
      initiationCount++;
    }
  }

  // First message is also considered initiation if it's from user
  if (messages.length > 0 && messages[0].fromMe) {
    initiationCount++;
  }

  // Calculate total conversations
  let totalConversations = 1; // At least one conversation
  for (let i = 1; i < messages.length; i++) {
    const timeDiff = messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
    if (timeDiff > CONVERSATION_GAP_MS) {
      totalConversations++;
    }
  }

  return {
    asksFollowupQuestions: questionCount / userMessages.length,
    usesVoiceNotes: voiceNoteCount / userMessages.length,
    sendsMultipleMessages: multiSendCount / Math.max(totalConversations, 1),
    editsMessages: editCount / userMessages.length,
    initiationRate: initiationCount / Math.max(totalConversations, 1),
  };
};
