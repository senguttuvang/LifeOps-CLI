/**
 * Contact Selector Component (Ink)
 *
 * Checkbox-style multi-select with search filtering.
 * Custom implementation for Bun/ESM compatibility.
 */

import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type React from "react";
import { useMemo, useState } from "react";

import type { ContactSummary } from "../../domain/sync";

interface ContactSelectorProps {
  contacts: ContactSummary[];
  onSelect: (selectedJids: string[]) => void;
  onCancel: () => void;
}

/**
 * Custom MultiSelect Item
 */
interface SelectItem {
  jid: string;
  label: string;
  selected: boolean;
}

/**
 * ContactSelector Component
 *
 * Controls:
 * - ↑↓ Navigate
 * - Space: Toggle selection
 * - Enter: Confirm
 * - /: Open filter
 * - Esc: Cancel (or close filter)
 * - a: Select all visible
 * - n: Select none
 */
export const ContactSelector: React.FC<ContactSelectorProps> = ({ contacts, onSelect, onCancel }) => {
  const { exit } = useApp();
  const [filterText, setFilterText] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);

  // Filter contacts based on search text
  const filteredContacts = useMemo(() => {
    if (!filterText.trim()) {
      return contacts;
    }

    const searchTerm = filterText.toLowerCase();
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(searchTerm) ||
        (c.phoneNumber && c.phoneNumber.includes(searchTerm)) ||
        c.jid.toLowerCase().includes(searchTerm),
    );
  }, [contacts, filterText]);

  // Convert to display items
  const items: SelectItem[] = useMemo(() => {
    return filteredContacts.map((c) => {
      const phone = c.phoneNumber ? ` (${c.phoneNumber})` : "";
      const type = c.isGroup ? " [Group]" : "";
      const count = `${c.messageCount} msgs`;

      return {
        jid: c.jid,
        label: `${c.displayName}${phone}${type} - ${count}`,
        selected: selectedJids.has(c.jid),
      };
    });
  }, [filteredContacts, selectedJids]);

  // Visible items (paginated)
  const maxVisible = 12;
  const startIndex = Math.max(0, Math.min(cursorIndex - 5, items.length - maxVisible));
  const visibleItems = items.slice(startIndex, startIndex + maxVisible);
  const visibleCursorIndex = cursorIndex - startIndex;

  // Handle keyboard input
  useInput((input, key) => {
    // Escape handling
    if (key.escape) {
      if (isFiltering) {
        setIsFiltering(false);
      } else {
        onCancel();
        exit();
      }
      return;
    }

    // When filtering, only handle filter-specific keys
    if (isFiltering) {
      if (key.return) {
        setIsFiltering(false);
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursorIndex((prev) => Math.min(items.length - 1, prev + 1));
      return;
    }

    // Toggle selection with Space
    if (input === " ") {
      const item = items[cursorIndex];
      if (item) {
        setSelectedJids((prev) => {
          const next = new Set(prev);
          if (next.has(item.jid)) {
            next.delete(item.jid);
          } else {
            next.add(item.jid);
          }
          return next;
        });
      }
      return;
    }

    // Confirm with Enter
    if (key.return) {
      if (selectedJids.size === 0) {
        // Nothing selected - don't exit
        return;
      }
      onSelect(Array.from(selectedJids));
      exit();
      return;
    }

    // Filter mode with /
    if (input === "/") {
      setIsFiltering(true);
      return;
    }

    // Select all visible with 'a'
    if (input === "a") {
      setSelectedJids((prev) => {
        const next = new Set(prev);
        for (const item of items) {
          next.add(item.jid);
        }
        return next;
      });
      return;
    }

    // Select none with 'n'
    if (input === "n") {
      setSelectedJids(new Set());
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📱 WhatsApp Contact Selection
        </Text>
        <Text color="green"> ({selectedJids.size} selected)</Text>
      </Box>

      {/* Filter input or instructions */}
      <Box marginBottom={1}>
        {isFiltering ? (
          <Box>
            <Text color="yellow">Filter: </Text>
            <TextInput
              value={filterText}
              onChange={(val) => {
                setFilterText(val);
                setCursorIndex(0);
              }}
              placeholder="Type to filter..."
            />
            <Text dimColor> (Enter to close)</Text>
          </Box>
        ) : (
          <Text dimColor>
            <Text color="yellow">/</Text> Filter <Text color="green">Space</Text> Toggle{" "}
            <Text color="green">Enter</Text> Confirm <Text color="blue">a</Text> All <Text color="blue">n</Text> None{" "}
            <Text color="red">Esc</Text> Cancel
          </Text>
        )}
      </Box>

      {/* Contact count */}
      <Box marginBottom={1}>
        <Text dimColor>
          {filterText ? `Filtered: ${items.length} of ${contacts.length}` : `${contacts.length} contacts`}
        </Text>
      </Box>

      {/* Contact list */}
      {items.length > 0 ? (
        <Box flexDirection="column">
          {visibleItems.map((item, idx) => {
            const isHighlighted = idx === visibleCursorIndex;
            const checkbox = item.selected ? "[✓]" : "[ ]";

            return (
              <Box key={item.jid}>
                <Text color={isHighlighted ? "cyan" : item.selected ? "green" : undefined} bold={isHighlighted}>
                  {isHighlighted ? "❯ " : "  "}
                  <Text color={item.selected ? "green" : "gray"}>{checkbox}</Text> {item.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box>
          <Text color="yellow">No contacts match your filter.</Text>
        </Box>
      )}

      {/* Scroll indicator */}
      {items.length > maxVisible && (
        <Box marginTop={1}>
          <Text dimColor>
            Showing {startIndex + 1}-{Math.min(startIndex + maxVisible, items.length)} of {items.length}
            {startIndex > 0 && " ↑"}
            {startIndex + maxVisible < items.length && " ↓"}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ContactSelector;
