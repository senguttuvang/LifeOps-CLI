/**
 * Self-DM Monitor CLI Command
 *
 * Starts the self-DM command monitoring service
 */

import { Effect } from "effect";
import { WhatsAppServiceLive } from "../../infrastructure/whatsapp/whatsapp.client";
import { monitorSelfDM } from "../../domain/whatsapp/commands/monitor";

/**
 * Start self-DM monitor
 *
 * Usage: bun run src/cli/commands/self-dm-monitor.ts
 *
 * Environment variables:
 * - SELF_CHAT_ID: Your WhatsApp JID (e.g., "1234567890@s.whatsapp.net")
 * - POLL_INTERVAL: Polling interval in seconds (default: 5)
 */
const main = () => {
  const selfChatId = process.env.SELF_CHAT_ID;

  if (!selfChatId) {
    console.error("Error: SELF_CHAT_ID environment variable is required");
    console.error(
      'Example: SELF_CHAT_ID="1234567890@s.whatsapp.net" bun run src/cli/commands/self-dm-monitor.ts'
    );
    process.exit(1);
  }

  const pollInterval = process.env.POLL_INTERVAL
    ? Number.parseInt(process.env.POLL_INTERVAL, 10)
    : 5;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🤖 LifeOps Self-DM Monitor");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Self-DM Chat ID: ${selfChatId}`);
  console.log(`Poll Interval: ${pollInterval} seconds`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Monitoring for @lifeops commands...");
  console.log("Press Ctrl+C to stop");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return monitorSelfDM({
    selfChatId,
    pollIntervalSeconds: pollInterval,
    verbose: true,
  }).pipe(Effect.provide(WhatsAppServiceLive));
};

// Run the program
Effect.runPromise(main()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
