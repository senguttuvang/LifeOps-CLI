import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { WhatsAppAdapter } from "../src/infrastructure/adapters/whatsapp/whatsapp.adapter";
import type { WhatsAppChatData, WhatsAppMessageData, WhatsAppSyncResult } from "../src/infrastructure/whatsapp/whatsapp.types";

describe("WhatsAppAdapter", () => {
  const adapter = new WhatsAppAdapter();

  describe("translateSyncResult", () => {
    test("should translate empty sync result", async () => {
      const emptySyncResult: WhatsAppSyncResult = {
        chats: [],
        messages: [],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(emptySyncResult));

      expect(result.contacts).toHaveLength(0);
      expect(result.conversations).toHaveLength(0);
      expect(result.conversationParticipants).toHaveLength(0);
      expect(result.interactions).toHaveLength(0);
      expect(result.messages).toHaveLength(0);
    });

    test("should translate single direct message chat", async () => {
      const chat: WhatsAppChatData = {
        jid: "1234567890@s.whatsapp.net",
        name: "John Doe",
        isGroup: false,
        unreadCount: 0,
        lastMessageTime: 1704103200, // 2024-01-01 10:00:00 UTC
      };

      const message: WhatsAppMessageData = {
        id: "msg_001",
        chatJid: "1234567890@s.whatsapp.net",
        senderJid: "1234567890@s.whatsapp.net",
        isFromMe: false,
        isGroup: false,
        text: "Hello, how are you?",
        timestamp: 1704103200,
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [message],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Should create one contact
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]?.displayName).toBe("John Doe");

      // Should create one conversation
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0]?.conversationType).toBe("1:1");

      // Should create one interaction
      expect(result.interactions).toHaveLength(1);

      // Should create one message
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content).toBe("Hello, how are you?");
    });

    test("should translate group chat with multiple participants", async () => {
      const groupChat: WhatsAppChatData = {
        jid: "group123@g.us",
        name: "Family Group",
        isGroup: true,
        unreadCount: 5,
        lastMessageTime: 1704110400, // 2024-01-01 12:00:00 UTC
        participants: ["1111111111@s.whatsapp.net", "2222222222@s.whatsapp.net", "3333333333@s.whatsapp.net"],
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [groupChat],
        messages: [],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Should create contacts for all participants
      expect(result.contacts.length).toBeGreaterThanOrEqual(3);

      // Should create one group conversation
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0]?.conversationType).toBe("group");
      expect(result.conversations[0]?.title).toBe("Family Group");

      // Should create conversation participants
      expect(result.conversationParticipants.length).toBeGreaterThanOrEqual(3);
    });

    test("should handle messages from me", async () => {
      const chat: WhatsAppChatData = {
        jid: "1234567890@s.whatsapp.net",
        name: "Jane Smith",
        isGroup: false,
        unreadCount: 0,
        lastMessageTime: 1704103200,
      };

      const outgoingMessage: WhatsAppMessageData = {
        id: "msg_002",
        chatJid: "1234567890@s.whatsapp.net",
        senderJid: "me@s.whatsapp.net",
        isFromMe: true,
        isGroup: false,
        text: "Thanks for the update!",
        timestamp: 1704103500,
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [outgoingMessage],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content).toBe("Thanks for the update!");
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0]?.direction).toBe("outbound");
    });

    test("should generate valid UUIDs for all entities", async () => {
      const chat: WhatsAppChatData = {
        jid: "test@s.whatsapp.net",
        name: "Test User",
        isGroup: false,
        unreadCount: 0,
        lastMessageTime: 1704103200,
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      // All generated IDs should be valid UUIDs
      expect(result.contacts[0]?.id).toMatch(uuidRegex);
      expect(result.conversations[0]?.id).toMatch(uuidRegex);
    });

    test("should preserve JID to UUID mapping consistency", async () => {
      const chat: WhatsAppChatData = {
        jid: "consistent@s.whatsapp.net",
        name: "Consistency Test",
        isGroup: false,
        unreadCount: 0,
        lastMessageTime: 1704103200,
      };

      const message1: WhatsAppMessageData = {
        id: "msg_1",
        chatJid: "consistent@s.whatsapp.net",
        senderJid: "consistent@s.whatsapp.net",
        isFromMe: false,
        isGroup: false,
        text: "First message",
        timestamp: 1704103200,
        messageType: "text",
      };

      const message2: WhatsAppMessageData = {
        id: "msg_2",
        chatJid: "consistent@s.whatsapp.net",
        senderJid: "consistent@s.whatsapp.net",
        isFromMe: false,
        isGroup: false,
        text: "Second message",
        timestamp: 1704103200,
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [message1, message2],
        syncedAt: Date.now(),
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Both messages should reference the same conversation UUID
      const conversationUuid = result.conversations[0]?.id;
      expect(result.interactions[0]?.conversationId).toBe(conversationUuid);
      expect(result.interactions[1]?.conversationId).toBe(conversationUuid);
    });
  });
});
