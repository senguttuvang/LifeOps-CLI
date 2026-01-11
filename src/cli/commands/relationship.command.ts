import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { AnalysisServiceTag } from "../../domain/relationship/analysis.service";
import { renderMarkdown } from "../utils/markdown";
import {
  type BreakupForecast,
  type RiskLevel,
  type Warning,
  ForecastServiceTag,
} from "../../domain/forecast";
import { ForecastRepositoryTag } from "../../domain/forecast/forecast.repository";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve a contact identifier to a WhatsApp chat ID
 *
 * Accepts either:
 * - Human-readable name: "Priya" → resolved via contact lookup
 * - Raw WhatsApp JID: "919876543210@s.whatsapp.net" → used directly
 *
 * @returns The resolved chat ID or the original if it looks like a JID
 */
const resolveChatId = (input: string) =>
  Effect.gen(function* () {
    // If it already looks like a WhatsApp JID, use it directly
    if (input.includes("@s.whatsapp.net") || input.includes("@g.us")) {
      return input;
    }

    // Otherwise, try to resolve by name
    const repo = yield* ForecastRepositoryTag;
    const resolved = yield* repo.resolveChatIdByName(input);

    if (resolved) {
      yield* Console.log(`✓ Resolved "${input}" → ${resolved}`);
      return resolved;
    }

    // If not found, treat it as a direct chatId (user knows what they're doing)
    yield* Console.log(`⚠ Name "${input}" not found. Treating as raw chat ID.`);
    return input;
  });

// =============================================================================
// HEALTH REPORT FORMATTING
// =============================================================================

const RISK_COLORS = {
  LOW: "\x1b[32m",
  MODERATE: "\x1b[33m",
  HIGH: "\x1b[31m",
  CRITICAL: "\x1b[35m",
} as const;

const RESET = "\x1b[0m";

function formatRiskLevel(level: RiskLevel): string {
  return `${RISK_COLORS[level]}${level}${RESET}`;
}

function formatTrendArrow(direction: "improving" | "stable" | "declining"): string {
  switch (direction) {
    case "improving":
      return "↗️";
    case "declining":
      return "↘️";
    default:
      return "→";
  }
}

function formatWarningIcon(severity: Warning["severity"]): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟡";
    default:
      return "🔵";
  }
}

function formatScore(score: number): string {
  const bars = Math.round(score / 10);
  return "█".repeat(bars) + "░".repeat(10 - bars);
}

