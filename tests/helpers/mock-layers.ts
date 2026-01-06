/**
 * Mock Layers for Testing
 *
 * Provides Layer.succeed implementations for all services,
 * allowing tests to run without real infrastructure dependencies.
 *
 * IMPORTANT: This file intentionally re-defines service interfaces and Tags
 * to avoid importing source files that depend on bun:sqlite (which isn't
 * available in Node.js/Vitest runtime).
 */

import { Context, Effect, Layer } from "effect";
import type { WhatsAppSyncResult, WhatsAppAuthStatus, WhatsAppChatData } from "../../src/infrastructure/whatsapp/whatsapp.types";
import type { UserSignals } from "../../src/domain/signals/types";
import { mockSyncResult, mockUserSignals } from "../fixtures";

// =============================================================================
// RE-DEFINED SERVICE INTERFACES (to avoid bun:sqlite imports)
// =============================================================================

/**
 * SyncStats - matches src/domain/whatsapp/sync.service.ts
 */
export interface SyncStats {
  readonly contactsAdded: number;
  readonly conversationsAdded: number;
  readonly participantsAdded: number;
  readonly messagesAdded: number;
  readonly callsAdded: number;
  readonly syncedAt: Date;
}

/**
 * SyncService interface - matches src/domain/whatsapp/sync.service.ts
 */
export interface SyncService {
  readonly syncMessages: (options?: { days?: number; chatJid?: string }) => Effect.Effect<SyncStats, Error, never>;
  readonly syncFromData: (data: WhatsAppSyncResult) => Effect.Effect<SyncStats, Error, never>;
  readonly getSyncState: () => Effect.Effect<{ lastSyncAt: Date | null; cursor: string | null } | null, Error, never>;
}

/**
 * WhatsAppService interface - matches src/infrastructure/whatsapp/whatsapp.client.ts
 */
export interface WhatsAppService {
  readonly isAvailable: () => Effect.Effect<boolean, Error>;
  readonly getAuthStatus: () => Effect.Effect<WhatsAppAuthStatus, Error>;
  readonly authenticateQR: () => Effect.Effect<string, Error>;
  readonly syncMessages: (options?: { days?: number; chatJid?: string; includeMedia?: boolean }) => Effect.Effect<WhatsAppSyncResult, Error>;
  readonly listChats: () => Effect.Effect<WhatsAppChatData[], Error>;
  readonly sendMessage: (options: { to: string; content: string }) => Effect.Effect<{ success: boolean; messageId: string; timestamp: number; to: string }, Error>;
  readonly healthCheck: () => Effect.Effect<{ available: boolean; authenticated: boolean; error?: string }, never>;
}

/**
 * SignalExtractionService interface - matches src/domain/signals/signal-extraction.service.ts
 */
export interface SignalExtractionService {
  readonly extractSignals: (userId: string) => Effect.Effect<UserSignals, Error>;
  readonly refreshSignals: (userId: string) => Effect.Effect<void, Error>;
  readonly getSignals: (userId: string) => Effect.Effect<UserSignals | undefined, Error>;
}

// =============================================================================
// SERVICE TAGS (re-defined to avoid importing from source)
// =============================================================================

/**
 * SyncServiceTag - must match the tag string in source
 */
export class SyncServiceTag extends Context.Tag("SyncService")<SyncServiceTag, SyncService>() {}

/**
 * WhatsAppServiceTag - must match the tag string in source
 */
export class WhatsAppServiceTag extends Context.Tag("WhatsAppService")<WhatsAppServiceTag, WhatsAppService>() {}

/**
 * SignalExtractionServiceTag - must match the tag string in source
 */
export class SignalExtractionServiceTag extends Context.Tag("SignalExtractionService")<
  SignalExtractionServiceTag,
  SignalExtractionService
>() {}

// =============================================================================
// MOCK WHATSAPP SERVICE
// =============================================================================

export interface MockWhatsAppOptions {
  syncData?: WhatsAppSyncResult;
  shouldFail?: boolean;
  failureMessage?: string;
  isAvailable?: boolean;
  isAuthenticated?: boolean;
}

export const createMockWhatsAppLayer = (
  options: MockWhatsAppOptions = {},
): Layer.Layer<WhatsAppServiceTag> => {
  const mockService: WhatsAppService = {
    isAvailable: () => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "WhatsApp CLI not available"));
      }
      return Effect.succeed(options.isAvailable ?? true);
    },

    getAuthStatus: () => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Auth check failed"));
      }
      return Effect.succeed({
        authenticated: options.isAuthenticated ?? true,
        phoneNumber: "+91 98765 43210",
      });
    },

    authenticateQR: () => {
      return Effect.succeed("mock-qr-code-data");
    },

    syncMessages: (_opts) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Sync failed"));
      }
      return Effect.succeed(options.syncData || mockSyncResult);
    },

    listChats: () => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "List chats failed"));
      }
      return Effect.succeed(options.syncData?.chats || mockSyncResult.chats);
    },

    sendMessage: (_opts) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Send message failed"));
      }
      return Effect.succeed({
        success: true,
        messageId: "mock-message-id",
        timestamp: Date.now(),
        to: _opts.to,
      });
    },

    healthCheck: () => {
      return Effect.succeed({
        available: options.isAvailable ?? true,
        authenticated: options.isAuthenticated ?? true,
        error: options.shouldFail ? options.failureMessage : undefined,
      });
    },
  };

  return Layer.succeed(WhatsAppServiceTag, mockService);
};

