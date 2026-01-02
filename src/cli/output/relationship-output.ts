/**
 * Relationship Console Output
 *
 * Fun and helpful console output for relationship commands.
 * Uses ANSI colors and box drawing for visual appeal.
 *
 * No external dependencies - uses built-in console formatting.
 */

import type {
  DecodedMeaning,
  FineResponse,
  Memory,
  RelationshipHealthMetrics,
  SituationContext,
} from "../../domain/relationship/types";
import type { RelationshipError } from "../../domain/relationship/types/errors";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Background
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
} as const;

// Box drawing characters
const box = {
  topLeft: "\u250c",
  topRight: "\u2510",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  horizontal: "\u2500",
  vertical: "\u2502",
  teeRight: "\u251c",
  teeLeft: "\u2524",
} as const;

/**
 * Create a boxed output
 */
function createBox(title: string, content: string[], width = 60): string {
  const lines: string[] = [];
  const innerWidth = width - 2;

  // Top border with title
  const titlePadded = ` ${title} `;
  const leftPad = Math.floor((innerWidth - titlePadded.length) / 2);
  const rightPad = innerWidth - titlePadded.length - leftPad;

  lines.push(
    `${box.topLeft}${box.horizontal.repeat(leftPad)}${colors.bold}${titlePadded}${colors.reset}${box.horizontal.repeat(rightPad)}${box.topRight}`
  );

  // Content lines
  for (const line of content) {
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, ""); // Strip ANSI for length calc
    const padding = innerWidth - cleanLine.length;
    const paddedLine = line + " ".repeat(Math.max(0, padding));
    lines.push(`${box.vertical}${paddedLine}${box.vertical}`);
  }

  // Bottom border
  lines.push(`${box.bottomLeft}${box.horizontal.repeat(innerWidth)}${box.bottomRight}`);

  return lines.join("\n");
}

/**
 * Format the decoded meaning with appropriate color
 */
function formatDecodedMeaning(decoded: DecodedMeaning): string {
  const formats: Record<DecodedMeaning, string> = {
    ACTUALLY_FINE: `${colors.green}Actually fine (rare!)${colors.reset}`,
    NOT_FINE_INVESTIGATE: `${colors.yellow}Not fine - investigate immediately${colors.reset}`,
    FINAL_WARNING: `${colors.red}Final warning - proceed with extreme caution${colors.reset}`,
    SHOULD_ALREADY_KNOW: `${colors.red}${colors.bold}You should already know why${colors.reset}`,
    TEST_IN_PROGRESS: `${colors.magenta}Test in progress - your response matters${colors.reset}`,
  };
  return formats[decoded];
}

/**
 * Format milliseconds to human-readable time
 */
function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)} hours`;
  return `${Math.round(ms / 86400000)} days`;
}

/**
 * Display Fine Decoder analysis
 */
export function displayFineAnalysis(result: FineResponse): void {
  const content = [
    `${colors.bold}Literal:${colors.reset} "${result.literal}"`,
    `${colors.bold}Decoded:${colors.reset} ${formatDecodedMeaning(result.decoded)}`,
    `${colors.bold}Confidence:${colors.reset} ${(result.confidence * 100).toFixed(1)}%`,
    `${colors.bold}Response Window:${colors.reset} ${formatTime(result.responseWindowMs)}`,
    "",
    `${colors.red}${colors.bold}DO NOT:${colors.reset}`,
    ...result.doNotDo.map((d) => `  ${colors.red}\u2717${colors.reset} ${d}`),
    "",
    `${colors.green}${colors.bold}SUGGESTED:${colors.reset}`,
    ...result.suggestedActions.map((a) => `  ${colors.green}\u2713${colors.reset} ${a}`),
  ];

  console.log(createBox("Fine Decoder(tm) Analysis", content));
}

/**
 * Display a remembered memory
 */
export function displayMemoryStored(memory: Memory): void {
  const categoryEmoji: Record<string, string> = {
    gift: "\ud83c\udf81",
    preference: "\u2764\ufe0f",
    date: "\ud83d\udcc5",
    boundary: "\u26a0\ufe0f",
    context: "\ud83d\udcdd",
  };

  const emoji = categoryEmoji[memory.category] || "\ud83d\udcdd";

  console.log(`\n${colors.green}\u2713${colors.reset} ${colors.bold}Remembered:${colors.reset} "${memory.content}"`);
  console.log(`  ${emoji} Category: ${memory.category} (auto-detected)`);

  if (memory.category === "gift") {
    console.log(`  ${colors.dim}This will appear in gift suggestions later.${colors.reset}`);
  } else if (memory.category === "boundary") {
    console.log(`  ${colors.dim}Boundary noted. Respect it.${colors.reset}`);
  } else if (memory.category === "date") {
    console.log(`  ${colors.dim}Calendar reminder recommended.${colors.reset}`);
  }
  console.log();
}

/**
 * Display memories list
 */
export function displayMemories(memories: Memory[], category?: string): void {
  const title = category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Memories` : "All Memories";

  if (memories.length === 0) {
    console.log(`\n${colors.yellow}No memories found.${colors.reset}`);
    console.log(`${colors.dim}Use 'bun run cli remember "something to remember"' to add one.${colors.reset}\n`);
    return;
  }

  const content = memories.flatMap((m, i) => [
    `${colors.bold}${i + 1}.${colors.reset} ${m.content}`,
    `   ${colors.dim}${m.category} | ${m.mentionedAt.toLocaleDateString()}${colors.reset}`,
    "",
  ]);

  console.log(createBox(title, content));
}

