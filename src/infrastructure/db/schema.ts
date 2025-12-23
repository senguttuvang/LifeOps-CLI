import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// --- WhatsApp Domain ---

export const whatsappChats = sqliteTable(
  'whatsapp_chats',
  {
    id: text('id').primaryKey(), // JID
    name: text('name'),
    isGroup: integer('is_group', { mode: 'boolean' }).notNull(),
    unreadCount: integer('unread_count').default(0),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp' }),
    participantCount: integer('participant_count').default(0),
    archived: integer('archived', { mode: 'boolean' }).default(false),
    pinned: integer('pinned', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    lastMessageIdx: index('idx_chats_last_message').on(table.lastMessageAt),
  })
);

export const whatsappMessages = sqliteTable(
  'whatsapp_messages',
  {
    id: text('id').primaryKey(), // Message ID (remote)
    chatId: text('chat_id').notNull().references(() => whatsappChats.id),
    senderId: text('sender_id').notNull(),
    fromMe: integer('from_me', { mode: 'boolean' }).notNull(),
    content: text('content'), // Text content
    messageType: text('message_type'), // text, image, video, audio, etc.
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    
    // Media
    mediaUrl: text('media_url'),
    mediaKey: text('media_key'),
    mediaMimeType: text('media_mime_type'),
    
    // Metadata
    rawJson: text('raw_json'), // Full raw object for archival
    
    isIndexed: integer('is_indexed', { mode: 'boolean' }).default(false), // RAG status
    
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    chatIdx: index('idx_messages_chat').on(table.chatId),
    timestampIdx: index('idx_messages_timestamp').on(table.timestamp),
    indexedIdx: index('idx_messages_indexed').on(table.isIndexed),
  })
);

export const whatsappSyncState = sqliteTable('whatsapp_sync_state', {
  id: text('id').primaryKey(), // 'main'
  cursor: text('cursor'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
});

// --- Relationship Domain ---

export const relationshipProfiles = sqliteTable('relationship_profiles', {
  id: text('id').primaryKey(), // e.g., 'girlfriend', 'best_friend'
  chatId: text('chat_id').references(() => whatsappChats.id), // Link to specific WhatsApp chat
  name: text('name').notNull(),
  type: text('type').notNull(), // 'partner', 'friend', 'family'
  
  // Computed Metadata
  lastAnalysisAt: integer('last_analysis_at', { mode: 'timestamp' }),
  moodScore: integer('mood_score'), // 0-100
  notes: text('notes'), // Manual notes
});
