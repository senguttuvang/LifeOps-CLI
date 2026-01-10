/**
 * Health Command
 *
 * Checks system health: WhatsApp CLI availability, authentication status, database.
 * Usage: bun run cli health
 */

import { Command } from "@effect/cli";
import { Effect, Console } from "effect";
import { SyncServiceTag } from "../../domain/whatsapp/sync.service";
import { WhatsAppServiceTag } from "../../infrastructure/whatsapp/whatsapp.client";

/**
 * Health Command - @effect/cli based
 *
 * Displays system health status for LifeOps components.
 */
export const healthCommand = Command.make(
  "health",
  {},
  () =>
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
    }),
);
