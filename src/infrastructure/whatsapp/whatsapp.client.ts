/**
 * WhatsApp CLI Adapter (Effect-TS)
 *
 * Wrapper around the whatsmeow-cli Go binary using Effect-TS patterns.
 * Converts the NestJS Injectable pattern to Effect Context.Tag for:
 * - Explicit dependencies in type signatures
 * - Explicit errors in type signatures
 * - Testability via Layer substitution
 *
 * The Go binary is the anti-corruption layer - it handles all WhatsApp protocol
 * complexity and exposes a clean JSON interface to TypeScript.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Context, Effect, Layer } from "effect";
import type {
  WhatsAppAuthStatus,
  WhatsAppChatData,
  WhatsAppSyncOptions,
  WhatsAppSyncResult,
  WhatsAppSendMessageOptions,
  WhatsAppSendMessageResult,
} from "./whatsapp.types";

const execAsync = promisify(exec);

/**
 * Service Interface
 */
export interface WhatsAppService {
  /**
   * Check if CLI binary exists and is executable
   */
  readonly isAvailable: () => Effect.Effect<boolean, Error>;

  /**
   * Get authentication status
   */
  readonly getAuthStatus: () => Effect.Effect<WhatsAppAuthStatus, Error>;

  /**
   * Authenticate via QR code
   * Returns QR code string for display
   */
  readonly authenticateQR: () => Effect.Effect<string, Error>;

  /**
   * Sync messages from WhatsApp
   */
  readonly syncMessages: (options?: WhatsAppSyncOptions) => Effect.Effect<WhatsAppSyncResult, Error>;

  /**
   * List all chats
   */
  readonly listChats: () => Effect.Effect<WhatsAppChatData[], Error>;

  /**
   * Send a message to a chat
   */
  readonly sendMessage: (options: WhatsAppSendMessageOptions) => Effect.Effect<WhatsAppSendMessageResult, Error>;

  /**
   * Health check - verify CLI is available and authenticated
   */
  readonly healthCheck: () => Effect.Effect<{ available: boolean; authenticated: boolean; error?: string }, never>;
}

/**
 * Service Tag
 */
export class WhatsAppServiceTag extends Context.Tag("WhatsAppService")<WhatsAppServiceTag, WhatsAppService>() {}

/**
 * Live Implementation
 */
export const WhatsAppServiceLive = Layer.sync(WhatsAppServiceTag, () => {
  // Binary is in bin/whatsmeow-cli (relative to project root)
  const cliBinPath = `${process.cwd()}/bin/whatsmeow-cli`;

  const isAvailable = () =>
    Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(`${cliBinPath} version`);
        console.log(`CLI version: ${stdout.trim()}`);
        return true;
      },
      catch: (e) => new Error(`WhatsApp CLI not available: ${e}`),
    });

  const getAuthStatus = () =>
    Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(`${cliBinPath} health`);
        return JSON.parse(stdout) as WhatsAppAuthStatus;
      },
      catch: (e) => new Error(`Failed to get auth status: ${e}`),
    });

  const authenticateQR = () =>
    Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(`${cliBinPath} auth qr --json`);
        const result = JSON.parse(stdout) as { qrCode: string };
        return result.qrCode;
      },
      catch: (e) => new Error(`Authentication failed: ${e}`),
    });

  const syncMessages = (options: WhatsAppSyncOptions = {}) =>
    Effect.tryPromise({
      try: async () => {
        const args: string[] = ["sync", "--json"];

        if (options.days) {
          args.push("--days", options.days.toString());
        }

        if (options.chatJid) {
          args.push("--chat", options.chatJid);
        }

        if (options.includeMedia) {
          args.push("--media");
        }

        const { stdout } = await execAsync(`${cliBinPath} ${args.join(" ")}`);
        return JSON.parse(stdout) as WhatsAppSyncResult;
      },
      catch: (e) => new Error(`Sync failed: ${e}`),
    });

  const listChats = () =>
    Effect.tryPromise({
      try: async () => {
        const { stdout } = await execAsync(`${cliBinPath} chats --json`);
        const result = JSON.parse(stdout) as { chats: WhatsAppChatData[] };
        return result.chats || [];
      },
      catch: (e) => new Error(`Failed to list chats: ${e}`),
    });

  const sendMessage = (options: WhatsAppSendMessageOptions) =>
    Effect.tryPromise({
      try: async () => {
        const args: string[] = ["send"];

        args.push("--to", options.to);
        args.push("--message", options.content);

        const { stdout } = await execAsync(`${cliBinPath} ${args.join(" ")}`);
        return JSON.parse(stdout) as WhatsAppSendMessageResult;
      },
      catch: (e) => new Error(`Failed to send message: ${e}`),
    });

  const healthCheck = () =>
    Effect.gen(function* () {
      const availableResult = yield* Effect.either(isAvailable());

      if (availableResult._tag === "Left") {
        return {
          available: false,
          authenticated: false,
          error: availableResult.left.message,
        };
      }

      const authResult = yield* Effect.either(getAuthStatus());

      if (authResult._tag === "Left") {
        return {
          available: true,
          authenticated: false,
          error: authResult.left.message,
        };
      }

      return {
        available: true,
        authenticated: authResult.right.authenticated,
      };
    });

  return {
    isAvailable,
    getAuthStatus,
    authenticateQR,
    syncMessages,
    listChats,
    sendMessage,
    healthCheck,
  };
});
