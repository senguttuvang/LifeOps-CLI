/**
 * Contact Discovery Service
 *
 * Reads the raw WhatsApp dump and provides contact summaries
 * for user selection. Supports filtering by name.
 *
 * @module domain/sync
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Context, Effect, Layer } from "effect";

import type { ContactSummary, RawContact, RawDump } from "./types";
import { SYNC_PATHS } from "./types";

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ContactDiscoveryService {
  /**
   * Check if a raw dump exists
   */
  readonly hasDump: () => Effect.Effect<boolean>;

  /**
   * Load the raw dump from disk
   */
  readonly loadDump: () => Effect.Effect<RawDump, Error>;

  /**
   * Get contact summaries from the dump (sorted by message count)
   */
  readonly getContactSummaries: (dump: RawDump) => Effect.Effect<ContactSummary[]>;

  /**
   * Filter contacts by search term (fuzzy match on name or phone)
   */
  readonly filterContacts: (summaries: ContactSummary[], searchTerm: string) => Effect.Effect<ContactSummary[]>;

  /**
   * Get contact by index (1-based, for user selection)
   */
  readonly getContactByIndex: (summaries: ContactSummary[], index: number) => Effect.Effect<ContactSummary | undefined>;

  /**
   * Parse selection string (e.g., "1,2,5" or "1-5" or "all")
   */
  readonly parseSelection: (input: string, summaries: ContactSummary[]) => Effect.Effect<string[], Error>;
}

export const ContactDiscoveryService = Context.GenericTag<ContactDiscoveryService>("ContactDiscoveryService");

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Extract phone number from JID (e.g., "919876543210@s.whatsapp.net" -> "+91 98765 43210")
 */
const extractPhoneNumber = (jid: string): string | undefined => {
  // Individual JIDs: <phone>@s.whatsapp.net
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return undefined;

  const digits = match[1];

  // Format with country code (assume first 2 digits are country code)
  if (digits.length >= 10) {
    const countryCode = digits.slice(0, digits.length - 10);
    const number = digits.slice(-10);
    // Format: +91 98765 43210
    return `+${countryCode} ${number.slice(0, 5)} ${number.slice(5)}`;
  }

  return digits;
};

/**
 * Convert RawContact to ContactSummary
 */
const toContactSummary = (contact: RawContact, index: number): ContactSummary => {
  // Sort messages by timestamp descending to get most recent
  const sortedMessages = [...contact.messages].sort((a, b) => b.timestamp - a.timestamp);

  const lastMessage = sortedMessages[0];

  return {
    index: index + 1, // 1-based for user display
    jid: contact.jid,
    displayName: contact.pushName || contact.jid,
    phoneNumber: extractPhoneNumber(contact.jid),
    isGroup: contact.isGroup,
    messageCount: contact.messageCount,
    lastMessagePreview: lastMessage?.content?.slice(0, 50),
    lastMessageAt: lastMessage?.timestamp,
  };
};

/**
 * Fuzzy match for filtering contacts
 */
const fuzzyMatch = (text: string, searchTerm: string): boolean => {
  const normalizedText = text.toLowerCase().trim();
  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Simple contains match
  if (normalizedText.includes(normalizedSearch)) {
    return true;
  }

  // Match each word in search term
  const searchWords = normalizedSearch.split(/\s+/);
  return searchWords.every((word) => normalizedText.includes(word));
};

/**
 * Live implementation of ContactDiscoveryService
 */
const make = (): ContactDiscoveryService => ({
  hasDump: () => Effect.sync(() => existsSync(join(process.cwd(), SYNC_PATHS.dumpFile))),

  loadDump: () =>
    Effect.try({
      try: () => {
        const path = join(process.cwd(), SYNC_PATHS.dumpFile);

        if (!existsSync(path)) {
          throw new Error(`No dump file found at ${path}. Run 'bun run cli sync' first.`);
        }

        const content = readFileSync(path, "utf-8");
        return JSON.parse(content) as RawDump;
      },
      catch: (error) => new Error(`Failed to load dump: ${error instanceof Error ? error.message : String(error)}`),
    }),

  getContactSummaries: (dump) =>
    Effect.sync(() => {
      // Handle empty or invalid dump
      if (!dump?.contacts || !Array.isArray(dump.contacts)) {
        return [];
      }

      // Sort by message count (most messages first)
      const sorted = [...dump.contacts].sort((a, b) => b.messageCount - a.messageCount);

      return sorted.map(toContactSummary);
    }),

  filterContacts: (summaries, searchTerm) =>
    Effect.sync(() => {
      if (!searchTerm.trim()) {
        return summaries;
      }

      return summaries.filter(
        (s) =>
          fuzzyMatch(s.displayName, searchTerm) ||
          (s.phoneNumber && fuzzyMatch(s.phoneNumber, searchTerm)) ||
          fuzzyMatch(s.jid, searchTerm),
      );
    }),

  getContactByIndex: (summaries, index) => Effect.sync(() => summaries.find((s) => s.index === index)),

  parseSelection: (input, summaries) =>
    Effect.try({
      try: () => {
        const trimmed = input.trim().toLowerCase();

        // Handle "all" keyword
        if (trimmed === "all") {
          return summaries.map((s) => s.jid);
        }

        const selectedJids: string[] = [];

        // Split by comma
        const parts = trimmed.split(",").map((p) => p.trim());

        for (const part of parts) {
          // Check for range (e.g., "1-5")
          const rangeMatch = part.match(/^(\d+)-(\d+)$/);
          if (rangeMatch) {
            const start = Number.parseInt(rangeMatch[1], 10);
            const end = Number.parseInt(rangeMatch[2], 10);

            for (let i = start; i <= end; i++) {
              const contact = summaries.find((s) => s.index === i);
              if (contact) {
                selectedJids.push(contact.jid);
              }
            }
            continue;
          }

          // Single number
          const num = Number.parseInt(part, 10);
          if (!Number.isNaN(num)) {
            const contact = summaries.find((s) => s.index === num);
            if (contact) {
              selectedJids.push(contact.jid);
            }
          }
        }

        if (selectedJids.length === 0) {
          throw new Error(`No valid contacts selected. Use numbers (1,2,3), ranges (1-5), or 'all'.`);
        }

        return selectedJids;
      },
      catch: (error) => new Error(error instanceof Error ? error.message : "Invalid selection format"),
    }),
});

// =============================================================================
// LAYER
// =============================================================================

export const ContactDiscoveryServiceLive = Layer.succeed(ContactDiscoveryService, make());

export const ContactDiscoveryServiceTag = ContactDiscoveryService;
