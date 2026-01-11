/**
 * Sync Command
 *
 * Two-phase WhatsApp sync:
 * 1. Dump all messages from WhatsApp (Go CLI)
 * 2. User selects contacts interactively with Ink UI
 * 3. Import selected to SQLite
 *
 * Usage: bun run cli sync [--all] [--keep-dump]
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import React from "react";
import { render } from "ink";

import {
  ContactDiscoveryServiceLive,
  ContactDiscoveryService,
  DumpAdapterService,
  DumpAdapterServiceLive,
  SYNC_PATHS,
  type ContactSummary,
  type DumpCommandResult,
} from "../../domain/sync";
import { ContactSelector } from "../components/ContactSelector";
import { ImportProgress } from "../components/ImportProgress";
import { SyncServiceTag } from "../../domain/whatsapp/sync.service";

const execAsync = promisify(exec);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Run the Go CLI dump command
 */
const runDumpCommand = (): Effect.Effect<DumpCommandResult, Error> =>
  Effect.tryPromise({
    try: async () => {
      const binPath = join(process.cwd(), SYNC_PATHS.cliBinary);

      if (!existsSync(binPath)) {
        throw new Error(
          `WhatsApp CLI not found at ${binPath}. Run 'bun run cli setup' first.`
        );
      }

      console.log("\n📥 Running WhatsApp dump (this may take up to 60 seconds)...\n");

      const { stdout, stderr } = await execAsync(`"${binPath}" dump`, {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large histories
      });

      // stderr has progress messages, stdout has JSON result
      if (stderr) {
        console.log(stderr);
      }

      const result = JSON.parse(stdout) as DumpCommandResult;
      return result;
    },
    catch: (error) =>
      new Error(
        `Dump failed: ${error instanceof Error ? error.message : String(error)}`
      ),
  });

/**
 * Run Ink contact selector UI
 */
const runContactSelector = (
  contacts: ContactSummary[]
): Effect.Effect<string[], Error> =>
  Effect.async((resume) => {
    let instance: ReturnType<typeof render> | null = null;

    const handleSelect = (selectedJids: string[]) => {
      if (instance) {
        instance.unmount();
      }
      resume(Effect.succeed(selectedJids));
    };

    const handleCancel = () => {
      if (instance) {
        instance.unmount();
      }
      resume(Effect.fail(new Error("Selection cancelled by user")));
    };

    instance = render(
      React.createElement(ContactSelector, {
        contacts,
        onSelect: handleSelect,
        onCancel: handleCancel,
      })
    );

    // Cleanup function
    return Effect.sync(() => {
      if (instance) {
        instance.unmount();
      }
    });
  });

/**
 * Wrapper for import operation with animated progress UI
 */
interface ImportStats {
  contactsAdded: number;
  conversationsAdded: number;
  messagesAdded: number;
  syncedAt: Date;
}

const runImportWithProgress = (
  totalContacts: number,
  totalMessages: number,
  importFn: () => Effect.Effect<ImportStats, Error>,
): Effect.Effect<ImportStats, Error> =>
  Effect.async((resume) => {
    let instance: ReturnType<typeof render> | null = null;

    // Start with importing phase
    instance = render(
      React.createElement(ImportProgress, {
        totalContacts,
        totalMessages,
        phase: "importing",
      })
    );

    // Run the actual import
    Effect.runPromise(importFn())
      .then((stats) => {
        // Update to complete phase
        if (instance) {
          instance.rerender(
            React.createElement(ImportProgress, {
              totalContacts,
              totalMessages,
              phase: "complete",
              stats: {
                contactsImported: stats.contactsAdded,
                messagesImported: stats.messagesAdded,
                conversationsImported: stats.conversationsAdded,
              },
            })
          );
          // Keep visible for a moment, then unmount
          setTimeout(() => {
            if (instance) {
              instance.unmount();
            }
            resume(Effect.succeed(stats));
          }, 1000);
        }
      })
      .catch((error) => {
        // Update to error phase
        if (instance) {
          instance.rerender(
            React.createElement(ImportProgress, {
              totalContacts,
              totalMessages,
              phase: "error",
              error: error instanceof Error ? error.message : String(error),
            })
          );
          setTimeout(() => {
            if (instance) {
              instance.unmount();
            }
            resume(Effect.fail(error));
          }, 2000);
        }
      });

    // Cleanup function
    return Effect.sync(() => {
      if (instance) {
        instance.unmount();
      }
    });
  });

