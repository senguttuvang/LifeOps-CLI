/**
 * WhatsApp Sync Domain Types
 *
 * Types for the two-phase sync process:
 * 1. Dump all messages from WhatsApp (Go CLI)
 * 2. User selects contacts (Effect-TS CLI)
 * 3. Import selected to SQLite
 *
 * @module domain/sync
 */

// =============================================================================
// RAW DUMP TYPES (from Go CLI output)
// =============================================================================

/**
 * A single message from the raw dump
 */
export interface RawMessage {
  id: string;
  chatId: string;
  fromJid: string;
  messageType: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
  mediaKey?: string;
  mediaUrl?: string;
}

/**
 * A contact with all their messages from the raw dump
 */
export interface RawContact {
  jid: string;
  pushName: string;
  isGroup: boolean;
  messageCount: number;
  messages: RawMessage[];
}

/**
 * Complete raw dump result from Go CLI
 */
export interface RawDump {
  contacts: RawContact[];
  totalMessages: number;
  dumpedAt: number;
}

/**
 * Result of Go CLI dump command (stdout JSON)
 */
export interface DumpCommandResult {
  success: boolean;
  outputPath: string;
  totalMessages: number;
  contactCount: number;
}

// =============================================================================
// CONTACT SELECTION TYPES
// =============================================================================

/**
 * Contact summary for selection UI (without full messages)
 */
export interface ContactSummary {
  /** Index for selection (1-based for user display) */
  index: number;
  /** WhatsApp JID */
  jid: string;
  /** Display name (push name or JID) */
  displayName: string;
  /** Phone number extracted from JID, if available */
  phoneNumber?: string;
  /** Is this a group chat */
  isGroup: boolean;
  /** Total message count */
  messageCount: number;
  /** Preview of most recent message */
  lastMessagePreview?: string;
  /** Timestamp of most recent message */
  lastMessageAt?: number;
}

/**
 * User's contact selection
 */
export interface ContactSelection {
  /** Selected contact JIDs */
  selectedJids: string[];
  /** Whether user wants to import all */
  importAll: boolean;
  /** Optional: days of history to import (default: all) */
  daysToImport?: number;
}

// =============================================================================
// IMPORT TYPES
// =============================================================================

/**
 * Result of importing selected contacts to SQLite
 */
export interface ImportResult {
  /** Number of contacts imported */
  contactsImported: number;
  /** Number of messages imported */
  messagesImported: number;
  /** Any errors encountered */
  errors: ImportError[];
  /** Whether temp dump was cleaned up */
  tempCleanedUp: boolean;
}

/**
 * Error during import
 */
export interface ImportError {
  jid: string;
  error: string;
  messageCount: number;
}

// =============================================================================
// SYNC STATE
// =============================================================================

/**
 * Current state of the sync process
 */
export type SyncState =
  | { phase: "idle" }
  | { phase: "dumping" }
  | { phase: "selecting"; dump: RawDump; summaries: ContactSummary[] }
  | { phase: "importing"; selection: ContactSelection }
  | { phase: "complete"; result: ImportResult }
  | { phase: "error"; error: string };

/**
 * Sync options from CLI arguments
 */
export interface SyncOptions {
  /** Session directory for WhatsApp */
  sessionDir: string;
  /** Whether to skip contact selection (import all) */
  importAll: boolean;
  /** Days of history to import */
  days?: number;
  /** Whether to keep temp dump after import */
  keepDump: boolean;
}

/**
 * Paths used during sync
 */
export const SYNC_PATHS = {
  /** Directory for raw dump (gitignored) */
  dumpDir: "whatsapp-raw",
  /** Main dump file */
  dumpFile: "whatsapp-raw/dump.json",
  /** Binary path relative to project */
  cliBinary: "bin/whatsmeow-cli",
} as const;
