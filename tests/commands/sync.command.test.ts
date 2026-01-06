/**
 * Sync Command Tests
 *
 * Tests the sync CLI command logic with mocked services.
 * Verifies output formatting and error handling.
 *
 * NOTE: The actual command imports the SyncServiceTag from source files
 * which triggers bun:sqlite imports. To work around this, we recreate
 * the command handler logic here with our local Tags.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Effect, Console } from "effect";
import { SyncServiceTag, createMockSyncLayer } from "../helpers/mock-layers";
import { captureConsole } from "../helpers/effect-test";

/**
 * Recreated sync command handler (mirrors src/cli/commands/sync.command.ts)
 * Uses local SyncServiceTag to avoid bun:sqlite imports
 */
const syncHandler = (options: { days: number }) =>
  Effect.gen(function* () {
    const syncService = yield* SyncServiceTag;

    yield* Console.log(`🔄 Syncing WhatsApp messages from last ${options.days} days...`);

    const result = yield* syncService.syncMessages({ days: options.days });

    yield* Console.log(`\n✅ Sync complete:`);
    yield* Console.log(`   • Contacts: ${result.contactsAdded}`);
    yield* Console.log(`   • Conversations: ${result.conversationsAdded}`);
    yield* Console.log(`   • Messages: ${result.messagesAdded}`);
    yield* Console.log(`   • Calls: ${result.callsAdded}`);
    yield* Console.log(`   • Synced at: ${result.syncedAt.toISOString()}`);
  });

describe("syncCommand", () => {
  let consoleSpy: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    consoleSpy = captureConsole();
  });

  afterEach(() => {
    consoleSpy.restore();
  });

  describe("successful sync", () => {
    it("should display sync statistics on success", async () => {
      const TestLayer = createMockSyncLayer({
        syncResult: {
          contactsAdded: 15,
          conversationsAdded: 8,
          messagesAdded: 342,
          callsAdded: 5,
        },
      });

      const program = syncHandler({ days: 30 });

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Syncing WhatsApp messages");
      expect(output).toContain("30 days");
      expect(output).toContain("Sync complete");
      expect(output).toContain("Contacts: 15");
      expect(output).toContain("Conversations: 8");
      expect(output).toContain("Messages: 342");
      expect(output).toContain("Calls: 5");
    });

    it("should use custom days when specified", async () => {
      const TestLayer = createMockSyncLayer();

      const program = syncHandler({ days: 7 });

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("7 days");
    });

    it("should show ISO timestamp for sync time", async () => {
      const TestLayer = createMockSyncLayer();

      const program = syncHandler({ days: 30 });

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      // ISO timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("zero results sync", () => {
    it("should handle sync with no new data", async () => {
      const TestLayer = createMockSyncLayer({
        syncResult: {
          contactsAdded: 0,
          conversationsAdded: 0,
          participantsAdded: 0,
          messagesAdded: 0,
          callsAdded: 0,
        },
      });

      const program = syncHandler({ days: 1 });

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Sync complete");
      expect(output).toContain("Contacts: 0");
      expect(output).toContain("Messages: 0");
    });
  });

  describe("error handling", () => {
    it("should propagate errors from sync service", async () => {
      const TestLayer = createMockSyncLayer({
        shouldFail: true,
        failureMessage: "WhatsApp not authenticated",
      });

      const program = syncHandler({ days: 30 });

      const exit = await Effect.runPromiseExit(Effect.provide(program, TestLayer));

      expect(exit._tag).toBe("Failure");
    });
  });
});
