import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Context, Effect, Layer } from 'effect';
import * as schema from './schema';

// Define the Service Tag
export class DatabaseService extends Context.Tag('DatabaseService')<
  DatabaseService,
  ReturnType<typeof drizzle<typeof schema>>
>() {}

// Define the Live Layer
export const DatabaseLive = Layer.effect(
  DatabaseService,
  Effect.sync(() => {
    const sqlite = new Database('lifeops3.db');
    // Enable WAL mode for better concurrency
    sqlite.exec('PRAGMA journal_mode = WAL;');
    return drizzle(sqlite, { schema });
  })
);
