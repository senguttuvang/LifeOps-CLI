/**
 * Memory Components
 *
 * Display components for relationship memories.
 * Replaces displayMemoryStored, displayMemories from relationship-output.ts.
 */

import { Box, Text } from "ink";
import { StyledBox } from "./StyledBox.js";
import { Success } from "./Alert.js";

export interface Memory {
  readonly content: string;
  readonly category: "gift" | "preference" | "date" | "boundary" | "context";
  readonly mentionedAt: Date;
}

const CATEGORY_EMOJI: Record<Memory["category"], string> = {
  gift: "🎁",
  preference: "❤️",
  date: "📅",
  boundary: "⚠️",
  context: "📝",
};

const CATEGORY_HINTS: Partial<Record<Memory["category"], string>> = {
  gift: "This will appear in gift suggestions later.",
  boundary: "Boundary noted. Respect it.",
  date: "Calendar reminder recommended.",
};

export interface MemoryStoredProps {
  readonly memory: Memory;
}

/**
 * Display a newly stored memory
 */
export function MemoryStored({ memory }: MemoryStoredProps) {
  const emoji = CATEGORY_EMOJI[memory.category];
  const hint = CATEGORY_HINTS[memory.category];

  return (
    <Box flexDirection="column" marginY={1}>
      <Success>
        <Text bold>Remembered:</Text> "{memory.content}"
      </Success>
      <Text>
        {"  "}
        {emoji} Category: {memory.category} (auto-detected)
      </Text>
      {hint && <Text dimColor>  {hint}</Text>}
    </Box>
  );
}

export interface MemoryListProps {
  readonly memories: readonly Memory[];
  readonly category?: Memory["category"];
}

/**
 * Display a list of memories
 */
export function MemoryList({ memories, category }: MemoryListProps) {
  const title = category
    ? `${category.charAt(0).toUpperCase() + category.slice(1)} Memories`
    : "All Memories";

  if (memories.length === 0) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="yellow">No memories found.</Text>
        <Text dimColor>
          Use 'bun run cli remember "something to remember"' to add one.
        </Text>
      </Box>
    );
  }

  return (
    <StyledBox title={title}>
      {memories.map((memory, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold>{i + 1}.</Text> {memory.content}
          </Text>
          <Text dimColor>
            {"   "}
            {memory.category} | {memory.mentionedAt.toLocaleDateString()}
          </Text>
        </Box>
      ))}
    </StyledBox>
  );
}
