/**
 * Health Command
 *
 * Checks system health: WhatsApp CLI availability, authentication status, database.
 * Usage: bun run cli health
 */

import { Effect } from "effect";
import { SyncServiceTag } from "../../domain/whatsapp/sync.service";
import { WhatsAppServiceTag } from "../../infrastructure/whatsapp/whatsapp.client";

export const healthCommand = () =>
  Effect.gen(function* () {
    const whatsapp = yield* WhatsAppServiceTag;
    const sync = yield* SyncServiceTag;

    console.log("🏥 LifeOps Health Check\n");

    // WhatsApp CLI
    const waHealth = yield* whatsapp.healthCheck();
    console.log(
      `WhatsApp CLI: ${waHealth.available ? "✅" : "❌"} ${waHealth.available ? "Available" : "Not available"}`,
    );
    console.log(`Authenticated: ${waHealth.authenticated ? "✅" : "❌"} ${waHealth.authenticated ? "Yes" : "No"}`);

    if (waHealth.error) {
      console.log(`   Error: ${waHealth.error}`);
    }

    // Sync state
    const syncState = yield* sync.getSyncState();
    if (syncState?.lastSyncAt) {
      console.log(`Last sync: ${syncState.lastSyncAt.toISOString()}`);
    } else {
      console.log("Last sync: Never");
    }

    console.log("\n✅ System operational");
  });
