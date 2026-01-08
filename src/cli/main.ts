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

// Commands
import { syncCommand } from "./commands/sync.command";
import { healthCommand } from "./commands/health.command";
import { decodeCommand } from "./commands/decode.command";
import { rememberCommand } from "./commands/remember.command";
import { relationshipCommand } from "./commands/relationship.command";
import { extractSignalsCommand } from "./commands/extract-signals.command";
import { extractEventsCommand } from "./commands/extract-events.command";
import { extractImageEventsCommand } from "./commands/extract-image-events.command";
import { extractVisionEventsCommand } from "./commands/extract-vision-events.command";
import { importAndroidCommand } from "./commands/import-android.command";
import { demoUiCommand } from "./commands/demo-ui.command.js";

// Domain layers
import { SyncServiceLive } from "../domain/whatsapp/sync.service";
import { AnalysisLive } from "../domain/relationship/analysis.service";
import { SignalExtractionLive } from "../domain/signals/signal-extraction.service";

// Infrastructure layers
import { DatabaseLive } from "../infrastructure/db/client";
import { WhatsAppServiceLive } from "../infrastructure/whatsapp/whatsapp.client";
import { WhatsAppAdapterLive } from "../infrastructure/adapters/whatsapp/whatsapp.adapter";
import { AndroidImportServiceLive } from "../infrastructure/android/android-import.service";
import { VectorStoreLive } from "../infrastructure/rag/vector.store";
import { AILive } from "../infrastructure/llm/ai.service";

/**
 * Assemble all service layers
 *
 * Layer composition follows the hexagonal architecture:
 * Infrastructure (DB, WhatsApp, AI) → Domain (Sync, Analysis, Signals)
 */
const InfrastructureLive = Layer.mergeAll(
  DatabaseLive,
  WhatsAppServiceLive,
  WhatsAppAdapterLive,
  AndroidImportServiceLive,
  VectorStoreLive,
  AILive,
);

const DomainLive = Layer.mergeAll(SyncServiceLive, AnalysisLive, SignalExtractionLive);

const MainLive = DomainLive.pipe(Layer.provide(InfrastructureLive), Layer.merge(InfrastructureLive));

/**
 * Root CLI Command
 *
 * LifeOps - Relationship intelligence CLI.
 * "Because 'fine' rarely means fine"
 */
const lifeopsCommand = Command.make("lifeops").pipe(
  Command.withSubcommands([
    // Core commands
    syncCommand,
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
run(process.argv).pipe(
  Effect.provide(MainLive),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
