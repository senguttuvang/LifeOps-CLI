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
  readonly getSyncState: () => Effect.Effect<{ lastSyncAt: Date | null; metadata: SyncMetadata | null } | null, Error, never>;
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

/**
 * AnalysisService interface - matches src/domain/relationship/analysis.service.ts
 */
export interface AnalysisService {
  readonly indexChat: (chatId: string) => Effect.Effect<void, Error>;
  readonly analyze: (chatId: string) => Effect.Effect<string, Error>;
  readonly draftResponse: (chatId: string, intent: string) => Effect.Effect<string, Error>;
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

/**
 * AnalysisServiceTag - must match the tag string in source
 */
export class AnalysisServiceTag extends Context.Tag("AnalysisService")<AnalysisServiceTag, AnalysisService>() {}

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
  syncState?: { lastSyncAt: Date | null; metadata: SyncMetadata | null } | null;
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
          : { lastSyncAt: new Date(), metadata: null },
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
// MOCK ANALYSIS SERVICE
// =============================================================================

export interface MockAnalysisOptions {
  analysisResult?: string;
  draftResult?: string;
  shouldFail?: boolean;
  failureMessage?: string;
  noMessages?: boolean;
}

export const createMockAnalysisLayer = (options: MockAnalysisOptions = {}): Layer.Layer<AnalysisServiceTag> => {
  const mockService: AnalysisService = {
    indexChat: (_chatId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Index failed"));
      }
      return Effect.succeed(undefined);
    },

    analyze: (_chatId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Analysis failed"));
      }
      if (options.noMessages) {
        return Effect.succeed("No messages found for this chat.");
      }
      return Effect.succeed(
        options.analysisResult ||
          `## Relationship State Report

### Current Emotional Tone
The conversation shows a warm and engaged tone. Both parties seem comfortable sharing.

### Key Topics
- Weekend plans
- Work stress
- Shared memories

### Sentiments
Positive overall, with minor tension around scheduling.

### Suggestions
Consider scheduling dedicated time together this weekend.`,
      );
    },

    draftResponse: (_chatId, _intent) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Draft failed"));
      }
      return Effect.succeed(
        options.draftResult || "Hey! I was thinking about what you said earlier. How about we talk more about it over dinner?",
      );
    },
  };

  return Layer.succeed(AnalysisServiceTag, mockService);
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

// =============================================================================
// SYNC STATE REPOSITORY
// =============================================================================

/**
 * SyncMetadata - matches src/infrastructure/db/sync-state.repository.ts
 */
export interface SyncMetadata {
  readonly highestMessageTimestamp?: number;
  readonly lastEventId?: string;
  readonly syncMode?: "full" | "incremental" | "realtime";
  readonly deviceId?: string;
  readonly sessionStart?: number;
  readonly gaps?: Array<{
    from: number;
    to: number;
    reason: string;
  }>;
}

/**
 * SyncWatermark - matches src/infrastructure/db/sync-state.repository.ts
 */
export interface SyncWatermark {
  readonly lastSyncAt: Date;
  readonly metadata: SyncMetadata | null;
}

/**
 * SyncStateRecord - matches src/infrastructure/db/sync-state.repository.ts
 */
export interface SyncStateRecord {
  readonly id: string;
  readonly channelId: string;
  readonly lastSyncAt: Date | null;
  readonly lastSyncStatus: "success" | "partial" | "failed" | null;
  readonly errorMessage: string | null;
  readonly syncedCount: number;
  readonly totalCount: number;
  readonly metadata: SyncMetadata | null;
}

/**
 * SyncStateRepository interface - matches src/infrastructure/db/sync-state.repository.ts
 */
export interface SyncStateRepository {
  readonly getState: (channelId: string) => Effect.Effect<SyncStateRecord | null, Error>;
  readonly getWatermark: (channelId: string) => Effect.Effect<SyncWatermark | null, Error>;
  readonly recordSuccess: (channelId: string, stats: { syncedCount: number; totalCount?: number; syncedAt: Date }) => Effect.Effect<void, Error>;
  readonly recordFailure: (channelId: string, error: string) => Effect.Effect<void, Error>;
  readonly updateMetadata: (channelId: string, metadata: Partial<SyncMetadata>) => Effect.Effect<void, Error>;
}

/**
 * SyncStateRepositoryTag - must match the tag string in source
 */
export class SyncStateRepositoryTag extends Context.Tag("SyncStateRepository")<
  SyncStateRepositoryTag,
  SyncStateRepository
>() {}

export interface MockSyncStateRepositoryOptions {
  state?: SyncStateRecord | null;
  watermark?: SyncWatermark | null;
  shouldFail?: boolean;
  failureMessage?: string;
}

/**
 * Create a mock SyncStateRepository layer for testing
 */
export const createMockSyncStateRepositoryLayer = (
  options: MockSyncStateRepositoryOptions = {},
): Layer.Layer<SyncStateRepositoryTag> => {
  // In-memory state for mock
  let currentState: SyncStateRecord | null = options.state ?? null;

  const mockService: SyncStateRepository = {
    getState: (channelId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Get state failed"));
      }
      if (currentState?.channelId === channelId) {
        return Effect.succeed(currentState);
      }
      return Effect.succeed(null);
    },

    getWatermark: (channelId) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Get watermark failed"));
      }
      if (options.watermark) {
        return Effect.succeed(options.watermark);
      }
      if (currentState?.channelId === channelId && currentState.lastSyncAt) {
        return Effect.succeed({
          lastSyncAt: currentState.lastSyncAt,
          metadata: currentState.metadata,
        });
      }
      return Effect.succeed(null);
    },

    recordSuccess: (channelId, stats) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Record success failed"));
      }
      currentState = {
        id: channelId,
        channelId,
        lastSyncAt: stats.syncedAt,
        lastSyncStatus: "success",
        errorMessage: null,
        syncedCount: stats.syncedCount,
        totalCount: stats.totalCount ?? 0,
        metadata: currentState?.metadata ?? null,
      };
      return Effect.succeed(undefined);
    },

    recordFailure: (channelId, error) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Record failure failed"));
      }
      currentState = {
        id: channelId,
        channelId,
        lastSyncAt: currentState?.lastSyncAt ?? null,
        lastSyncStatus: "failed",
        errorMessage: error,
        syncedCount: currentState?.syncedCount ?? 0,
        totalCount: currentState?.totalCount ?? 0,
        metadata: currentState?.metadata ?? null,
      };
      return Effect.succeed(undefined);
    },

    updateMetadata: (channelId, metadata) => {
      if (options.shouldFail) {
        return Effect.fail(new Error(options.failureMessage || "Update metadata failed"));
      }
      if (currentState?.channelId === channelId) {
        currentState = {
          ...currentState,
          metadata: { ...(currentState.metadata ?? {}), ...metadata },
        };
      } else {
        currentState = {
          id: channelId,
          channelId,
          lastSyncAt: null,
          lastSyncStatus: null,
          errorMessage: null,
          syncedCount: 0,
          totalCount: 0,
          metadata: metadata as SyncMetadata,
        };
      }
      return Effect.succeed(undefined);
    },
  };

  return Layer.succeed(SyncStateRepositoryTag, mockService);
};
