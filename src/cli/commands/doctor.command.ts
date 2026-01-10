/**
 * Doctor Command
 *
 * Comprehensive system health check for LifeOps CLI.
 * Verifies all prerequisites and dependencies are properly configured.
 *
 * Usage: bun run cli doctor
 */

import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  fix?: string;
}

/**
 * Check if a command exists and get its version
 */
const checkCommand = (
  name: string,
  command: string,
  installInstructions: Record<string, string>,
): Effect.Effect<CheckResult, never> =>
  Effect.tryPromise({
    try: async () => {
      const { stdout } = await execAsync(command);
      return {
        name,
        status: "pass" as const,
        message: stdout.trim().split("\n")[0],
      };
    },
    catch: () => ({
      name,
      status: "fail" as const,
      message: "Not installed",
      fix: Object.entries(installInstructions)
        .map(([os, cmd]) => `${os}: ${cmd}`)
        .join("\n"),
    }),
  }).pipe(Effect.catchAll((e) => Effect.succeed(e as CheckResult)));

/**
 * Check if a file exists
 */
const checkFile = (
  name: string,
  path: string,
  fixMessage: string,
): Effect.Effect<CheckResult, never> =>
  Effect.sync(() => {
    const exists = existsSync(path);
    return {
      name,
      status: exists ? ("pass" as const) : ("fail" as const),
      message: exists ? `Found at ${path}` : "Not found",
      fix: exists ? undefined : fixMessage,
    };
  });

/**
 * Check WhatsApp CLI binary
 */
const checkWhatsAppCli = (): Effect.Effect<CheckResult, never> => {
  const binPath = join(process.cwd(), "bin", "whatsmeow-cli");

  return Effect.tryPromise({
    try: async () => {
      if (!existsSync(binPath)) {
        return {
          name: "WhatsApp CLI Binary",
          status: "fail" as const,
          message: "Binary not found",
          fix: "cd tools/whatsmeow-cli && make install-local",
        };
      }

      const { stdout } = await execAsync(`"${binPath}" version`);
      return {
        name: "WhatsApp CLI Binary",
        status: "pass" as const,
        message: stdout.trim(),
      };
    },
    catch: (e) => ({
      name: "WhatsApp CLI Binary",
      status: "fail" as const,
      message: `Error: ${e}`,
      fix: "cd tools/whatsmeow-cli && make install-local",
    }),
  }).pipe(Effect.catchAll((e) => Effect.succeed(e as CheckResult)));
};

/**
 * Check WhatsApp authentication status
 */
const checkWhatsAppAuth = (): Effect.Effect<CheckResult, never> => {
  const binPath = join(process.cwd(), "bin", "whatsmeow-cli");

  return Effect.tryPromise({
    try: async () => {
      if (!existsSync(binPath)) {
        return {
          name: "WhatsApp Authentication",
          status: "warn" as const,
          message: "Skipped (binary not installed)",
        };
      }

      const { stdout } = await execAsync(`"${binPath}" health`);
      const health = JSON.parse(stdout);

      if (health.authenticated) {
        return {
          name: "WhatsApp Authentication",
          status: "pass" as const,
          message: "Authenticated",
        };
      }

      return {
        name: "WhatsApp Authentication",
        status: "warn" as const,
        message: "Not authenticated",
        fix: "bun run cli sync (then scan QR code)",
      };
    },
    catch: () => ({
      name: "WhatsApp Authentication",
      status: "warn" as const,
      message: "Could not check (binary error)",
      fix: "bun run cli sync (then scan QR code)",
    }),
  }).pipe(Effect.catchAll((e) => Effect.succeed(e as CheckResult)));
};

/**
 * Format check result for display
 */
const formatResult = (result: CheckResult): string => {
  const icon =
    result.status === "pass" ? "✅" : result.status === "warn" ? "⚠️ " : "❌";

  let output = `${icon} ${result.name}: ${result.message}`;

  if (result.fix) {
    output += `\n   Fix: ${result.fix.split("\n").join("\n        ")}`;
  }

  return output;
};

/**
 * Doctor Command
 *
 * Runs comprehensive system diagnostics to help users identify
 * and fix configuration issues.
 */
export const doctorCommand = Command.make("doctor", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("🩺 LifeOps Doctor - System Diagnostics\n");
    yield* Console.log("Checking prerequisites...\n");

    const results: CheckResult[] = [];

    // 1. Check Node.js/Bun
    const bunCheck = yield* checkCommand("Bun Runtime", "bun --version", {
      "All platforms": "curl -fsSL https://bun.sh/install | bash",
    });
    results.push(bunCheck);

    // 2. Check Go (required for building WhatsApp CLI)
    const goCheck = yield* checkCommand("Go Compiler", "go version", {
      macOS: "brew install go",
      Ubuntu: "sudo apt install golang-go",
      Windows: "choco install golang",
    });
    results.push(goCheck);

    // 3. Check SQLite (usually bundled, but verify)
    const sqliteCheck = yield* checkCommand(
      "SQLite",
      "sqlite3 --version",
      {
        macOS: "brew install sqlite3",
        Ubuntu: "sudo apt install sqlite3",
        Windows: "choco install sqlite",
      },
    );
    results.push(sqliteCheck);

    // 4. Check WhatsApp CLI binary
    const waCliCheck = yield* checkWhatsAppCli();
    results.push(waCliCheck);

    // 5. Check WhatsApp authentication
    const waAuthCheck = yield* checkWhatsAppAuth();
    results.push(waAuthCheck);

    // 6. Check data directories
    const dataDir = join(process.cwd(), "data");
    const dataDirCheck = yield* checkFile(
      "Data Directory",
      dataDir,
      "mkdir -p data",
    );
    results.push(dataDirCheck);

    // 7. Check .env file
    const envCheck = yield* checkFile(
      "Environment Config (.env)",
      join(process.cwd(), ".env"),
      "cp .env.example .env (then configure)",
    );
    results.push(envCheck);

    // Print results
    yield* Console.log("─────────────────────────────────────────────");
    for (const result of results) {
      yield* Console.log(formatResult(result));
    }
    yield* Console.log("─────────────────────────────────────────────\n");

    // Summary
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const warned = results.filter((r) => r.status === "warn").length;

    yield* Console.log(`Summary: ${passed} passed, ${warned} warnings, ${failed} failed`);

    if (failed > 0) {
      yield* Console.log("\n🔧 Fix the failed checks above, then run 'bun run cli doctor' again.");
      yield* Console.log("\nQuick Start:");
      yield* Console.log("  1. Install Go: brew install go (macOS) / apt install golang-go (Linux)");
      yield* Console.log("  2. Build CLI:  cd tools/whatsmeow-cli && make install-local");
      yield* Console.log("  3. Configure:  cp .env.example .env && edit .env");
      yield* Console.log("  4. Sync:       bun run cli sync (scan QR code)");
    } else if (warned > 0) {
      yield* Console.log("\n⚠️  Some optional components need attention. See warnings above.");
    } else {
      yield* Console.log("\n🎉 All checks passed! LifeOps is ready to use.");
      yield* Console.log("\nNext steps:");
      yield* Console.log("  bun run cli sync     # Sync WhatsApp messages");
      yield* Console.log("  bun run cli health   # Check system health");
      yield* Console.log("  bun run cli --help   # See all commands");
    }
  }),
);
