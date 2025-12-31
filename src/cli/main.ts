#!/usr/bin/env bun

/**
 * LifeOps-Relationship CLI Entry Point
 *
 * Simple command dispatcher using Effect-TS.
 * Commands: sync, health, decode, remember, situation
 *
 * Pure commands (decode, remember) run without service initialization.
 * Service-dependent commands (sync, health, etc.) require full layer setup.
 */

import { Effect } from "effect";

// Check command early to avoid unnecessary service initialization
const args = process.argv.slice(2);
const command = args[0];

// Pure commands - no service dependencies
const PURE_COMMANDS = ["decode", "remember"];

if (PURE_COMMANDS.includes(command ?? "")) {
  runPureCommand(command!, args);
} else {
  runServiceCommand();
}

/**
 * Run pure commands that don't need service layers
 */
async function runPureCommand(cmd: string, cmdArgs: string[]) {
  switch (cmd) {
    case "decode": {
      const { decodeCommand } = await import("./commands/decode.command");
      const message = cmdArgs.slice(1).join(" ");
      await Effect.runPromise(decodeCommand(message));
      break;
    }
    case "remember": {
      const { rememberCommand } = await import("./commands/remember.command");
      const content = cmdArgs.slice(1).join(" ");
      await Effect.runPromise(rememberCommand(content));
      break;
    }
  }
}

/**
 * Run service-dependent commands with full layer initialization
 */
async function runServiceCommand() {
  // Dynamic imports to avoid loading services for pure commands
  const { NodeRuntime } = await import("@effect/platform-node");
  const { Command } = await import("@effect/cli");
  const { Layer } = await import("effect");

  // Domain layers
  const { SyncServiceLive } = await import("../domain/whatsapp/sync.service");
  const { AnalysisLive } = await import("../domain/relationship/analysis.service");
  const { SignalExtractionLive } = await import("../domain/signals/signal-extraction.service");
  const { WhatsAppAdapterLive } = await import("../infrastructure/adapters/whatsapp/whatsapp.adapter");
  const { AndroidImportServiceLive } = await import("../infrastructure/android/android-import.service");

  // Infrastructure layers
  const { DatabaseLive } = await import("../infrastructure/db/client");
  const { WhatsAppServiceLive } = await import("../infrastructure/whatsapp/whatsapp.client");
  const { VectorStoreLive } = await import("../infrastructure/rag/vector.store");
  const { AILive } = await import("../infrastructure/llm/ai.service");

  // Commands
  const { extractEventsCommand } = await import("./commands/extract-events.command");
  const { extractImageEventsCommand } = await import("./commands/extract-image-events.command");
  const { extractVisionEventsCommand } = await import("./commands/extract-vision-events.command");
  const { extractSignalsCommand } = await import("./commands/extract-signals.command");
  const { healthCommand } = await import("./commands/health.command");
  const { importAndroidCommand } = await import("./commands/import-android.command");
  const { relationshipCommand } = await import("./commands/relationship.command");
  const { syncCommand } = await import("./commands/sync.command");

  /**
   * Assemble all service layers
   */
  const InfrastructureLive = Layer.mergeAll(
    DatabaseLive,
    WhatsAppServiceLive,
    WhatsAppAdapterLive,
    AndroidImportServiceLive,
    VectorStoreLive,
    AILive
  );

  const DomainLive = Layer.mergeAll(SyncServiceLive, AnalysisLive, SignalExtractionLive);

  const MainLive = DomainLive.pipe(Layer.provide(InfrastructureLive), Layer.merge(InfrastructureLive));

  /**
   * Parse CLI arguments and dispatch to command
   */
  const program = Effect.gen(function* () {
    switch (command) {
      case "sync": {
        const daysArg = args.find((arg) => arg.startsWith("--days="));
        const days = daysArg ? Number.parseInt(daysArg.split("=")[1] || "30", 10) : 30;
        yield* syncCommand({ days });
        break;
      }

      case "health": {
        yield* healthCommand();
        break;
      }

      case "relationship": {
        yield* Command.run(relationshipCommand, {
          name: "LifeOps-Relationship",
          version: "1.0.0",
        })(args);
        break;
      }

      case "import-android": {
        const dbArg = args.find((arg) => arg.startsWith("--db="));
        const limitArg = args.find((arg) => arg.startsWith("--limit="));

        if (!dbArg) {
          console.error("Error: --db argument is required");
          console.log('\nUsage: bun run cli import-android --db="/path/to/msgstore.db" [--limit=1000]');
          process.exit(1);
        }

        const db = dbArg.split("=")[1]?.replace(/"/g, "");
        const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] || "0", 10) : undefined;

        if (!db) {
          console.error("Error: Invalid --db path");
          process.exit(1);
        }

        yield* importAndroidCommand({ db, limit });
        break;
      }

      case "extract-events": {
        yield* extractEventsCommand();
        break;
      }

      case "extract-image-events": {
        yield* extractImageEventsCommand();
        break;
      }

      case "extract-vision-events": {
        yield* extractVisionEventsCommand();
        break;
      }

      case "extract-signals": {
        yield* Command.run(extractSignalsCommand, {
          name: "LifeOps-Relationship",
          version: "1.0.0",
        })(args);
        break;
      }

      default: {
        console.log("LifeOps-Relationship - Because relationships need observability too\n");
        console.log("Usage: bun run cli <command> [options]\n");
        console.log("Primary Commands:");
        console.log("  sync [--days=30]                Sync WhatsApp (iPhone + Android via QR code)");
        console.log("                                   • First time: Gets ALL message history");
        console.log("                                   • After: Real-time updates only");
        console.log("  relationship analyze <chatId>   Analyze relationship health with a contact");
        console.log("  relationship draft <chatId> <intent> Draft a response based on history");
        console.log("  health                          Check system health");
        console.log("\nRelationship Intelligence (Fun + Function):");
        console.log('  decode <message>                Decode ambiguous messages ("I\'m fine" etc)');
        console.log("  remember <content>              Capture something to remember about partner");
        console.log("  situation <topic>               Get context on recurring conversation topics");
        console.log("\nRAG+Signals (Personalization):");
        console.log("  extract-signals <userId>        Extract behavioral signals from message history");
        console.log("                 [--refresh]       Force recompute signals");
        console.log("\nEvent Extraction:");
        console.log("  extract-events                  Extract events from text messages");
        console.log("  extract-image-events            Extract events from image captions");
        console.log("  extract-vision-events           Extract events from actual images (vision AI)");
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
   * Run with all service layers
   */
  const run = program.pipe(Effect.provide(MainLive));
  NodeRuntime.runMain(run);
}
