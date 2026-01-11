#!/usr/bin/env bun

/**
 * LifeOps CLI Entry Point
 *
 * Unified CLI using @effect/cli for command parsing and help generation.
 * All commands are composable Effect-based operations with explicit dependencies.
 *
 * Architecture:
 * - Root command: lifeops
 * - Subcommands: sync, health, decode, remember, relationship, extract-*, import-android
 * - Layers: Infrastructure → Domain → CLI
 */

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { ForecastServiceLive } from "../domain/forecast";
import { ForecastRepositoryLive } from "../domain/forecast/forecast.repository";
import { AnalysisLive } from "../domain/relationship/analysis.service";
import { SignalExtractionLive } from "../domain/signals/signal-extraction.service";
import { SyncServiceLive } from "../domain/whatsapp/sync.service";
import { WhatsAppAdapterLive } from "../infrastructure/adapters/whatsapp/whatsapp.adapter";
import { AndroidImportServiceLive } from "../infrastructure/android/android-import.service";
import { DatabaseLive } from "../infrastructure/db/client";
import { SyncStateRepositoryLive } from "../infrastructure/db/sync-state.repository";
import { AILive } from "../infrastructure/llm/ai.service";
import { VectorStoreLive } from "../infrastructure/rag/vector.store";
import { WhatsAppServiceLive } from "../infrastructure/whatsapp/whatsapp.client";
// Commands
import { contactsCommand } from "./commands/contacts.command";
// Domain layers
// Infrastructure layers
import { decodeCommand } from "./commands/decode.command.js";
import { demoUiCommand } from "./commands/demo-ui.command.js";
import { doctorCommand } from "./commands/doctor.command";
import { extractEventsCommand } from "./commands/extract-events.command";
import { extractImageEventsCommand } from "./commands/extract-image-events.command";
import { extractSignalsCommand } from "./commands/extract-signals.command";
import { extractVisionEventsCommand } from "./commands/extract-vision-events.command";
import { healthCommand } from "./commands/health.command";
import { importAndroidCommand } from "./commands/import-android.command";
import { relationshipCommand } from "./commands/relationship.command";
import { rememberCommand } from "./commands/remember.command.js";
import { setupCommand } from "./commands/setup.command";
import { syncCommand } from "./commands/sync.command";

/**
 * Assemble all service layers
 *
 * Layer composition follows the hexagonal architecture:
 * Infrastructure (DB, WhatsApp, AI) → Domain (Sync, Analysis, Signals)
 */
// SyncStateRepositoryLive depends on DatabaseLive, so we provide it
const SyncStateRepoWithDeps = SyncStateRepositoryLive.pipe(Layer.provide(DatabaseLive));

const InfrastructureLive = Layer.mergeAll(
  DatabaseLive,
  SyncStateRepoWithDeps,
  WhatsAppServiceLive,
  WhatsAppAdapterLive,
  AndroidImportServiceLive,
  VectorStoreLive,
  AILive,
);

const DomainLive = Layer.mergeAll(
  SyncServiceLive,
  AnalysisLive,
  SignalExtractionLive,
  ForecastServiceLive,
  ForecastRepositoryLive,
);

const MainLive = DomainLive.pipe(Layer.provide(InfrastructureLive), Layer.merge(InfrastructureLive));

/**
 * Root CLI Command
 *
 * LifeOps - Relationship intelligence CLI.
 * "Because 'fine' rarely means fine"
 */
const lifeopsCommand = Command.make("lifeops").pipe(
  Command.withSubcommands([
    // Setup & Diagnostics
    setupCommand,
    doctorCommand,

    // Core commands
    syncCommand,
    contactsCommand,
    healthCommand,

    // Relationship Intelligence (Fun + Function)
    decodeCommand,
    rememberCommand,
    relationshipCommand,

    // RAG+Signals
    extractSignalsCommand,

    // Event Extraction
    extractEventsCommand,
    extractImageEventsCommand,
    extractVisionEventsCommand,

    // Import
    importAndroidCommand,

    // UI Demo (Ink)
    demoUiCommand,
  ]),
);

/**
 * Run the CLI
 *
 * The CLI application:
 * 1. Parses command-line arguments
 * 2. Routes to the appropriate subcommand
 * 3. Provides all required service layers
 * 4. Handles errors and exit codes
 */
const run = Command.run(lifeopsCommand, {
  name: "LifeOps CLI",
  version: "1.0.0",
});

// Execute with NodeRuntime
// Wrap in Effect.scoped to ensure scoped resources (like DatabaseLive) are properly released
// Use Effect.ensuring to force process exit after completion
run(process.argv).pipe(
  Effect.scoped,
  Effect.provide(MainLive),
  Effect.provide(NodeContext.layer),
  Effect.ensuring(
    Effect.sync(() => {
      // Force exit after CLI completes - prevents hanging from open handles
      setImmediate(() => process.exit(0));
    }),
  ),
  NodeRuntime.runMain,
);
