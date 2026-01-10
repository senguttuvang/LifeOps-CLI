/**
 * Setup Command
 *
 * Interactive setup wizard for LifeOps CLI.
 * Guides new users through the complete setup process.
 *
 * Usage: bun run cli setup
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

const execAsync = promisify(exec);

/**
 * Check if Go is installed
 */
const isGoInstalled = (): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: async () => {
      await execAsync("go version");
      return true;
    },
    catch: () => false,
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));

/**
 * Check if WhatsApp CLI binary exists
 */
const isCliBuilt = (): Effect.Effect<boolean, never> =>
  Effect.sync(() => existsSync(join(process.cwd(), "bin", "whatsmeow-cli")));

/**
 * Check if data directory exists
 */
const isDataDirReady = (): Effect.Effect<boolean, never> =>
  Effect.sync(() => existsSync(join(process.cwd(), "data")));

/**
 * Check if .env exists
 */
const isEnvConfigured = (): Effect.Effect<boolean, never> =>
  Effect.sync(() => existsSync(join(process.cwd(), ".env")));

/**
 * Check if WhatsApp is authenticated
 */
const isWhatsAppAuthenticated = (): Effect.Effect<boolean, never> => {
  const binPath = join(process.cwd(), "bin", "whatsmeow-cli");

  return Effect.tryPromise({
    try: async () => {
      if (!existsSync(binPath)) return false;
      const { stdout } = await execAsync(`"${binPath}" health`);
      const health = JSON.parse(stdout);
      return health.authenticated === true;
    },
    catch: () => false,
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
};

/**
 * Print instructions for Go installation (platform-aware)
 */
const showGoInstallInstructions = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Console.log("\n📦 Go Installation Required\n");
    yield* Console.log("Go is needed to build the WhatsApp CLI. Install it with:\n");

    const platform = process.platform;

    if (platform === "darwin") {
      yield* Console.log("  brew install go\n");
      yield* Console.log("Or download from: https://go.dev/dl/");
    } else if (platform === "linux") {
      yield* Console.log("  Ubuntu/Debian: sudo apt install golang-go");
      yield* Console.log("  Fedora:        sudo dnf install golang");
      yield* Console.log("  Arch:          sudo pacman -S go\n");
      yield* Console.log("Or download from: https://go.dev/dl/");
    } else if (platform === "win32") {
      yield* Console.log("  choco install golang\n");
      yield* Console.log("Or download from: https://go.dev/dl/");
    } else {
      yield* Console.log("  Download from: https://go.dev/dl/");
    }

    yield* Console.log("\nAfter installing Go, run 'bun run cli setup' again.");
  });

/**
 * Build WhatsApp CLI binary
 */
const buildWhatsAppCli = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Console.log("\n🔨 Building WhatsApp CLI...\n");

    const toolsDir = join(process.cwd(), "tools", "whatsmeow-cli");

    if (!existsSync(toolsDir)) {
      yield* Console.log("❌ WhatsApp CLI source not found at tools/whatsmeow-cli/");
      yield* Console.log("   Please ensure the repository is complete.");
      return;
    }

    yield* Console.log("Running: cd tools/whatsmeow-cli && make install-local\n");

    yield* Effect.tryPromise({
      try: async () => {
        const { stdout, stderr } = await execAsync("make install-local", {
          cwd: toolsDir,
          timeout: 120000, // 2 minute timeout for build
        });

        console.log(stdout);
        if (stderr) console.error(stderr);
      },
      catch: (e) => new Error(`Build failed: ${e}`),
    }).pipe(
      Effect.catchAll((e) => {
        console.error(e.message);
        return Effect.void;
      }),
    );

    // Verify build succeeded
    const built = existsSync(join(process.cwd(), "bin", "whatsmeow-cli"));
    if (built) {
      yield* Console.log("\n✅ WhatsApp CLI built successfully!");
    } else {
      yield* Console.log("\n❌ Build may have failed. Check the output above.");
    }
  });

