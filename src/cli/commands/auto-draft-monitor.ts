/**
 * Auto-Draft Monitor CLI Command
 *
 * Starts the auto-draft monitoring service for girlfriend's messages
 */

import { Effect, Layer } from "effect";
import { monitorAutoDraft } from "../../domain/whatsapp/auto-draft/auto-draft-monitor";
// Domain layers
import { SyncServiceLive } from "../../domain/whatsapp/sync.service";
import { AnalysisLive } from "../../domain/relationship/analysis.service";
import { WhatsAppAdapterLive } from "../../infrastructure/adapters/whatsapp/whatsapp.adapter";
import { AndroidImportServiceLive } from "../../infrastructure/android/android-import.service";
// Infrastructure layers
import { DatabaseLive } from "../../infrastructure/db/client";
import { WhatsAppServiceLive } from "../../infrastructure/whatsapp/whatsapp.client";
import { VectorStoreLive } from "../../infrastructure/rag/vector.store";
import { AILive } from "../../infrastructure/llm/ai.service";

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

const DomainLive = Layer.mergeAll(SyncServiceLive, AnalysisLive);

const MainLive = DomainLive.pipe(
  Layer.provide(InfrastructureLive),
  Layer.merge(InfrastructureLive)
);

/**
 * Start auto-draft monitor
 *
 * Usage: bun run src/cli/commands/auto-draft-monitor.ts
 *
 * Environment variables:
 * - GIRLFRIEND_CHAT_ID: Girlfriend's WhatsApp JID (e.g., "919876543210@s.whatsapp.net")
 * - GIRLFRIEND_NAME: Girlfriend's name for display (e.g., "Priya")
 * - SELF_CHAT_ID: Your WhatsApp JID (e.g., "919123456789@s.whatsapp.net")
 * - POLL_INTERVAL: Polling interval in seconds (default: 30)
 */
const main = () => {
  const girlfriendChatId = process.env.GIRLFRIEND_CHAT_ID;
  const girlfriendName = process.env.GIRLFRIEND_NAME || "Girlfriend";
  const selfChatId = process.env.SELF_CHAT_ID;

  if (!girlfriendChatId) {
    console.error("Error: GIRLFRIEND_CHAT_ID environment variable is required");
    console.error(
      'Example: GIRLFRIEND_CHAT_ID="919876543210@s.whatsapp.net" bun run src/cli/commands/auto-draft-monitor.ts'
    );
    process.exit(1);
  }

  if (!selfChatId) {
    console.error("Error: SELF_CHAT_ID environment variable is required");
    console.error(
      'Example: SELF_CHAT_ID="919123456789@s.whatsapp.net" bun run src/cli/commands/auto-draft-monitor.ts'
    );
    process.exit(1);
  }

  const pollInterval = process.env.POLL_INTERVAL
    ? Number.parseInt(process.env.POLL_INTERVAL, 10)
    : 30;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💬 LifeOps Auto-Draft Monitor");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Girlfriend: ${girlfriendName}`);
  console.log(`Chat ID: ${girlfriendChatId}`);
  console.log(`Self-DM: ${selfChatId}`);
  console.log(`Poll Interval: ${pollInterval} seconds`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n📱 Monitoring messages from ${girlfriendName}...`);
  console.log("🤖 Auto-drafting replies to your Self-DM");
  console.log("\nPress Ctrl+C to stop");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return monitorAutoDraft({
    girlfriendChatId,
    girlfriendName,
    selfChatId,
    pollIntervalSeconds: pollInterval,
    verbose: true,
  }).pipe(Effect.provide(MainLive));
};

// Run the program
Effect.runPromise(main()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
