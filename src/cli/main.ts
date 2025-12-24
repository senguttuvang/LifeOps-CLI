#!/usr/bin/env bun
/**
 * LifeOps CLI Entry Point
 *
 * Simplified entry point - commands will be added in subsequent batches.
 * For now, just verify the infrastructure layers load correctly.
 */

import { Effect, Layer } from "effect";
import { NodeRuntime } from "@effect/platform-node";

// Infrastructure layers
import { DatabaseLive } from "../infrastructure/db/client";
import { WhatsAppServiceLive } from "../infrastructure/whatsapp/whatsapp.client";

// Domain layers
import { SyncServiceLive } from "../domain/whatsapp/sync.service";

/**
 * Assemble all service layers
 * SyncServiceLive depends on DatabaseLive and WhatsAppServiceLive,
 * so we provide those dependencies first
 */
const MainLive = SyncServiceLive.pipe(
  Layer.provide(DatabaseLive),
  Layer.provide(WhatsAppServiceLive)
);

/**
 * Simple test program
 */
const program = Effect.gen(function* () {
  console.log("✓ LifeOps infrastructure loaded successfully");
  console.log("Commands will be added in next batches");
});

/**
 * Run
 */
const run = program.pipe(Effect.provide(MainLive));

NodeRuntime.runMain(run);