// =============================================================================
// SYNC COMMAND
// =============================================================================

export const syncCommand = Command.make(
  "sync",
  {
    all: Options.boolean("all").pipe(
      Options.withDescription("Import all contacts without selection"),
      Options.withDefault(false),
    ),
    keepDump: Options.boolean("keep-dump").pipe(
      Options.withDescription("Keep the temporary dump file after import"),
      Options.withDefault(false),
    ),
    skipDump: Options.boolean("skip-dump").pipe(
      Options.withDescription("Skip dump phase and use existing dump file"),
      Options.withDefault(false),
    ),
  },
  ({ all, keepDump, skipDump }) =>
    Effect.gen(function* () {
      const discovery = yield* ContactDiscoveryService;
      const adapter = yield* DumpAdapterService;

      // Phase 1: Check for existing dump or run dump command
      const hasDump = yield* discovery.hasDump();

      if (!hasDump && skipDump) {
        yield* Console.log("❌ No dump file found. Run sync without --skip-dump first.");
        return;
      }

      if (!hasDump || !skipDump) {
        if (hasDump && !skipDump) {
          yield* Console.log("ℹ️  Found existing dump. Running fresh dump...");
        }

        yield* Console.log("📥 Phase 1: Dumping all WhatsApp messages...\n");

        const dumpResult = yield* runDumpCommand();

        if (!dumpResult.success) {
          yield* Console.log("❌ Dump failed. Check the output above.");
          return;
        }

        yield* Console.log(
          `\n✅ Dumped ${dumpResult.totalMessages} messages from ${dumpResult.contactCount} contacts`
        );
      } else {
        yield* Console.log("📂 Using existing dump file...");
      }

      // Phase 2: Load dump and show contacts
      yield* Console.log("\n📱 Phase 2: Contact Selection\n");

      const dump = yield* discovery.loadDump();
      const summaries = yield* discovery.getContactSummaries(dump);

      yield* Console.log(`Found ${summaries.length} conversations.\n`);

      let selectedJids: string[];

      if (all) {
        // --all flag: import everything
        selectedJids = summaries.map((c) => c.jid);
        yield* Console.log(`Importing all ${selectedJids.length} contacts.`);
      } else {
        // Interactive Ink selection
        selectedJids = yield* runContactSelector(summaries);

        if (selectedJids.length === 0) {
          yield* Console.log("No contacts selected. Exiting.");
          return;
        }

        yield* Console.log(`\n✅ Selected ${selectedJids.length} contacts for import.`);
      }

      // Phase 3: Import to SQLite
      yield* Console.log("\n💾 Phase 3: Importing to database...\n");

      // Convert dump to WhatsAppSyncResult format
      const whatsappData = yield* adapter.convertDump(dump, selectedJids);

      // Get syncService outside the closure to avoid Effect context issues
      const syncService = yield* SyncServiceTag;

      // Run import with animated progress UI
      const stats = yield* runImportWithProgress(
        whatsappData.chats.length,
        whatsappData.messages.length,
        () => syncService.syncFromData(whatsappData),
      );

      yield* Console.log(`   • Synced at: ${stats.syncedAt.toISOString()}`);

      // Cleanup
      if (!keepDump) {
        yield* Console.log("\nℹ️  Dump file kept at whatsapp-raw/dump.json. Use --keep-dump=false to auto-delete.");
      }

      yield* Console.log("\n✅ Sync complete!");
    }).pipe(
      Effect.provide(ContactDiscoveryServiceLive),
      Effect.provide(DumpAdapterServiceLive),
      Effect.catchAll((error) =>
        Console.log(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`)
      ),
    ),
);
