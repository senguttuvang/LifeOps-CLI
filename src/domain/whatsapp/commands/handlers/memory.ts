// @ts-nocheck - Experimental feature (Phase 1 self-DM interface)
/**
 * Memory Command Handler
 *
 * Searches relationship memories using vector similarity
 */

import { Effect } from "effect";

// Import from domain ports (not directly from infrastructure)
import { VectorStoreService } from "../../../ports";

export const handleMemory = (query: string): Effect.Effect<string, Error> => {
  if (!query) {
    return Effect.succeed("Please provide search query.\nExample: @lifeops memory beach sunset");
  }

  return Effect.gen(function* () {
    const vectorStore = yield* VectorStoreService;

    // Search memories
    const memories = yield* vectorStore.search(query, 5);

    if (memories.length === 0) {
      return `🔍 No memories found for: "${query}"

Try a different search term or add more context.`;
    }

    // Format results
    let response = `🔍 Found ${memories.length} memories for "${query}":

`;

    for (const [idx, memory] of memories.entries()) {
      const timestamp = memory.metadata.timestamp
        ? new Date(memory.metadata.timestamp as string).toLocaleDateString()
        : "Unknown date";

      response += `${idx + 1}. ${timestamp}
   ${memory.text}

`;
    }

    response += `Want more details? Try searching with different terms.`;

    return response;
  });
};
