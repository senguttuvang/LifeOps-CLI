/**
 * Contacts Command
 *
 * Manage contact names and relationships.
 *
 * Subcommands:
 * - setup: Interactive wizard to configure contacts
 * - list: List all configured contacts
 */

import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import React from "react";
import { render } from "ink";

import {
  ForecastRepositoryTag,
  type ContactWithJid,
} from "../../domain/forecast/forecast.repository";
import { ContactSetup, type ContactSetupResult } from "../components/ContactSetup";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Run the interactive Ink contact setup UI
 */
const runContactSetup = (
  contacts: ContactWithJid[]
): Effect.Effect<ContactSetupResult[], Error> =>
  Effect.async((resume) => {
    let instance: ReturnType<typeof render> | null = null;

    const handleComplete = (results: ContactSetupResult[]) => {
      if (instance) {
        instance.unmount();
      }
      resume(Effect.succeed(results));
    };

    const handleCancel = () => {
      if (instance) {
        instance.unmount();
      }
      resume(Effect.fail(new Error("Setup cancelled by user")));
    };

    // Map to ContactInfo format expected by component
    const contactInfos = contacts.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      preferredName: c.preferredName,
      whatsappJid: c.whatsappJid || "",
      relationshipType: c.relationshipType,
      messageCount: c.messageCount,
    }));

    instance = render(
      React.createElement(ContactSetup, {
        contacts: contactInfos,
        onComplete: handleComplete,
        onCancel: handleCancel,
      })
    );

    // Cleanup function
    return Effect.sync(() => {
      if (instance) {
        instance.unmount();
      }
    });
  });

// =============================================================================
// SUBCOMMANDS
// =============================================================================

/**
 * Setup Command - Interactive wizard to configure contacts
 */
const SetupCommand = Command.make(
  "setup",
  {
    unconfigured: Options.boolean("unconfigured").pipe(
      Options.withDescription("Only show contacts without relationships"),
      Options.withDefault(false)
    ),
  },
  ({ unconfigured }) =>
    Effect.gen(function* () {
      const repo = yield* ForecastRepositoryTag;

      yield* Console.log("\n📇 Loading contacts...\n");

      // Get all contacts for setup
      const allContacts = yield* repo.getContactsForSetup();

      // Filter to only those with WhatsApp conversations
      let contacts = allContacts.filter((c) => c.whatsappJid !== null);

      // Optionally filter to unconfigured only
      if (unconfigured) {
        contacts = contacts.filter((c) => c.relationshipType === null);
      }

      if (contacts.length === 0) {
        if (unconfigured) {
          yield* Console.log("✅ All contacts are already configured!");
        } else {
          yield* Console.log("No contacts found. Run 'bun run cli sync' first.");
        }
        return;
      }

      yield* Console.log(`Found ${contacts.length} contacts to configure.\n`);

      // Run interactive setup
      const results = yield* runContactSetup(contacts);

      if (results.length === 0) {
        yield* Console.log("\nNo contacts were configured.");
        return;
      }

      // Save results to database
      yield* Console.log(`\n💾 Saving ${results.length} relationships...\n`);

      for (const result of results) {
        yield* repo.saveRelationship(result);
      }

      yield* Console.log("✅ Contacts configured successfully!\n");

      // Show summary
      const summary = results.reduce(
        (acc, r) => {
          acc[r.relationshipType] = (acc[r.relationshipType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      yield* Console.log("Summary:");
      for (const [type, count] of Object.entries(summary)) {
        const emoji =
          type === "partner" ? "💕" :
          type === "family" ? "👨‍👩‍👧" :
          type === "friend" ? "🤝" :
          type === "colleague" ? "💼" : "👋";
        yield* Console.log(`  ${emoji} ${type}: ${count}`);
      }
    })
);

/**
 * List Command - Show all configured contacts
 */
const ListCommand = Command.make(
  "list",
  {
    all: Options.boolean("all").pipe(
      Options.withDescription("Show all contacts, not just configured ones"),
      Options.withDefault(false)
    ),
  },
  ({ all }) =>
    Effect.gen(function* () {
      const repo = yield* ForecastRepositoryTag;

      const contacts = yield* repo.getContactsForSetup();

      // Filter based on --all flag
      const toShow = all ? contacts : contacts.filter((c) => c.relationshipType !== null);

      if (toShow.length === 0) {
        yield* Console.log("\nNo contacts configured. Run 'bun run cli contacts setup' first.\n");
        return;
      }

      yield* Console.log("\n📇 Contacts\n");
      yield* Console.log("─".repeat(70));
      yield* Console.log(
        "Name".padEnd(25) +
        "Relationship".padEnd(15) +
        "WhatsApp".padEnd(25) +
        "Msgs"
      );
      yield* Console.log("─".repeat(70));

      for (const contact of toShow) {
        const name = (contact.preferredName || contact.displayName).substring(0, 24);
        const rel = contact.relationshipType || "-";
        const jid = contact.whatsappJid?.replace("@s.whatsapp.net", "") || "-";

        yield* Console.log(
          name.padEnd(25) +
          rel.padEnd(15) +
          jid.substring(0, 24).padEnd(25) +
          String(contact.messageCount)
        );
      }

      yield* Console.log("─".repeat(70));
      yield* Console.log(`Total: ${toShow.length} contacts\n`);
    })
);

// =============================================================================
// PARENT COMMAND
// =============================================================================

export const contactsCommand = Command.make("contacts").pipe(
  Command.withSubcommands([SetupCommand, ListCommand])
);
