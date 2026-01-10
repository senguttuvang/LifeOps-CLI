# Version A: Warm Professional

> Enterprise tone but kind and supportive - for busy professionals who care

---

# @lifeops/cli

> A personal relationship assistant that helps you remember what matters.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

Life gets busy. Between work, responsibilities, and the constant flow of messages, it's easy to miss the small things—the coffee order she mentioned last week, your friend's job interview coming up, or that your mom's been stressed about something lately.

**LifeOps** is a personal CLI tool that helps you stay connected to the people you care about. It syncs your WhatsApp conversations locally and uses AI to surface insights, remember context, and help you be more thoughtful—not because you don't care, but because caring shouldn't require a perfect memory.

## What It Does

| Feature | How It Helps |
|---------|-------------|
| **Message Sync** | Keeps a local, searchable archive of your conversations |
| **Context Memory** | "Remember: she wants to visit Iceland" — stored and retrievable |
| **Pattern Insights** | Notice when someone mentions stress repeatedly, or communication changes |
| **Draft Assistance** | AI-powered message suggestions when you need them (you always review first) |
| **Health Overview** | Understand communication patterns across your relationships |

## Who It's For

LifeOps works for **any relationship** you want to nurture:

- **Partners & Spouses** — Remember anniversaries, preferences, and the little things
- **Family** — Keep track of what's happening in everyone's lives
- **Close Friends** — Never forget to follow up on important moments
- **Colleagues** — Maintain professional relationships thoughtfully

## Quick Example

```bash
# Sync your recent conversations
bun run cli sync --days=7

# Save something important to remember
bun run cli remember "Dad mentioned wanting to learn photography"

# Get AI help understanding a message
bun run cli decode "It's fine, don't worry about it"
# → "This may indicate disappointment. Consider following up gently."
```

## Privacy First

Your conversations are personal. LifeOps respects that:

- **Everything stays on your machine** — Local SQLite database, no cloud sync
- **You control what's analyzed** — AI only sees what you explicitly ask it to
- **No tracking or telemetry** — We don't collect usage data

## Important Considerations

**WhatsApp Terms of Service**: This tool uses unofficial WhatsApp Web protocols. While designed for personal use analyzing your own conversations, please be aware this operates in a gray area. Use responsibly.

**This is a memory aid, not a replacement for genuine care.** The goal is to help you *be* more thoughtful, not to *appear* thoughtful. If you're using tools like this to fake engagement, the relationship has bigger issues.

## Getting Started

```bash
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install
bunx drizzle-kit push
cp .env.example .env  # Add your API keys
./bin/whatsmeow-cli auth qr  # Connect WhatsApp
```

## Learn More

- **[Full Documentation](docs/)** — Setup guides and feature details
- **[FAQ](docs/faq.md)** — Common questions answered honestly
- **[Architecture](docs/architecture.md)** — Technical deep-dive

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a> ·
  Built for people who care about people
</p>
