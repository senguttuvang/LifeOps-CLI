/**
 * Terminal Markdown Renderer
 *
 * Renders markdown to terminal with colors and formatting.
 * Uses marked + marked-terminal for rich output.
 */

import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked with terminal renderer
// @ts-expect-error - marked-terminal types are not fully compatible with marked 17.x
marked.use(markedTerminal({
  // Customize appearance
  reflowText: true,
  width: 80,
  showSectionPrefix: false,
}));

/**
 * Render markdown to terminal-formatted string
 *
 * @param markdown - Raw markdown text
 * @returns Formatted string with ANSI colors
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}

/**
 * Print markdown directly to console with formatting
 *
 * @param markdown - Raw markdown text
 */
export function printMarkdown(markdown: string): void {
  console.log(renderMarkdown(markdown));
}
