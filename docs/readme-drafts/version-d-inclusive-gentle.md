# Version D: Inclusive & Gentle

> Consumer tone, welcoming and non-judgmental - emphasizes ALL relationships

---

# @lifeops/cli

> Helping you nurture the relationships that matter to you.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Everyone Has Someone They Care About

Maybe it's a partner. Maybe it's your parents. Your best friend from college. A colleague who's become more than just a work acquaintance. Your kids, your siblings, your neighbor who always checks in on you.

Relationships take many forms, and they all deserve attention.

**LifeOps** is a simple tool that helps you stay present in the relationships you value—by remembering context, noticing patterns, and helping you show up when it matters.

## What You Can Do

### 💭 Remember What Matters

```bash
bun run cli remember "Amma mentioned wanting to visit Madurai temple"
bun run cli remember "Raj's startup pitch is next Friday"
bun run cli remember "Coffee order: oat milk latte, no sugar"
```

Store important details from your conversations. Retrieve them when you need them.

### 🔍 Understand Better

```bash
bun run cli decode "I suppose we could do that"
```

Sometimes messages are hard to read. Get gentle insights on tone and meaning—not to overthink, but to understand.

### 📊 See Patterns

Track communication across your relationships. Notice when you've been out of touch. Understand how your conversations flow over time.

### ✍️ Find Words When You're Stuck

Get thoughtful message suggestions when you want to reach out but aren't sure how. Always your choice to use, modify, or ignore.

## For Every Kind of Relationship

| Relationship | How LifeOps Helps |
|-------------|------------------|
| **Partner/Spouse** | Remember preferences, dates, and the small things that show you're paying attention |
| **Parents** | Keep track of their lives even when you can't talk every day |
| **Children** | Notice when they mention something important in passing |
| **Friends** | Be the friend who follows up, who remembers, who shows up |
| **Colleagues** | Maintain professional relationships with genuine thoughtfulness |
| **Extended Family** | Stay connected despite distance and busy schedules |

## Your Privacy, Protected

- **Everything stays on your computer** — No cloud, no servers
- **You decide what to analyze** — AI only sees what you explicitly ask
- **No tracking** — We don't collect usage data
- **Your conversations remain yours** — We can't see them, even if we wanted to

## Getting Started

```bash
# Quick setup
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install
bunx drizzle-kit push
cp .env.example .env  # Add your API keys

# Connect WhatsApp
./bin/whatsmeow-cli auth qr

# You're ready
bun run cli sync
bun run cli health
```

## Our Philosophy

We believe:

- **Caring enough to use tools IS caring.** Writing a birthday on a calendar isn't cheating—it's making sure you don't let someone down.

- **Memory aids are just that—aids.** They help you show up. They don't replace genuine connection.

- **All relationships matter.** A tool for "relationship management" isn't just for romantic partners. It's for anyone you want to stay close to.

- **Technology should serve connection, not replace it.** LifeOps helps you be more present by handling the cognitive load of remembering details.

## A Gentle Note

This tool uses unofficial WhatsApp protocols. It's designed for personal use—analyzing your own conversations to be more thoughtful. Please:

- Use it for good
- Don't use it to monitor or stalk anyone
- Be aware that WhatsApp's terms technically don't support third-party tools

We've built this carefully, but you should know the landscape.

## Learn More

- 📖 [FAQ](docs/faq.md) — Real questions, honest answers
- 🔧 [How It Works](docs/tech-stack.md) — Technical details
- 🗺️ [Roadmap](docs/roadmap.md) — What's coming

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a>
  <br><br>
  <em>For everyone who cares about someone.</em>
</p>