/**
 * Create data directory
 */
const createDataDir = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    const dataDir = join(process.cwd(), "data");
    const whatsappDir = join(dataDir, "whatsapp");

    mkdirSync(dataDir, { recursive: true });
    mkdirSync(whatsappDir, { recursive: true });

    console.log("\n✅ Data directories created:");
    console.log(`   ${dataDir}`);
    console.log(`   ${whatsappDir}`);
  });

/**
 * Create .env from .env.example
 */
const createEnvFile = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    const envPath = join(process.cwd(), ".env");
    const examplePath = join(process.cwd(), ".env.example");

    if (existsSync(examplePath)) {
      copyFileSync(examplePath, envPath);
      console.log("\n✅ Created .env from .env.example");
      console.log("   Review and update the configuration as needed.");
    } else {
      // Create minimal .env
      const minimalEnv = `# LifeOps CLI Configuration
# See README.md for full documentation

# Data directory (relative to project root)
DATA_DIR=./data

# WhatsApp session directory
WHATSAPP_SESSION_DIR=./data/whatsapp

# Optional: AI features (get key from https://console.anthropic.com)
# ANTHROPIC_API_KEY=sk-ant-...
`;
      writeFileSync(envPath, minimalEnv);
      console.log("\n✅ Created minimal .env file");
      console.log("   Add your API keys for AI features.");
    }
  });

/**
 * Setup Command
 *
 * Interactive wizard that guides users through complete setup.
 */
export const setupCommand = Command.make("setup", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("🚀 LifeOps CLI Setup Wizard\n");
    yield* Console.log("This wizard will help you set up LifeOps CLI.\n");
    yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Step 1: Check Go
    yield* Console.log("Step 1/5: Checking Go installation...");
    const hasGo = yield* isGoInstalled();

    if (!hasGo) {
      yield* showGoInstallInstructions();
      return;
    }

    yield* Console.log("  ✅ Go is installed\n");

    // Step 2: Build WhatsApp CLI
    yield* Console.log("Step 2/5: WhatsApp CLI binary...");
    const hasCliBinary = yield* isCliBuilt();

    if (!hasCliBinary) {
      yield* Console.log("  ⏳ Building WhatsApp CLI (this may take a minute)...");
      yield* buildWhatsAppCli();
    } else {
      yield* Console.log("  ✅ WhatsApp CLI is already built\n");
    }

    // Step 3: Data directory
    yield* Console.log("Step 3/5: Data directory...");
    const hasDataDir = yield* isDataDirReady();

    if (!hasDataDir) {
      yield* createDataDir();
    } else {
      yield* Console.log("  ✅ Data directory exists\n");
    }

    // Step 4: Environment configuration
    yield* Console.log("Step 4/5: Environment configuration...");
    const hasEnv = yield* isEnvConfigured();

    if (!hasEnv) {
      yield* createEnvFile();
    } else {
      yield* Console.log("  ✅ .env file exists\n");
    }

    // Step 5: WhatsApp authentication
    yield* Console.log("Step 5/5: WhatsApp authentication...");
    const isAuthenticated = yield* isWhatsAppAuthenticated();

    if (!isAuthenticated) {
      yield* Console.log("  ⚠️  Not authenticated with WhatsApp\n");
      yield* Console.log("Would you like to authenticate now? (This requires scanning a QR code)\n");
      yield* Console.log("Run 'bun run cli sync' when ready to authenticate.\n");
    } else {
      yield* Console.log("  ✅ WhatsApp is authenticated\n");
    }

    // Summary
    yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    yield* Console.log("🎉 Setup Complete!\n");
    yield* Console.log("Next steps:");
    yield* Console.log("  1. Run 'bun run cli sync' to sync WhatsApp messages");
    yield* Console.log("  2. Run 'bun run cli health' to verify system status");
    yield* Console.log("  3. Run 'bun run cli --help' to see all available commands\n");
    yield* Console.log("For troubleshooting, run 'bun run cli doctor'");
  }),
);
