import { Context, Effect, Layer } from 'effect';
import { eq, and, desc, inArray, asc } from 'drizzle-orm';
import { DatabaseService } from '../../infrastructure/db/client';
import { VectorStoreService } from '../../infrastructure/rag/vector.store';
import { AIServiceTag } from '../../infrastructure/llm/ai.service';
import { whatsappMessages } from '../../infrastructure/db/schema';

// --- Interface ---

export interface AnalysisService {
  readonly indexChat: (chatId: string) => Effect.Effect<void, Error>;
  readonly analyze: (chatId: string) => Effect.Effect<string, Error>;
  readonly draftResponse: (chatId: string, intent: string) => Effect.Effect<string, Error>;
}

export class AnalysisServiceTag extends Context.Tag('AnalysisService')<
  AnalysisServiceTag,
  AnalysisService
>() {}

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
        const unindexedMessages = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(whatsappMessages)
              .where(
                and(
                  eq(whatsappMessages.chatId, chatId),
                  eq(whatsappMessages.isIndexed, false)
                )
              )
              .execute(),
          catch: (e) => new Error(`Failed to fetch unindexed messages: ${e}`),
        });

        if (unindexedMessages.length === 0) {
          return;
        }

        // 2. Prepare Documents
        const docs = unindexedMessages.map((msg) => ({
          id: msg.id,
          text: `${msg.fromMe ? 'Me' : 'Partner'}: ${msg.content || '[Media]'}`,
          metadata: {
            timestamp: msg.timestamp.toISOString(),
            sender: msg.fromMe ? 'me' : 'them',
            chatId: msg.chatId,
          },
        }));

        // 3. Store in Vector Database
        yield* vectorStore.addDocuments(docs);

        // 4. Mark as Indexed
        const ids = unindexedMessages.map((m) => m.id);
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(whatsappMessages)
              .set({ isIndexed: true })
              .where(inArray(whatsappMessages.id, ids))
              .execute(),
          catch: (e) => new Error(`Failed to update message index status: ${e}`),
        });
      });

    const analyze = (chatId: string) =>
      Effect.gen(function* (_) {
        // 1. Retrieve recent messages (last 50)
        const recentMessages = yield* Effect.tryPromise({
          try: async () => {
            const msgs = await db
              .select()
              .from(whatsappMessages)
              .where(eq(whatsappMessages.chatId, chatId))
              .orderBy(desc(whatsappMessages.timestamp))
              .limit(50)
              .execute();
            return msgs.reverse(); // Chronological order
          },
          catch: (e) => new Error(`Failed to fetch recent messages: ${e}`),
        });

        if (recentMessages.length === 0) {
          return 'No messages found for this chat.';
        }

        // 2. Retrieve relevant long-term context
        // We construct a query from the last few messages to find relevant history
        const queryText = recentMessages
          .slice(-3)
          .map((m) => m.content)
          .join(' ');
        
        const ragResults = yield* vectorStore.search(queryText || 'Relationship context', 5);

        // 3. Generate Analysis Report
        const recentText = recentMessages
          .map((m) => `[${m.timestamp.toISOString()}] ${m.fromMe ? 'Me' : 'Partner'}: ${m.content}`)
          .join('\n');

        const contextText = ragResults
          .map((doc) => `(Historical): ${doc.text}`)
          .join('\n');

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
          { role: 'system', content: 'You are a helpful relationship coach.' },
          { role: 'user', content: prompt },
        ]);

        return analysis;
      });

    const draftResponse = (chatId: string, intent: string) =>
      Effect.gen(function* (_) {
        // 1. Fetch recent conversation context
        const recentMessages = yield* Effect.tryPromise({
          try: async () => {
             const msgs = await db
              .select()
              .from(whatsappMessages)
              .where(eq(whatsappMessages.chatId, chatId))
              .orderBy(desc(whatsappMessages.timestamp))
              .limit(10)
              .execute();
            return msgs.reverse();
          },
          catch: (e) => new Error(`Failed to fetch context: ${e}`),
        });

        // 2. RAG search for similar situations/tone using the intent
        const ragResults = yield* vectorStore.search(intent, 3);

        const contextText = ragResults
          .map((doc) => `(Reference): ${doc.text}`)
          .join('\n');
        
        const recentText = recentMessages
          .map((m) => `${m.fromMe ? 'Me' : 'Partner'}: ${m.content}`)
          .join('\n');

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
          { role: 'system', content: 'You are a personal communication assistant. Mimic the user\'s style.' },
          { role: 'user', content: prompt },
        ]);

        return draft;
      });

    return {
      indexChat,
      analyze,
      draftResponse,
    };
  })
);
