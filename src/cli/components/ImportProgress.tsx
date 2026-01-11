/**
 * Import Progress Component (Ink)
 *
 * Shows animated spinner during import with live stats.
 */

import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useEffect, useState } from "react";

interface ImportProgressProps {
  totalContacts: number;
  totalMessages: number;
  currentContact?: string;
  phase: "preparing" | "importing" | "complete" | "error";
  stats?: {
    contactsImported: number;
    messagesImported: number;
    conversationsImported: number;
  };
  error?: string;
}

export const ImportProgress: React.FC<ImportProgressProps> = ({
  totalContacts,
  totalMessages,
  currentContact,
  phase,
  stats,
  error,
}) => {
  const [dots, setDots] = useState("");

  // Animated dots for "importing..." effect
  useEffect(() => {
    if (phase !== "importing") return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [phase]);

  if (phase === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="red">❌ Import failed: {error}</Text>
        </Box>
      </Box>
    );
  }

  if (phase === "complete" && stats) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✅ Import complete!
          </Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          <Text>
            • Contacts: <Text color="cyan">{stats.contactsImported}</Text>
          </Text>
          <Text>
            • Conversations: <Text color="cyan">{stats.conversationsImported}</Text>
          </Text>
          <Text>
            • Messages: <Text color="cyan">{stats.messagesImported}</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header with spinner */}
      <Box marginBottom={1}>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text bold>
          {" "}
          {phase === "preparing" ? "Preparing import" : "Importing"}
          {dots}
        </Text>
      </Box>

      {/* Progress stats */}
      <Box flexDirection="column" marginLeft={2}>
        <Text dimColor>
          Contacts: <Text color="yellow">{totalContacts}</Text>
        </Text>
        <Text dimColor>
          Messages: <Text color="yellow">{totalMessages}</Text>
        </Text>
        {currentContact && (
          <Text dimColor>
            Current: <Text color="cyan">{currentContact}</Text>
          </Text>
        )}
      </Box>

      {/* Progress bar (simple) */}
      {stats && phase === "importing" && (
        <Box marginTop={1}>
          <Text dimColor>
            Progress: {stats.messagesImported}/{totalMessages} messages
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ImportProgress;
