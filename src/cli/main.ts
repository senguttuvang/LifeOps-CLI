#!/usr/bin/env bun
/**
 * LifeOps CLI Entry Point
 *
 * Simple command dispatcher using Effect-TS.
 * Commands: sync, health
 */

import { Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";

// Infrastructure layers
import { DatabaseLive } from "../infrastructure/db/client";
import { WhatsAppServiceLive } from "../infrastructure/whatsapp/whatsapp.client";
import { WhatsAppAdapterLive } from "../infrastructure/adapters/whatsapp/whatsapp.adapter";
import { AndroidImportServiceLive } from "../infrastructure/android/android-import.service";

// Domain layers
import { SyncServiceLive } from "../domain/whatsapp/sync.service";

// Commands
import { syncCommand } from "./commands/sync.command";
import { healthCommand } from "./commands/health.command";
import { importAndroidCommand } from "./commands/import-android.command";

/**
 * Assemble all service layers
 * Merge all layers so they're all available to commands
 */
const MainLive = Layer.mergeAll(
  DatabaseLive,
  WhatsAppServiceLive,
  WhatsAppAdapterLive,
  AndroidImportServiceLive,
  SyncServiceLive.pipe(
    Layer.provide(DatabaseLive),
    Layer.provide(WhatsAppServiceLive),
    Layer.provide(WhatsAppAdapterLive)
  )
);

/**
 * Parse CLI arguments and dispatch to command
 */
const program = Effect.gen(function* () {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "sync": {
      const daysArg = args.find((arg) => arg.startsWith("--days="));
      const days = daysArg ? parseInt(daysArg.split("=")[1] || "30") : 30;
      yield* syncCommand({ days });
      break;
    }

    case "health": {
      yield* healthCommand();
      break;
    }

    case "import-android": {
      const dbArg = args.find((arg) => arg.startsWith("--db="));
      const limitArg = args.find((arg) => arg.startsWith("--limit="));

      if (!dbArg) {
        console.error("Error: --db argument is required");
        console.log("\nUsage: bun run cli import-android --db=\"/path/to/msgstore.db\" [--limit=1000]");
        process.exit(1);
      }

      const db = dbArg.split("=")[1]?.replace(/"/g, '');
      const limit = limitArg ? parseInt(limitArg.split("=")[1] || "0") : undefined;

      if (!db) {
        console.error("Error: Invalid --db path");
        process.exit(1);
      }

      yield* importAndroidCommand({ db, limit });
      break;
    }

    default: {
      console.log("LifeOps - Personal Relationship Management\n");
      console.log("Usage: bun run cli <command> [options]\n");
      console.log("Primary Commands:");
      console.log("  sync [--days=30]                Sync WhatsApp (iPhone + Android via QR code)");
      console.log("                                   • First time: Gets ALL message history");
      console.log("                                   • After: Real-time updates only");
      console.log("  health                          Check system health");
      console.log("\nDeveloper/Testing Commands:");
      console.log("  import-android --db=<path>      Import from Android msgstore.db backup");
      console.log("                 [--limit=1000]    (Not for end users - testing only)");
      console.log("\nHow It Works:");
      console.log("  1. Run 'bun run cli sync'");
      console.log("  2. Scan QR code with your phone (WhatsApp → Linked Devices)");
      console.log("  3. First sync downloads ALL your message history automatically");
      console.log("  4. Future syncs get only new messages");
      console.log("  5. All data stored locally in lifeops3.db");
      break;
    }
  }
});

/**
 * Run
 */
const run = program.pipe(Effect.provide(MainLive));

NodeRuntime.runMain(run);
