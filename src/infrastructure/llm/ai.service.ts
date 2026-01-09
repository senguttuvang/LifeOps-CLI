import Anthropic from "@anthropic-ai/sdk";
import { Context, Effect, Layer, Stream } from "effect";
import OpenAI from "openai";

// Types
export type AIProvider = "anthropic" | "openrouter";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIService {
  readonly generateText: (
    messages: AIMessage[],
    options?: { provider?: AIProvider; model?: string; temperature?: number },
  ) => Effect.Effect<string, Error>;

  readonly streamText: (
    messages: AIMessage[],
    options?: { provider?: AIProvider; model?: string; temperature?: number },
  ) => Stream.Stream<string, Error>;
}

// Service Tag
export class AIServiceTag extends Context.Tag("AIService")<AIServiceTag, AIService>() {}

// Implementation
export const AILive = Layer.sync(AIServiceTag, () => {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "dummy",
  });

  const openRouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "dummy",
    defaultHeaders: {
      "HTTP-Referer": "https://lifeops.local",
      "X-Title": "LifeOps2",
    },
  });

  return {
    generateText: (messages, options = {}) =>
      Effect.tryPromise({
        try: async () => {
          const provider = options.provider || "openrouter";
          const temperature = options.temperature ?? 0.7;

          if (provider === "anthropic") {
            const systemMsg = messages.find((m) => m.role === "system")?.content;
            const userMessages = messages
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

            const res = await anthropic.messages.create({
              model: options.model || "claude-3-5-sonnet-20241022",
              max_tokens: 4096,
              temperature,
              system: systemMsg,
              messages: userMessages,
            });

            const firstContent = res.content[0];
            return firstContent?.type === "text" ? firstContent.text : "";
          }

          // OpenRouter / OpenAI compatible (Groq via OpenRouter)
          const res = await openRouter.chat.completions.create({
            model: options.model || "deepseek/deepseek-r1",
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature,
          });
          return res.choices[0]?.message?.content || "";
        },
        catch: (e) => new Error(`AI Generation failed: ${e}`),
      }),

    streamText: (messages, options = {}) =>
      Stream.fromAsyncIterable(
        (async function* () {
          const provider = options.provider || "openrouter";
          const temperature = options.temperature ?? 0.7;

          if (provider === "anthropic") {
            const systemMsg = messages.find((m) => m.role === "system")?.content;
            const userMessages = messages
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

            const stream = await anthropic.messages.create({
              model: options.model || "claude-3-5-sonnet-20241022",
              max_tokens: 4096,
              temperature,
              system: systemMsg,
              messages: userMessages,
              stream: true,
            });

            for await (const chunk of stream) {
              if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                yield chunk.delta.text;
              }
            }
          } else {
            const stream = await openRouter.chat.completions.create({
              model: options.model || "deepseek/deepseek-r1",
              messages: messages.map((m) => ({ role: m.role, content: m.content })),
              temperature,
              stream: true,
            });

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {yield content;}
            }
          }
        })(),
        (e) => new Error(`AI Stream failed: ${e}`),
      ),
  };
});
