/**
 * Contact Setup Component
 *
 * Interactive Ink UI for configuring contacts after sync:
 * 1. Shows synced contacts
 * 2. Lets user confirm/edit display names
 * 3. Sets relationship type
 * 4. Saves to database
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

// =============================================================================
// TYPES
// =============================================================================

export interface ContactInfo {
  id: string;
  displayName: string;
  preferredName: string | null;
  whatsappJid: string;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance" | null;
  messageCount: number;
}

export interface ContactSetupResult {
  partyId: string;
  displayName: string;
  preferredName: string | null;
  relationshipType: "partner" | "family" | "friend" | "colleague" | "acquaintance";
}

interface ContactSetupProps {
  contacts: ContactInfo[];
  onComplete: (results: ContactSetupResult[]) => void;
  onCancel: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RELATIONSHIP_TYPES = [
  { key: "partner", label: "💕 Partner", description: "Romantic partner, spouse" },
  { key: "family", label: "👨‍👩‍👧 Family", description: "Parents, siblings, relatives" },
  { key: "friend", label: "🤝 Friend", description: "Close friends" },
  { key: "colleague", label: "💼 Colleague", description: "Work contacts" },
  { key: "acquaintance", label: "👋 Acquaintance", description: "Casual contacts" },
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

type Phase = "list" | "edit-name" | "select-relationship" | "saving" | "complete";

export const ContactSetup: React.FC<ContactSetupProps> = ({
  contacts,
  onComplete,
  onCancel,
}) => {

  // State
  const [phase, setPhase] = useState<Phase>("list");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRelationship, setSelectedRelationship] = useState(0);
  const [editedName, setEditedName] = useState("");
  const [results, setResults] = useState<ContactSetupResult[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);

  // Current contact
  const currentContact = contacts[currentIndex];
  const remaining = contacts.length - currentIndex;

  // Initialize edited name when moving to edit phase
  useEffect(() => {
    if (phase === "edit-name" && currentContact) {
      setEditedName(currentContact.preferredName || currentContact.displayName);
    }
  }, [phase, currentIndex, currentContact]);

  // Handle keyboard input
  useInput((input, key) => {
    if (phase === "list") {
      if (key.return) {
        // Start configuring first contact
        setPhase("edit-name");
      } else if (input === "q" || key.escape) {
        onCancel();
      } else if (input === "s") {
        // Skip all and save what we have
        onComplete(results);
      }
    } else if (phase === "select-relationship") {
      if (key.upArrow) {
        setSelectedRelationship((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedRelationship((prev) => Math.min(RELATIONSHIP_TYPES.length - 1, prev + 1));
      } else if (key.return) {
        // Save this contact and move to next
        const result: ContactSetupResult = {
          partyId: currentContact.id,
          displayName: currentContact.displayName,
          preferredName: editedName !== currentContact.displayName ? editedName : null,
          relationshipType: RELATIONSHIP_TYPES[selectedRelationship].key,
        };

        const newResults = [...results, result];
        setResults(newResults);

        // Move to next contact or complete
        if (currentIndex < contacts.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setSelectedRelationship(0);
          setPhase("edit-name");
        } else {
          setPhase("saving");
          // Small delay to show saving state
          setTimeout(() => {
            onComplete(newResults);
          }, 500);
        }
      } else if (key.escape) {
        // Go back to name edit
        setPhase("edit-name");
      } else if (input === "x") {
        // Skip this contact
        setSkippedCount((prev) => prev + 1);
        if (currentIndex < contacts.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setSelectedRelationship(0);
          setPhase("edit-name");
        } else {
          setPhase("saving");
          setTimeout(() => {
            onComplete(results);
          }, 500);
        }
      }
    }
  });

  // Handle name edit submission
  const handleNameSubmit = () => {
    setPhase("select-relationship");
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (phase === "list") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">📇 Contact Setup</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Found {contacts.length} contacts to configure:</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          {contacts.slice(0, 8).map((contact, i) => (
            <Box key={contact.id}>
              <Text color="gray">{i + 1}. </Text>
              <Text>{contact.displayName}</Text>
              <Text color="gray"> ({contact.messageCount} msgs)</Text>
              {contact.relationshipType && (
                <Text color="green"> ✓ {contact.relationshipType}</Text>
              )}
            </Box>
          ))}
          {contacts.length > 8 && (
            <Text color="gray">  ... and {contacts.length - 8} more</Text>
          )}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Controls:</Text>
          <Text color="gray">  Enter - Start configuring</Text>
          <Text color="gray">  s     - Skip and save</Text>
          <Text color="gray">  q     - Cancel</Text>
        </Box>
      </Box>
    );
  }

  if (phase === "edit-name") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">📇 Contact {currentIndex + 1}/{contacts.length}</Text>
          <Text color="gray"> ({remaining} remaining)</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>WhatsApp: </Text>
          <Text color="yellow">{currentContact.whatsappJid}</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Current name: </Text>
          <Text color="white">{currentContact.displayName}</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Preferred name: </Text>
          <TextInput
            value={editedName}
            onChange={setEditedName}
            onSubmit={handleNameSubmit}
            placeholder="Enter name..."
          />
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Press Enter to continue, or type a different name</Text>
        </Box>
      </Box>
    );
  }

  if (phase === "select-relationship") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">📇 Contact {currentIndex + 1}/{contacts.length}</Text>
          <Text color="gray"> - </Text>
          <Text bold>{editedName}</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>What's your relationship with </Text>
          <Text color="yellow">{editedName}</Text>
          <Text>?</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          {RELATIONSHIP_TYPES.map((type, i) => (
            <Box key={type.key}>
              <Text color={i === selectedRelationship ? "cyan" : "gray"}>
                {i === selectedRelationship ? "❯ " : "  "}
              </Text>
              <Text color={i === selectedRelationship ? "white" : "gray"}>
                {type.label}
              </Text>
              <Text color="gray"> - {type.description}</Text>
            </Box>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">↑/↓ - Navigate  |  Enter - Select  |  x - Skip  |  Esc - Back</Text>
        </Box>

        {skippedCount > 0 && (
          <Box marginTop={1}>
            <Text color="gray">Skipped: {skippedCount}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (phase === "saving") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Saving {results.length} contacts...</Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default ContactSetup;
