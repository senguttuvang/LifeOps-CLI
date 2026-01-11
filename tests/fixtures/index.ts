/**
 * Test Fixtures
 *
 * Sample data for testing services and commands.
 * All fixtures are immutable and can be used across tests.
 */

import type {
  WhatsAppSyncResult,
  WhatsAppChatData,
  WhatsAppMessageData,
} from "../../src/infrastructure/whatsapp/whatsapp.types";
import type { UserSignals, MessageForSignals } from "../../src/domain/signals/types";
import type { TranslatedSyncResult } from "../../src/infrastructure/adapters/whatsapp/whatsapp.adapter";

// =============================================================================
// WHATSAPP FIXTURES
// =============================================================================

export const mockWhatsAppChat: WhatsAppChatData = {
  jid: "919876543210@s.whatsapp.net",
  name: "Test User",
  isGroup: false,
  unreadCount: 0,
  lastMessageTime: 1704103200, // 2024-01-01 10:00:00 UTC
};

export const mockGroupChat: WhatsAppChatData = {
  jid: "group123@g.us",
  name: "Family Group",
  isGroup: true,
  unreadCount: 5,
  lastMessageTime: 1704110400, // 2024-01-01 12:00:00 UTC
  participants: [
    "919876543210@s.whatsapp.net",
    "919876543211@s.whatsapp.net",
    "919876543212@s.whatsapp.net",
  ],
};

export const mockWhatsAppMessage: WhatsAppMessageData = {
  id: "wa_msg_001",
  chatJid: "919876543210@s.whatsapp.net",
  senderJid: "919876543210@s.whatsapp.net",
  isFromMe: false,
  isGroup: false,
  text: "Hello, how are you?",
  timestamp: 1704103200,
  messageType: "text",
};

export const mockOutboundMessage: WhatsAppMessageData = {
  id: "wa_msg_002",
  chatJid: "919876543210@s.whatsapp.net",
  senderJid: "me@s.whatsapp.net",
  isFromMe: true,
  isGroup: false,
  text: "I'm doing great, thanks!",
  timestamp: 1704103260,
  messageType: "text",
};

export const mockMediaMessage: WhatsAppMessageData = {
  id: "wa_msg_003",
  chatJid: "919876543210@s.whatsapp.net",
  senderJid: "919876543210@s.whatsapp.net",
  isFromMe: false,
  isGroup: false,
  messageType: "image",
  mediaUrl: "file:///media/image001.jpg",
  mediaMimeType: "image/jpeg",
  caption: "Check this out!",
  timestamp: 1704103320,
};

export const mockSyncResult: WhatsAppSyncResult = {
  chats: [mockWhatsAppChat, mockGroupChat],
  messages: [mockWhatsAppMessage, mockOutboundMessage, mockMediaMessage],
  syncedAt: Date.now(),
};

export const mockEmptySyncResult: WhatsAppSyncResult = {
  chats: [],
  messages: [],
  syncedAt: Date.now(),
};

// =============================================================================
// SIGNAL FIXTURES
// =============================================================================

export const mockMessagesForSignals: MessageForSignals[] = [
  {
    id: "msg_001",
    text: "Hey jaan! How are you? ❤️",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:00:00Z"),
  },
  {
    id: "msg_002",
    text: "I'm good! Just tired from work",
    fromMe: false,
    timestamp: new Date("2024-01-01T10:05:00Z"),
  },
  {
    id: "msg_003",
    text: "Oh no, that sounds tough. Want to talk about it? ❤️",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:07:00Z"),
  },
  {
    id: "msg_004",
    text: "Not really, just need some rest",
    fromMe: false,
    timestamp: new Date("2024-01-01T10:10:00Z"),
  },
  {
    id: "msg_005",
    text: "Ok! Get some rest then. Talk tomorrow? 😊",
    fromMe: true,
    timestamp: new Date("2024-01-01T10:12:00Z"),
  },
];

