import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { WhatsAppAdapter } from "../src/infrastructure/adapters/whatsapp/whatsapp.adapter";
import type { WhatsAppChat, WhatsAppMessage, WhatsAppSyncResult } from "../src/infrastructure/whatsapp/whatsapp.types";

describe("WhatsAppAdapter", () => {
  const adapter = new WhatsAppAdapter();

  describe("translateSyncResult", () => {
    test("should translate empty sync result", async () => {
      const emptySyncResult: WhatsAppSyncResult = {
        chats: [],
        messages: [],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(emptySyncResult));

      expect(result.contacts).toHaveLength(0);
      expect(result.conversations).toHaveLength(0);
      expect(result.conversationParticipants).toHaveLength(0);
      expect(result.interactions).toHaveLength(0);
      expect(result.messages).toHaveLength(0);
    });

    test("should translate single direct message chat", async () => {
      const chat: WhatsAppChat = {
        jid: "1234567890@s.whatsapp.net",
        name: "John Doe",
        isGroup: false,
        unreadCount: 0,
        lastMessageTimestamp: new Date("2024-01-01T10:00:00Z"),
      };

      const message: WhatsAppMessage = {
        id: "msg_001",
        chatJid: "1234567890@s.whatsapp.net",
        senderJid: "1234567890@s.whatsapp.net",
        fromMe: false,
        body: "Hello, how are you?",
        timestamp: new Date("2024-01-01T10:00:00Z"),
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [message],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Should create one contact
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]?.name).toBe("John Doe");

      // Should create one conversation
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0]?.isGroup).toBe(false);

      // Should create one interaction
      expect(result.interactions).toHaveLength(1);

      // Should create one message
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content).toBe("Hello, how are you?");
    });

    test("should translate group chat with multiple participants", async () => {
      const groupChat: WhatsAppChat = {
        jid: "group123@g.us",
        name: "Family Group",
        isGroup: true,
        unreadCount: 5,
        lastMessageTimestamp: new Date("2024-01-01T12:00:00Z"),
        participants: ["1111111111@s.whatsapp.net", "2222222222@s.whatsapp.net", "3333333333@s.whatsapp.net"],
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [groupChat],
        messages: [],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Should create contacts for all participants
      expect(result.contacts.length).toBeGreaterThanOrEqual(3);

      // Should create one group conversation
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0]?.isGroup).toBe(true);
      expect(result.conversations[0]?.name).toBe("Family Group");

      // Should create conversation participants
      expect(result.conversationParticipants.length).toBeGreaterThanOrEqual(3);
    });

    test("should handle messages from me", async () => {
      const chat: WhatsAppChat = {
        jid: "1234567890@s.whatsapp.net",
        name: "Jane Smith",
        isGroup: false,
        unreadCount: 0,
        lastMessageTimestamp: new Date("2024-01-01T10:00:00Z"),
      };

      const outgoingMessage: WhatsAppMessage = {
        id: "msg_002",
        chatJid: "1234567890@s.whatsapp.net",
        senderJid: "me@s.whatsapp.net",
        fromMe: true,
        body: "Thanks for the update!",
        timestamp: new Date("2024-01-01T10:05:00Z"),
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [outgoingMessage],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content).toBe("Thanks for the update!");
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0]?.direction).toBe("outbound");
    });

    test("should generate valid UUIDs for all entities", async () => {
      const chat: WhatsAppChat = {
        jid: "test@s.whatsapp.net",
        name: "Test User",
        isGroup: false,
        unreadCount: 0,
        lastMessageTimestamp: new Date(),
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      // All generated IDs should be valid UUIDs
      expect(result.contacts[0]?.uuid).toMatch(uuidRegex);
      expect(result.conversations[0]?.uuid).toMatch(uuidRegex);
    });

    test("should preserve JID to UUID mapping consistency", async () => {
      const chat: WhatsAppChat = {
        jid: "consistent@s.whatsapp.net",
        name: "Consistency Test",
        isGroup: false,
        unreadCount: 0,
        lastMessageTimestamp: new Date(),
      };

      const message1: WhatsAppMessage = {
        id: "msg_1",
        chatJid: "consistent@s.whatsapp.net",
        senderJid: "consistent@s.whatsapp.net",
        fromMe: false,
        body: "First message",
        timestamp: new Date(),
        messageType: "text",
      };

      const message2: WhatsAppMessage = {
        id: "msg_2",
        chatJid: "consistent@s.whatsapp.net",
        senderJid: "consistent@s.whatsapp.net",
        fromMe: false,
        body: "Second message",
        timestamp: new Date(),
        messageType: "text",
      };

      const syncResult: WhatsAppSyncResult = {
        chats: [chat],
        messages: [message1, message2],
      };

      const result = await Effect.runPromise(adapter.translateSyncResult(syncResult));

      // Both messages should reference the same conversation UUID
      const conversationUuid = result.conversations[0]?.uuid;
      expect(result.interactions[0]?.conversationUuid).toBe(conversationUuid);
      expect(result.interactions[1]?.conversationUuid).toBe(conversationUuid);
    });
  });
});
