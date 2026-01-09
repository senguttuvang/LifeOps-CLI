import * as lancedb from "@lancedb/lancedb";
import { Context, Effect, Layer } from "effect";
import { OpenAI } from "openai"; // Using OpenAI for embeddings (or we can use a local model)

// Interfaces
export interface Document {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
  vector?: number[];
}

export interface VectorStore {
  readonly addDocuments: (docs: Document[]) => Effect.Effect<void, Error>;
  readonly search: (query: string, limit?: number) => Effect.Effect<Document[], Error>;
}

// Service Tag
export class VectorStoreService extends Context.Tag("VectorStoreService")<VectorStoreService, VectorStore>() {}

// Vector store path - configurable via environment variable
const LANCEDB_PATH = process.env.LIFEOPS_VECTOR_PATH ?? "data/lancedb";

// Implementation
export const VectorStoreLive = Layer.effect(
  VectorStoreService,
  Effect.gen(function* (_) {
    // Initialize LanceDB
    const db = yield* Effect.tryPromise({
      try: () => lancedb.connect(LANCEDB_PATH),
      catch: (e) => new Error(`Failed to connect to LanceDB: ${e}`),
    });

    // Initialize Embedding Client lazily (only when actually used)
    // This avoids startup failures when API key is not set
    // Supports both OPENAI_API_KEY and OPENROUTER_API_KEY (OpenRouter is OpenAI-compatible)
    let openaiClient: OpenAI | null = null;
    const getOpenAI = () => {
      if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new Error(
            "OPENAI_API_KEY or OPENROUTER_API_KEY environment variable is not set. Vector store operations require embeddings.",
          );
        }
        // Use OpenRouter if OPENROUTER_API_KEY is set, otherwise use OpenAI directly
        const isOpenRouter = !process.env.OPENAI_API_KEY && process.env.OPENROUTER_API_KEY;
        openaiClient = new OpenAI({
          apiKey,
          baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
        });
      }
      return openaiClient;
    };

    const getEmbedding = (text: string) =>
      Effect.tryPromise({
        try: async () => {
          const response = await getOpenAI().embeddings.create({
            model: "text-embedding-3-small",
            input: text,
          });
          const embedding = response.data[0]?.embedding;
          if (!embedding) {
            throw new Error("No embedding returned from OpenAI");
          }
          return embedding;
        },
        catch: (e) => new Error(`Embedding failed: ${e}`),
      });

    const TABLE_NAME = "vectors";

    // Ensure table exists
    // Note: LanceDB creates tables implicitly on first add usually, or we explicitly create
    // We'll handle lazy creation in addDocuments for simplicity or check existence here.

    return {
      addDocuments: (docs: Document[]) =>
        Effect.gen(function* (_) {
          // 1. Generate embeddings
          const docsWithVectors = yield* Effect.all(
            docs.map((doc) =>
              Effect.map(getEmbedding(doc.text), (vector) => ({
                id: doc.id,
                text: doc.text,
                vector,
                ...doc.metadata,
              })),
            ),
            { concurrency: 5 },
          );

          // 2. Add to table
          yield* Effect.tryPromise({
            try: async () => {
              const table = await db.openTable(TABLE_NAME).catch(() => null);
              await (table ? table.add(docsWithVectors) : db.createTable(TABLE_NAME, docsWithVectors));
            },
            catch: (e) => new Error(`Failed to add documents: ${e}`),
          });
        }),

      search: (query: string, limit = 5) =>
        Effect.gen(function* (_) {
          const queryVector = yield* getEmbedding(query);

          return yield* Effect.tryPromise({
            try: async () => {
              const table = await db.openTable(TABLE_NAME);
              const results = await table.search(queryVector).limit(limit).toArray();
              return results.map((r) => ({
                id: r.id as string,
                text: r.text as string,
                metadata: {
                  timestamp: r.timestamp,
                  sender: r.sender,
                  chatId: r.chatId,
                },
              }));
            },
            catch: (e) => new Error(`Search failed: ${e}`),
          });
        }),
    };
  }),
);