function renderForecastReport(forecast: BreakupForecast): void {
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  💔 Relationship Health Forecast                            │");
  console.log(
    `│  Partner: ${forecast.contactName.substring(0, 20).padEnd(20)} | Last ${String(forecast.analysisWindow.days).padStart(2)} days      │`,
  );
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Health Score: ${Math.round(forecast.healthScore)}/100                                       │`);
  console.log(`│  Risk Level: ${formatRiskLevel(forecast.riskLevel).padEnd(25)}                       │`);
  console.log(
    `│  Trend: ${formatTrendArrow(forecast.trend.direction)} ${forecast.trend.direction.padEnd(10)} (${forecast.trend.velocity > 0 ? "+" : ""}${forecast.trend.velocity.toFixed(1)} pts/wk)          │`,
  );
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  📊 Component Scores                                        │");
  console.log("├─────────────────────────────────────────────────────────────┤");

  const h = forecast.components.fourHorsemen;
  console.log(`│  Horsemen:  ${formatScore(h.score)} ${Math.round(h.score).toString().padStart(3)}/100              │`);
  console.log(
    `│  └─ C:${h.criticismCount} Co:${h.contemptCount}${h.contemptCount > 0 ? "⚠️" : ""} D:${h.defensivenessCount} S:${h.stonewallingCount}                                 │`,
  );

  const r = forecast.components.ratio;
  const ratioIcon = r.status === "healthy" ? "✅" : r.status === "borderline" ? "⚠️" : "🔴";
  console.log(
    `│  Ratio:     ${formatScore(r.score)} ${Math.round(r.score).toString().padStart(3)}/100 (${r.ratio.toFixed(1)}:1) ${ratioIcon}     │`,
  );

  const e = forecast.components.engagement;
  console.log(`│  Engage:    ${formatScore(e.score)} ${Math.round(e.score).toString().padStart(3)}/100              │`);

  const c = forecast.components.connection;
  const connIcon = c.status === "connected" ? "✅" : c.status === "drifting" ? "⚠️" : "🔴";
  console.log(
    `│  Connect:   ${formatScore(c.score)} ${Math.round(c.score).toString().padStart(3)}/100 ${connIcon}             │`,
  );

  if (forecast.warnings.length > 0) {
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log("│  ⚠️  Warnings                                               │");
    for (const w of forecast.warnings.slice(0, 3)) {
      console.log(`│  ${formatWarningIcon(w.severity)} ${w.title.substring(0, 50).padEnd(50)}   │`);
    }
  }

  if (forecast.recommendations.length > 0) {
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log("│  💡 Actions                                                 │");
    for (const rec of forecast.recommendations.slice(0, 2)) {
      const icon = rec.priority === "high" ? "🔴" : "🟡";
      console.log(`│  ${icon} ${rec.title.substring(0, 50).padEnd(50)}   │`);
    }
  }

  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(
    `│  📈 30-Day: ~${Math.round(forecast.trend.predictedScoreIn30Days)}/100 | Confidence: ${Math.round(forecast.confidence * 100)}% (${forecast.messageCount} msgs)    │`,
  );
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");
}

// =============================================================================
// SUBCOMMANDS
// =============================================================================

// Subcommand: Analyze (LLM-based)
const AnalyzeCommand = Command.make(
  "analyze",
  {
    contact: Args.text({ name: "contact" }).pipe(
      Args.withDescription("Contact name (e.g., 'Priya') or WhatsApp JID")
    ),
  },
  ({ contact }) =>
    Effect.gen(function* (_) {
      // Resolve name to WhatsApp chat ID
      const chatId = yield* _(resolveChatId(contact));

      const analysis = yield* _(AnalysisServiceTag);
      yield* _(Console.log(`Indexing chat: ${chatId}...`));
      yield* _(analysis.indexChat(chatId));

      yield* _(Console.log(`Analyzing chat: ${chatId}...`));

      const result = yield* _(analysis.analyze(chatId));

      yield* _(Console.log("\n" + "─".repeat(60)));
      yield* _(Console.log("  💕 Relationship Analysis Report"));
      yield* _(Console.log("─".repeat(60) + "\n"));

      // Render markdown with colors and formatting
      console.log(renderMarkdown(result));

      yield* _(Console.log("\n" + "─".repeat(60) + "\n"));
    }),
);

// Subcommand: Draft
const DraftCommand = Command.make(
  "draft",
  {
    contact: Args.text({ name: "contact" }).pipe(
      Args.withDescription("Contact name (e.g., 'Priya') or WhatsApp JID")
    ),
    intent: Args.text({ name: "intent" }),
  },
  ({ contact, intent }) =>
    Effect.gen(function* (_) {
      // Resolve name to WhatsApp chat ID
      const chatId = yield* _(resolveChatId(contact));

      const analysis = yield* _(AnalysisServiceTag);
      yield* _(Console.log(`Drafting response for ${contact} with intent: "${intent}"...`));

      const result = yield* _(analysis.draftResponse(chatId, intent));

      yield* _(Console.log("\n" + "─".repeat(60)));
      yield* _(Console.log("  ✍️  Suggested Response"));
      yield* _(Console.log("─".repeat(60) + "\n"));

      // Render markdown with colors and formatting
      console.log(renderMarkdown(result));

      yield* _(Console.log("\n" + "─".repeat(60) + "\n"));
    }),
);

// Subcommand: Health (Breakup Forecasting)
const HealthCommand = Command.make(
  "health",
  {
    contact: Options.text("contact").pipe(Options.withDescription("Contact name to analyze"), Options.optional),
    days: Options.integer("days").pipe(
      Options.withDescription("Days to analyze (default: 30)"),
      Options.withDefault(30),
    ),
    json: Options.boolean("json").pipe(Options.withDescription("Output as JSON"), Options.withDefault(false)),
    list: Options.boolean("list").pipe(
      Options.withDescription("List all partner relationships"),
      Options.withDefault(false),
    ),
  },
  ({ contact, days, json, list }) =>
    Effect.gen(function* (_) {
      const repo = yield* _(ForecastRepositoryTag);
      const forecastService = yield* _(ForecastServiceTag);

      if (list) {
        console.log("\n📊 Partner Relationships Health Overview\n");
        const relationships = yield* _(repo.getPartnerRelationships());

        if (relationships.length === 0) {
          console.log("No partner relationships found.");
          console.log("Mark a contact as 'partner' type to enable forecasting.\n");
          return;
        }

        console.log("Contact".padEnd(25) + "Health".padEnd(10) + "Risk".padEnd(12) + "Trend");
        console.log("─".repeat(60));

        for (const rel of relationships) {
          // v3: contactId → partyId, contactName → partyName
          const messages = yield* _(repo.getMessagesForContact(rel.partyId, 30));
          if (messages.length < 10) {
            console.log(
              `${rel.partyName.substring(0, 24).padEnd(25)}${"N/A".padEnd(10)}${"N/A".padEnd(12)}Insufficient data`,
            );
            continue;
          }

          const forecast = yield* _(
            forecastService.generateForecast(
              { id: rel.partyId, name: rel.partyName, relationshipType: "partner" },
              messages.map((m) => ({ id: m.id, text: m.text || "", timestamp: m.timestamp, fromMe: m.fromMe })),
            ),
          );

          console.log(
            `${rel.partyName.substring(0, 24).padEnd(25)}` +
              `${Math.round(forecast.healthScore).toString().padEnd(10)}` +
              `${forecast.riskLevel.padEnd(12)}` +
              `${formatTrendArrow(forecast.trend.direction)} ${forecast.trend.direction}`,
          );
        }
        console.log("\nRun 'lifeops relationship health --contact \"Name\"' for details.\n");
        return;
      }

      if (!contact._tag || contact._tag === "None") {
        console.log('\n❌ Specify contact: --contact "Partner Name"');
        console.log("Or list all: --list\n");
        return;
      }

      const contactName = contact.value;
      const foundContact = yield* _(repo.findContactByName(contactName));

      if (!foundContact) {
        console.log(`\n❌ Contact "${contactName}" not found.\n`);
        return;
      }

      const messages = yield* _(repo.getMessagesForContact(foundContact.id, days));

      if (messages.length < 10) {
        console.log(`\n⚠️  Need 10+ messages. Found ${messages.length} in ${days} days.\n`);
        return;
      }

      const forecast = yield* _(
        forecastService.generateForecast(
          { id: foundContact.id, name: foundContact.displayName, relationshipType: "partner" },
          messages.map((m) => ({ id: m.id, text: m.text || "", timestamp: m.timestamp, fromMe: m.fromMe })),
        ),
      );

      if (json) {
        console.log(JSON.stringify(forecast, null, 2));
      } else {
        renderForecastReport(forecast);
      }
    }),
);

// Parent Command: Relationship
export const relationshipCommand = Command.make("relationship").pipe(
  Command.withSubcommands([AnalyzeCommand, DraftCommand, HealthCommand]),
);