export const mockUserSignals: UserSignals = {
  userId: "test-user-id",

  // Response patterns
  avgResponseTimeMinutes: 3.5,
  responseTimeP50: 2.0,
  responseTimeP95: 7.0,
  initiationRate: 0.5,

  // Message structure
  avgMessageLength: 35,
  messageLengthStd: 10,
  medianMessageLength: 32,
  avgWordsPerMessage: 6,

  // Expression style
  emojiPerMessage: 0.8,
  emojiVariance: 0.2,
  topEmojis: [
    { emoji: "❤️", frequency: 0.6 },
    { emoji: "😊", frequency: 0.3 },
    { emoji: "😂", frequency: 0.1 },
  ],
  emojiPosition: { start: 0.1, middle: 0.2, end: 0.7 },

  // Punctuation
  exclamationRate: 0.4,
  questionRate: 0.3,
  periodRate: 0.2,
  ellipsisRate: 0.1,

  // Common patterns
  commonGreetings: ["hey jaan", "hi", "hello"],
  commonEndings: ["love you", "talk later", "bye"],
  commonPhrases: [
    { phrase: "want to talk", frequency: 0.4 },
    { phrase: "sounds good", frequency: 0.3 },
  ],
  fillerWords: ["just", "like", "actually"],

  // Behavioral
  asksFollowupQuestions: 0.7,
  usesVoiceNotes: 0.1,
  sendsMultipleMessages: 0.3,
  editsMessages: 0.05,

  // Temporal
  activeHours: { peak: [18, 19, 20, 21], low: [2, 3, 4, 5] },
  weekendVsWeekdayDiff: 1.2,

  // Metadata
  messageCount: 500,
  confidence: 0.85,
  lastComputedAt: new Date("2024-01-01T12:00:00Z"),
};

export const mockLowConfidenceSignals: UserSignals = {
  ...mockUserSignals,
  messageCount: 60,
  confidence: 0.5,
};

// =============================================================================
// DOMAIN ENTITY FIXTURES
// =============================================================================

export const mockTranslatedSyncResult: TranslatedSyncResult = {
  contacts: [
    {
      id: "contact-uuid-001",
      displayName: "Test User",
      type: "person",
      identifiers: [
        {
          id: "identifier-uuid-001",
          contactId: "contact-uuid-001",
          source: "whatsapp",
          identifier: "919876543210",
          isPrimary: true,
        },
      ],
    },
  ],
  conversations: [
    {
      id: "conversation-uuid-001",
      title: null,
      conversationType: "1:1",
      source: "whatsapp",
      sourceConversationId: "919876543210@s.whatsapp.net",
      isArchived: false,
      isPinned: false,
      lastActivityAt: new Date("2024-01-01T10:00:00Z"),
    },
  ],
  conversationParticipants: [],
  interactions: [
    {
      id: "interaction-uuid-001",
      conversationId: "conversation-uuid-001",
      interactionType: "message",
      direction: "inbound",
      fromContactId: "contact-uuid-001",
      occurredAt: new Date("2024-01-01T10:00:00Z"),
      source: "whatsapp",
      sourceInteractionId: "wa_msg_001",
      isIndexed: false,
    },
  ],
  messages: [
    {
      interactionId: "interaction-uuid-001",
      content: "Hello, how are you?",
      contentType: "text",
      mediaUrl: null,
      mediaMimeType: null,
      quotedInteractionId: null,
      reactionEmoji: null,
      isStarred: false,
      rawMetadata: null,
    },
  ],
  calls: [],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a batch of test messages for signal extraction tests.
 * Generates N messages with realistic patterns.
 */
export const createMessageBatch = (count: number, options: { fromMe?: boolean } = {}): MessageForSignals[] => {
  const messages: MessageForSignals[] = [];
  const baseTimestamp = new Date("2024-01-01T10:00:00Z").getTime();
  const sampleTexts = [
    "Hey! How's it going?",
    "Not bad, just working",
    "Cool cool, want to grab dinner later?",
    "Sure, where?",
    "How about that new Thai place?",
    "Sounds good! What time?",
    "Around 7pm?",
    "Perfect, see you there!",
    "Can't wait 😊",
    "Same! ❤️",
  ];

  for (let i = 0; i < count; i++) {
    messages.push({
      id: `msg_batch_${i.toString().padStart(4, "0")}`,
      text: sampleTexts[i % sampleTexts.length],
      fromMe: options.fromMe ?? i % 2 === 0,
      timestamp: new Date(baseTimestamp + i * 60000), // 1 minute apart
    });
  }

  return messages;
};

/**
 * Create a WhatsApp sync result with configurable number of messages.
 */
export const createSyncResultWithMessages = (messageCount: number): WhatsAppSyncResult => {
  const messages: WhatsAppMessageData[] = [];
  const baseTimestamp = Math.floor(Date.now() / 1000) - messageCount * 60;

  for (let i = 0; i < messageCount; i++) {
    messages.push({
      id: `wa_msg_${i.toString().padStart(4, "0")}`,
      chatJid: "919876543210@s.whatsapp.net",
      senderJid: i % 2 === 0 ? "919876543210@s.whatsapp.net" : "me@s.whatsapp.net",
      isFromMe: i % 2 !== 0,
      isGroup: false,
      text: `Test message ${i}`,
      timestamp: baseTimestamp + i * 60,
      messageType: "text",
    });
  }

  return {
    chats: [mockWhatsAppChat],
    messages,
    syncedAt: Date.now(),
  };
};