// =============================================================================
// MOCK SYNC SERVICE
// =============================================================================

export interface MockSyncOptions {
  syncResult?: Partial<SyncStats>;
  shouldFail?: boolean;
  failureMessage?: string;
  syncState?: { lastSyncAt: Date | null; cursor: string | null } | null;
}

export const createMockSyncLayer = (options: MockSyncOptions = {}): Layer.Layer<SyncServiceTag> => {
  const defaultStats: SyncStats = {
    contactsAdded: 5,
    conversationsAdded: 3,
    participantsAdded: 8,
    messagesAdded: 100,
    callsAdded: 2,
    syncedAt: new Date(),
    ...options.syncResult,
  };

  const mockService: SyncService = {
    syncMessages: (_opts) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Sync failed"));
      }
      return Effect.succeed(defaultStats);
    },

    syncFromData: (_data) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Sync from data failed"));
      }
      return Effect.succeed(defaultStats);
    },

    getSyncState: () => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Get sync state failed"));
      }
      return Effect.succeed(
        options.syncState !== undefined
          ? options.syncState
          : { lastSyncAt: new Date(), cursor: null },
      );
    },
  };

  return Layer.succeed(SyncServiceTag, mockService);
};

// =============================================================================
// MOCK SIGNAL EXTRACTION SERVICE
// =============================================================================

export interface MockSignalExtractionOptions {
  signals?: UserSignals;
  shouldFail?: boolean;
  failureMessage?: string;
  insufficientData?: boolean;
}

export const createMockSignalExtractionLayer = (
  options: MockSignalExtractionOptions = {},
): Layer.Layer<SignalExtractionServiceTag> => {
  const mockService: SignalExtractionService = {
    extractSignals: (userId) => {
      if (options.insufficientData) {
        return Effect.fail(new Error("Insufficient data: need at least 50 messages, found 0"));
      }
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Signal extraction failed"));
      }
      return Effect.succeed({ ...mockUserSignals, userId });
    },

    refreshSignals: (userId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Signal refresh failed"));
      }
      return Effect.succeed(undefined);
    },

    getSignals: (userId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Get signals failed"));
      }
      if (options.signals) {
        return Effect.succeed({ ...options.signals, userId });
      }
      return Effect.succeed(undefined);
    },
  };

  return Layer.succeed(SignalExtractionServiceTag, mockService);
};

// =============================================================================
// WHATSAPP ADAPTER TAG (re-defined to avoid import issues)
// =============================================================================

// NOTE: The WhatsApp adapter is tested directly in whatsapp-adapter.test.ts
// which imports it correctly. For other tests that need the adapter tag,
// we re-define it here to match the source tag string.

/**
 * WhatsAppAdapterTag - must match the tag string in source
 */
export class WhatsAppAdapterTag extends Context.Tag("WhatsAppAdapter")<
  WhatsAppAdapterTag,
  {
    translateSyncResult: (data: WhatsAppSyncResult) => Effect.Effect<any, Error>;
    getContactUuidByJid: (jid: string) => string | undefined;
    getConversationUuidByJid: (jid: string) => string | undefined;
    clearMappings: () => void;
  }
>() {}

// NOTE: createWhatsAppAdapterLayer is NOT provided here because it requires
// importing the actual adapter class which causes ES module issues in Vitest.
// Tests that need the actual adapter should use whatsapp-adapter.test.ts patterns.

// =============================================================================
// COMPOSITE TEST LAYERS
// =============================================================================

export interface TestLayerOptions {
  whatsapp?: MockWhatsAppOptions;
  sync?: MockSyncOptions;
  signals?: MockSignalExtractionOptions;
}

/**
 * Create a composite test layer with all mocked services.
 * Individual services can be configured via options.
 */
export const createTestLayers = (
  options: TestLayerOptions = {},
): Layer.Layer<WhatsAppServiceTag | SyncServiceTag | SignalExtractionServiceTag | WhatsAppAdapterTag> => {
  return Layer.mergeAll(
    createMockWhatsAppLayer(options.whatsapp),
    createMockSyncLayer(options.sync),
    createMockSignalExtractionLayer(options.signals),
    createWhatsAppAdapterLayer(),
  );
};

/**
 * Create minimal infrastructure layer (WhatsApp + Adapter only)
 * Useful for testing services that depend on these
 */
export const createInfrastructureTestLayer = (
  options: { whatsapp?: MockWhatsAppOptions } = {},
): Layer.Layer<WhatsAppServiceTag | WhatsAppAdapterTag> => {
  return Layer.mergeAll(
    createMockWhatsAppLayer(options.whatsapp),
    createWhatsAppAdapterLayer(),
  );
};
