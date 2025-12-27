/**
 * Self-DM Command Parser
 *
 * Parses "@lifeops <command> [args]" pattern from WhatsApp messages
 */

export interface ParsedCommand {
  name: string;
  args: string;
}

/**
 * Parse command from message text
 *
 * @param messageText - Full message text from WhatsApp
 * @returns Parsed command or null if not a valid command
 *
 * @example
 * parseCommand("@lifeops suggest outdoor")
 * // Returns: { name: "suggest", args: "outdoor" }
 *
 * parseCommand("@lifeops memory beach sunset")
 * // Returns: { name: "memory", args: "beach sunset" }
 *
 * parseCommand("@lifeops help")
 * // Returns: { name: "help", args: "" }
 *
 * parseCommand("Just a regular message")
 * // Returns: null
 */
export function parseCommand(messageText: string): ParsedCommand | null {
  // Match @lifeops <command> [args]
  // Pattern: @lifeops followed by space, then word (command), optionally followed by space and rest (args)
  const pattern = /^@lifeops\s+(\w+)(?:\s+(.+))?$/i;
  const match = messageText.trim().match(pattern);

  if (!match) {
    return null;
  }

  const [, name, args = ""] = match;

  if (!name) {
    return null;
  }

  return {
    name: name.toLowerCase(),
    args: args.trim(),
  };
}
