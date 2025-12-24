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

// Domain layers
import { SyncServiceLive } from "../domain/whatsapp/sync.service";

// Commands
import { syncCommand } from "./commands/sync.command";
import { healthCommand } from "./commands/health.command";

/**
 * Assemble all service layers
 * Merge all layers so they're all available to commands
 */
const MainLive = Layer.mergeAll(
  DatabaseLive,
  WhatsAppServiceLive,
  SyncServiceLive.pipe(Layer.provide(DatabaseLive), Layer.provide(WhatsAppServiceLive))
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

    default: {
      console.log("LifeOps - Personal Relationship Management\n");
      console.log("Usage: bun run cli <command> [options]\n");
      console.log("Commands:");
      console.log("  sync [--days=30]  Sync WhatsApp messages");
      console.log("  health            Check system health");
      break;
    }
  }
});

/**
 * Run
 */
const run = program.pipe(Effect.provide(MainLive));

NodeRuntime.runMain(run);
