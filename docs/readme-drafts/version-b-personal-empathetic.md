# Version B: Personal & Empathetic

> Consumer tone, heartfelt and genuine - acknowledges human struggle

---

# @lifeops/cli

> Because remembering matters. And sometimes we need a little help.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

We've all been there.

Your partner mentioned wanting to try that new restaurant. Your mom said something about a doctor's appointment. Your best friend is stressed about work, but you can't remember the details.

You care. Of course you care. But life moves fast, messages pile up, and important things slip through the cracks. It doesn't mean you're a bad partner, friend, or child. It just means you're human.

**LifeOps** is a personal tool that helps you hold onto the things that matter in your relationships.

## How It Helps

🔍 **Remember Context**
> "She mentioned wanting to visit Iceland three weeks ago."

Save important details from conversations so you can recall them when it matters—for gift ideas, planning, or just showing you were listening.

💬 **Understand Better**
> "When she says 'I'm fine,' she might not be. Here's what to consider..."

Get gentle insights on messages that feel ambiguous. Not to manipulate—to understand.

📊 **Stay Connected**
> "You haven't reached out to Dad in 2 weeks."

Gentle nudges to maintain the relationships that matter to you.

✍️ **Find the Right Words**
> "Here's a thoughtful way to check in..."

When you want to reach out but aren't sure what to say, get suggestions you can adapt and make your own.

## Who This Is For

This isn't just for romantic relationships. LifeOps helps with:

- **Partners & Spouses** — The small things add up over years
- **Parents & Family** — Stay present even when life gets busy
- **Close Friends** — Be the friend who remembers
- **Anyone you care about** — No relationship is too small to nurture

## What Makes It Different

**Your data stays yours.** Everything is stored locally on your computer. Your conversations never leave your machine. No cloud, no servers watching, no data mining.

**You're always in control.** LifeOps suggests, you decide. Every message draft requires your review and approval. We never send anything automatically.

**It's a memory aid, not a manipulation tool.** Using a calendar to remember your anniversary isn't cheating—forgetting it is. LifeOps works the same way.

## Getting Started

```bash
# Set up (5 minutes)
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install
bunx drizzle-kit push
cp .env.example .env  # Add your API keys

# Connect WhatsApp
./bin/whatsmeow-cli auth qr

# Start using
bun run cli sync                    # Sync recent messages
bun run cli remember "Mom's birthday is March 15"
bun run cli decode "Sure, whatever you want"
```

## A Note on Ethics

LifeOps is built on a simple belief: **caring enough to use tools IS caring.**

If you forget your partner's birthday, you can't undo the hurt by saying "but I love you." Love is also about showing up, remembering, and paying attention.

We're not here to help you fake anything. We're here to help the love you already have show up more consistently.

## Learn More

- 📖 **[FAQ](docs/faq.md)** — Honest answers to real questions
- 🔧 **[Technical Docs](docs/tech-stack.md)** — For the curious
- 🏗️ **[Architecture](docs/architecture.md)** — How it's built

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a>
  <br>
  <em>Built by people who also forget birthdays.</em>
</p>
