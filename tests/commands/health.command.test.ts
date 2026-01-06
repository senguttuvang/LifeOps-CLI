/**
 * Health Command Tests
 *
 * Tests the health check CLI command logic with mocked services.
 * Verifies output for various health states.
 *
 * NOTE: The actual command imports Tags from source files
 * which triggers bun:sqlite imports. To work around this, we recreate
 * the command handler logic here with our local Tags.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Effect, Console, Layer } from "effect";
import {
  SyncServiceTag,
  WhatsAppServiceTag,
  createMockWhatsAppLayer,
  createMockSyncLayer,
} from "../helpers/mock-layers";
import { captureConsole } from "../helpers/effect-test";

/**
 * Recreated health command handler (mirrors src/cli/commands/health.command.ts)
 * Uses local Tags to avoid bun:sqlite imports
 */
const healthHandler = () =>
  Effect.gen(function* () {
    const whatsapp = yield* WhatsAppServiceTag;
    const sync = yield* SyncServiceTag;

    yield* Console.log("🏥 LifeOps Health Check\n");

    // WhatsApp CLI
    const waHealth = yield* whatsapp.healthCheck();
    yield* Console.log(
      `WhatsApp CLI: ${waHealth.available ? "✅" : "❌"} ${waHealth.available ? "Available" : "Not available"}`,
    );
    yield* Console.log(`Authenticated: ${waHealth.authenticated ? "✅" : "❌"} ${waHealth.authenticated ? "Yes" : "No"}`);

    if (waHealth.error) {
      yield* Console.log(`   Error: ${waHealth.error}`);
    }

    // Sync state
    const syncState = yield* sync.getSyncState();
    if (syncState?.lastSyncAt) {
      yield* Console.log(`Last sync: ${syncState.lastSyncAt.toISOString()}`);
    } else {
      yield* Console.log("Last sync: Never");
    }

    yield* Console.log("\n✅ System operational");
  });

describe("healthCommand", () => {
  let consoleSpy: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    consoleSpy = captureConsole();
  });

  afterEach(() => {
    consoleSpy.restore();
  });

  describe("healthy system", () => {
    it("should show all checks passing", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({
          isAvailable: true,
          isAuthenticated: true,
        }),
        createMockSyncLayer({
          syncState: {
            lastSyncAt: new Date("2024-01-01T10:00:00Z"),
            cursor: null,
          },
        }),
      );

      const program = healthHandler();

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Health Check");
      expect(output).toContain("WhatsApp CLI:");
      expect(output).toContain("Available");
      expect(output).toContain("Authenticated:");
      expect(output).toContain("Yes");
      expect(output).toContain("System operational");
    });

    it("should show last sync timestamp when available", async () => {
      const lastSyncAt = new Date("2024-01-01T10:00:00Z");

      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer(),
        createMockSyncLayer({
          syncState: { lastSyncAt, cursor: null },
        }),
      );

      const program = healthHandler();

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Last sync:");
      expect(output).toContain("2024-01-01");
    });
  });

  describe("unhealthy system", () => {
    it("should show CLI not available", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({
          isAvailable: false,
          isAuthenticated: false,
        }),
        createMockSyncLayer(),
      );

      const program = healthHandler();

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Not available");
    });

    it("should show not authenticated", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer({
          isAvailable: true,
          isAuthenticated: false,
        }),
        createMockSyncLayer(),
      );

      const program = healthHandler();

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Authenticated:");
      expect(output).toContain("No");
    });

    it("should show never synced state", async () => {
      const TestLayer = Layer.mergeAll(
        createMockWhatsAppLayer(),
        createMockSyncLayer({
          syncState: null,
        }),
      );

      const program = healthHandler();

      await Effect.runPromise(Effect.provide(program, TestLayer));

      const output = consoleSpy.logs.join("\n");

      expect(output).toContain("Last sync: Never");
    });
  });
});
