import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Context, Effect, Layer } from "effect";

import * as schema from "./schema/index";

// Define the Service Tag
export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  ReturnType<typeof drizzle<typeof schema>>
>() {}

// Database path - configurable via environment variable
// Default location: data/lifeops.db (keeps all data files in one directory)
const DB_PATH = process.env.LIFEOPS_DB_PATH ?? "data/lifeops.db";

/**
 * Live Layer with proper resource management
 *
 * Uses Effect.acquireRelease to ensure the database connection is closed
 * when the scope ends, preventing the process from hanging.
 */
export const DatabaseLive = Layer.scoped(
  DatabaseService,
  Effect.acquireRelease(
    // Acquire: open database connection
    Effect.sync(() => {
      const sqlite = new Database(DB_PATH);
      // Enable WAL mode for better concurrency
      sqlite.exec("PRAGMA journal_mode = WAL;");
      return { db: drizzle(sqlite, { schema }), sqlite };
    }),
    // Release: close database connection
    ({ sqlite }) =>
      Effect.sync(() => {
        sqlite.close();
      }),
  ).pipe(Effect.map(({ db }) => db)),
);

// Export raw SQLite access for migrations
export const getRawDatabase = () => new Database(DB_PATH);
