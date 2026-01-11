import { and, desc, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { communicationEvents, conversations, messages } from "../../infrastructure/db/schema/index";
// Import from domain ports (not directly from infrastructure)
import { AIServiceTag, DatabaseService, VectorStoreService } from "../ports";

// --- Interface ---

export interface AnalysisService {
  readonly indexChat: (chatId: string) => Effect.Effect<void, Error>;
  readonly analyze: (chatId: string) => Effect.Effect<string, Error>;
  readonly draftResponse: (chatId: string, intent: string) => Effect.Effect<string, Error>;
}

export class AnalysisServiceTag extends Context.Tag("AnalysisService")<AnalysisServiceTag, AnalysisService>() {}

// --- Implementation ---

export const AnalysisLive = Layer.effect(
  AnalysisServiceTag,
  Effect.gen(function* (_) {
    const db = yield* _(DatabaseService);
    const vectorStore = yield* _(VectorStoreService);
    const ai = yield* _(AIServiceTag);

    const indexChat = (chatId: string) =>
      Effect.gen(function* (_) {
        // 1. Fetch unindexed messages
        // We join communicationEvents -> messages -> conversations to filter by externalId (chatId)
        const unindexedMessages = yield* Effect.tryPromise({
          try: () =>
            db
              .select({
                id: messages.eventId,
                content: messages.content,
                eventId: messages.eventId,
                timestamp: communicationEvents.occurredAt,
                direction: communicationEvents.direction,
                externalId: conversations.externalId,
              })
              .from(messages)
              .innerJoin(communicationEvents, eq(messages.eventId, communicationEvents.id))
              .innerJoin(conversations, eq(communicationEvents.conversationId, conversations.id))
              .where(and(eq(conversations.externalId, chatId), eq(communicationEvents.isIndexed, false)))
              .execute(),
          catch: (e) => new Error(`Failed to fetch unindexed messages: ${e}`),
        });

        if (unindexedMessages.length === 0) {
          return;
        }

        // 2. Prepare Documents
        const docs = unindexedMessages.map((msg) => ({
          id: msg.id,
          text: `${msg.direction === "outbound" ? "Me" : "Partner"}: ${msg.content || "[Media]"}`,
          metadata: {
            timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
            sender: msg.direction === "outbound" ? "me" : "them",
            chatId: msg.externalId,
          },
        }));

        // 3. Store in Vector Database
        yield* vectorStore.addDocuments(docs);

        // 4. Mark as Indexed
        const ids = unindexedMessages.map((m) => m.eventId);
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(communicationEvents)
              .set({ isIndexed: true })
              .where(inArray(communicationEvents.id, ids))
              .execute(),
          catch: (e) => new Error(`Failed to update communication event index status: ${e}`),
        });
      });

    const analyze = (chatId: string) =>
      Effect.gen(function* (_) {
        // 1. Retrieve recent messages (last 50)
        const recentMessages = yield* Effect.tryPromise({
          try: async () => {
            const msgs = await db
              .select({
                content: messages.content,
                timestamp: communicationEvents.occurredAt,
                direction: communicationEvents.direction,
              })
              .from(messages)
              .innerJoin(communicationEvents, eq(messages.eventId, communicationEvents.id))
              .innerJoin(conversations, eq(communicationEvents.conversationId, conversations.id))
              .where(eq(conversations.externalId, chatId))
              .orderBy(desc(communicationEvents.occurredAt))
              .limit(50)
              .execute();
            return msgs.reverse(); // Chronological order
          },
          catch: (e) => new Error(`Failed to fetch recent messages: ${e}`),
        });

        if (recentMessages.length === 0) {
          return "No messages found for this chat.";
        }

        // 2. Retrieve relevant long-term context
        // We construct a query from the last few messages to find relevant history
        const queryText = recentMessages
          .slice(-3)
          .map((m) => m.content)
          .join(" ");

        const ragResults = yield* vectorStore.search(queryText || "Relationship context", 5);

        // 3. Generate Analysis Report
        const recentText = recentMessages
          .map((m) => `[${m.timestamp?.toISOString()}] ${m.direction === "outbound" ? "Me" : "Partner"}: ${m.content}`)
          .join("\n");

        const contextText = ragResults.map((doc) => `(Historical): ${doc.text}`).join("\n");

        const prompt = `
You are a relationship analysis expert. Use the provided context to analyze the relationship state.

### Historical Context (RAG):
${contextText}

### Recent Conversation:
${recentText}

### Task:
Provide a "Relationship State" report including:
1. Current emotional tone.
2. Key topics discussed recently.
3. Underlying sentiments or potential conflicts.
4. Suggestions for the next interaction.
`;

        const analysis = yield* ai.generateText([
          { role: "system", content: "You are a helpful relationship coach." },
          { role: "user", content: prompt },
        ]);

        return analysis;
      });

    const draftResponse = (chatId: string, intent: string) =>
      Effect.gen(function* (_) {
        // 1. Fetch recent conversation context
        const recentMessages = yield* Effect.tryPromise({
          try: async () => {
            const msgs = await db
              .select({
                content: messages.content,
                direction: communicationEvents.direction,
              })
              .from(messages)
              .innerJoin(communicationEvents, eq(messages.eventId, communicationEvents.id))
              .innerJoin(conversations, eq(communicationEvents.conversationId, conversations.id))
              .where(eq(conversations.externalId, chatId))
              .orderBy(desc(communicationEvents.occurredAt))
              .limit(10)
              .execute();
            return msgs.reverse();
          },
          catch: (e) => new Error(`Failed to fetch context: ${e}`),
        });

        // 2. RAG search for similar situations/tone using the intent
        const ragResults = yield* vectorStore.search(intent, 3);

        const contextText = ragResults.map((doc) => `(Reference): ${doc.text}`).join("\n");

        const recentText = recentMessages
          .map((m) => `${m.direction === "outbound" ? "Me" : "Partner"}: ${m.content}`)
          .join("\n");

        const prompt = `
Draft a WhatsApp response based on the user's intent, matching their usual tone.

### Reference (My past style):
${contextText}

### Recent Chat:
${recentText}

### Intent:
${intent}

### Draft:
`;
        const draft = yield* ai.generateText([
          { role: "system", content: "You are a personal communication assistant. Mimic the user's style." },
          { role: "user", content: prompt },
        ]);

        return draft;
      });

    return {
      indexChat,
      analyze,
      draftResponse,
    };
  }),
);