/**
 * Display situation context
 */
export function displaySituationContext(context: SituationContext): void {
  const content = [
    `${colors.bold}Topic:${colors.reset} ${context.topic}`,
    `${colors.bold}Previous occurrences:${colors.reset} ${context.occurrences.length}`,
    "",
  ];

  // Show recent occurrences
  for (const occ of context.occurrences.slice(0, 3)) {
    content.push(`${colors.cyan}${occ.date.toLocaleDateString()}:${colors.reset} ${occ.summary}`);
    if (occ.tensionPoints.length > 0) {
      content.push(`  ${colors.yellow}Tension:${colors.reset} ${occ.tensionPoints[0]}`);
    }
    if (occ.resolution) {
      content.push(`  ${colors.green}Resolution:${colors.reset} ${occ.resolution}`);
    }
    content.push("");
  }

  // Show patterns
  if (context.patterns.length > 0) {
    content.push(`${colors.bold}Patterns:${colors.reset}`);
    for (const pattern of context.patterns) {
      content.push(`  \u2022 ${pattern}`);
    }
    content.push("");
  }

  // Show what works
  if (context.whatWorks.length > 0) {
    content.push(`${colors.green}${colors.bold}What works:${colors.reset}`);
    for (const w of context.whatWorks) {
      content.push(`  ${colors.green}\u2713${colors.reset} ${w}`);
    }
  }

  console.log(createBox(`Context: ${context.topic}`, content));
}

/**
 * Display relationship health dashboard
 */
export function displayHealthDashboard(metrics: RelationshipHealthMetrics): void {
  const bar = (value: number): string => {
    const filled = Math.round(value / 10);
    const empty = 10 - filled;
    const color = value > 70 ? colors.green : value > 40 ? colors.yellow : colors.red;
    return `${color}${"█".repeat(filled)}${colors.dim}${"░".repeat(empty)}${colors.reset} ${value}%`;
  };

  const content = [
    `Communication Score:  ${bar(metrics.communicationScore)}`,
    `Quality Time:         ${bar(metrics.qualityTimeScore)}`,
    `Surprise Factor:      ${bar(metrics.surpriseFactor)}`,
    `Memory Accuracy:      ${bar(metrics.memoryAccuracy)}`,
    "",
    `${colors.dim}Streak: ${metrics.dramaFreeStreak} drama-free days${colors.reset}`,
    `${colors.dim}Last sync: ${metrics.lastSync.toLocaleString()}${colors.reset}`,
  ];

  console.log(createBox("Relationship Health Dashboard", content));
}

/**
 * Display relationship error with recovery steps
 */
