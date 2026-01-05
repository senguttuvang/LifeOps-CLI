/**
 * WhatsApp Types
 *
 * Type definitions for WhatsApp messages, chats, and sync operations.
 */

/**
 * WhatsApp message from whatsmeow-cli JSON output
 */
export interface WhatsAppMessageData {
  id: string;
  chatJid: string;
  senderJid: string;
  timestamp: number; // Unix timestamp
  messageType: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
  text?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  caption?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  quotedMessageId?: string;
  isFromMe: boolean;
  isGroup: boolean;
}

/**
 * WhatsApp chat metadata from whatsmeow-cli
 */
export interface WhatsAppChatData {
  jid: string;
  name?: string;
  isGroup: boolean;
  lastMessageTime?: number;
  unreadCount?: number;
  participants?: string[]; // For group chats
}

/**
 * Sync result from whatsmeow-cli
 */
export interface WhatsAppSyncResult {
  messages: WhatsAppMessageData[];
  chats: WhatsAppChatData[];
  syncedAt: number;
  error?: string;
}

/**
 * Auth status from whatsmeow-cli
 */
export interface WhatsAppAuthStatus {
  authenticated: boolean;
  phoneNumber?: string;
  deviceId?: string;
  qrCode?: string;
}

/**
 * Health check result
 */
export interface WhatsAppHealth {
  cliAvailable: boolean;
  cliVersion?: string;
  authenticated: boolean;
  phoneNumber?: string;
  lastSyncAt?: Date;
  messageCount?: number;
  chatCount?: number;
}

/**
 * Sync options
 */
export interface WhatsAppSyncOptions {
  days?: number; // History window (default: 30)
  chatJid?: string; // Sync specific chat only
  includeMedia?: boolean; // Download media files
}

/**
 * Send message options
 */
export interface WhatsAppSendMessageOptions {
  to: string; // Recipient JID (e.g., "1234567890@s.whatsapp.net")
  content: string; // Message text
}

/**
 * Send message result
 */
export interface WhatsAppSendMessageResult {
  success: boolean;
  messageId: string;
  timestamp: number;
  to: string;
}