export function displayEmotionalDamage(error: RelationshipError): void {
  const header = `${colors.red}${colors.bold}EMOTIONAL DAMAGE${colors.reset}`;

  const getRecoverySteps = (): string[] => {
    switch (error._tag) {
      case "Relationship/ForgotAnniversaryError":
        return [
          "Do NOT make excuses",
          "Acknowledge the hurt caused",
          `Plan makeup celebration (budget: Rs ${error.suggestedBudget})`,
          "Set up redundant reminders for next time",
        ];
      case "Relationship/SaidCalmDownError":
        return [
          "Stop talking immediately",
          "Wait for them to speak first",
          "Listen without defending",
          "Flowers (optional but recommended)",
        ];
      case "Relationship/LeftOnReadError":
        return [
          "Do NOT double text (yet)",
          "Wait at least 2 hours",
          "If anxiety persists, distract yourself",
          error.canDoubleText ? "One follow-up allowed now" : "Wait longer before follow-up",
        ];
      case "Relationship/ComparedToExError":
        return ["Apologize immediately", "Explain what you meant (briefly)", "Affirm current relationship", "Never do this again"];
      case "Relationship/TriedToFixError":
        return [
          "Stop offering solutions",
          'Say: "That sounds really hard"',
          "Ask if they want help or just listening",
          "Remember: feelings first, solutions later",
        ];
      case "Relationship/UsedLogicOnFeelingsError":
        return [
          "Validate their feelings first",
          "Logic can come later (much later)",
          "Feelings don't need to make sense",
          "Empathy > accuracy",
        ];
      default:
        return ["Reflect on what went wrong", "Apologize sincerely", "Learn for next time"];
    }
  };

  const content = [
    header,
    "",
    `${colors.bold}Error:${colors.reset} ${error._tag.replace("Relationship/", "")}`,
    `${colors.bold}Message:${colors.reset} ${error.message}`,
    "",
    `${colors.dim}Recovery steps:${colors.reset}`,
    ...getRecoverySteps().map((s, i) => `  ${i + 1}. ${s}`),
  ];

  console.log("\n" + createBox("Incident Report", content, 70) + "\n");
}

/**
 * Simple success message
 */
export function success(message: string): void {
  console.log(`${colors.green}\u2713${colors.reset} ${message}`);
}

/**
 * Simple warning message
 */
export function warn(message: string): void {
  console.log(`${colors.yellow}\u26a0${colors.reset} ${message}`);
}

/**
 * Simple error message
 */
export function error(message: string): void {
  console.log(`${colors.red}\u2717${colors.reset} ${message}`);
}

/**
 * Dim helper text
 */
export function hint(message: string): void {
  console.log(`${colors.dim}\ud83d\udca1 ${message}${colors.reset}`);
}

/**
 * Display a tip of the day
 */
export function displayTip(): void {
  const tips = [
    // Classics
    "Remember: 'calm down' has never calmed anyone down in the history of relationships.",
    "Tip: When they say 'fine', the investigation has just begun.",
    "Pro tip: Listening without solving is a superpower. Use it wisely.",
    "Remember: Anniversary math - days late × 2 = recovery time in weeks.",
    "Tip: 'My ex used to...' is never a good way to start a sentence.",
    "Pro tip: When in doubt, food usually helps.",
    "Remember: The question 'Do I look fat in this?' has no correct answer.",
    "Tip: 'Whatever you want' means 'I have a specific preference but won't tell you'.",
    // Developer-themed
    "Debug tip: console.log('fine') always returns undefined.",
    "Remember: Relationships don't have rollbacks. Commit wisely.",
    "The 'k' response is the single-character equivalent of DEFCON 1.",
    "Tip: git blame won't help you here.",
    "Remember: There's no try-catch for feelings.",
    "Pro tip: You can't refactor your way out of this one.",
    "Warning: Emotional state is eventually consistent, not strongly consistent.",
    "Remember: Love is O(1), understanding is O(n²).",
    // Wisdom
    "Tip: Being right is less important than being kind.",
    "Remember: Feelings are features, not bugs.",
    "Pro tip: The 'space' they asked for isn't measured in pixels.",
    "Tip: Async communication requires await patience.",
  ];

  const tip = tips[Math.floor(Math.random() * tips.length)];
  console.log(`\n${colors.dim}${tip}${colors.reset}\n`);
}
