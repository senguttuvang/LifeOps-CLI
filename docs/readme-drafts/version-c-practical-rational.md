# Version C: Practical & Risk-Aware

> Consumer tone, rational and honest about limitations/risks

---

# @lifeops/cli

> A local-first relationship memory tool. Your data, your machine.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

LifeOps syncs your WhatsApp messages to a local database and uses AI to help you remember context, understand communication patterns, and be more thoughtful in your relationships.

## What It Does

- **Sync Messages** — Pull WhatsApp history to a local SQLite database
- **Remember Context** — Store important details ("She wants to visit Iceland")
- **Decode Messages** — AI analysis of ambiguous messages
- **Track Patterns** — Communication frequency, topics, sentiment over time
- **Draft Messages** — AI-assisted suggestions (you review and send)

## Key Features

```bash
bun run cli sync --days=30          # Sync last 30 days
bun run cli remember "Dad's surgery is next Tuesday"
bun run cli decode "I guess that works"
bun run cli health                  # System status check
```

## Privacy Architecture

| Concern | How We Address It |
|---------|------------------|
| **Data location** | Everything stored locally in `~/lifeops.db` |
| **Cloud sync** | None. Zero. Your data never leaves your machine. |
| **AI processing** | Only when you explicitly request it |
| **Telemetry** | None. We don't track usage. |

## Important: Know the Risks

### WhatsApp Terms of Service

This tool uses [whatsmeow](https://github.com/tulir/whatsmeow), an unofficial WhatsApp Web protocol implementation. You should know:

- **WhatsApp doesn't officially support third-party clients**
- **Your account could theoretically be banned** (though rare for personal use)
- **We recommend using this for personal analysis only**, not automation or bulk operations
- **Don't use this for spamming, stalking, or any harmful purpose**

We've designed LifeOps to be as gentle as possible—it syncs at reasonable intervals and doesn't perform actions that trigger rate limits. But the risk exists, and you should be aware.

### Ethical Use

LifeOps is a **memory aid**. It helps you be more thoughtful by remembering context you'd otherwise forget.

**Good uses:**
- Remembering your partner's preferences and important dates
- Noticing when a friend seems stressed based on conversation patterns
- Keeping track of what's happening in family members' lives

**Not okay:**
- Stalking or monitoring someone without their knowledge
- Using insights to manipulate or gaslight
- Analyzing conversations of people who haven't consented

Technology amplifies intent. Use it well.

## Setup

### Prerequisites
- [Bun](https://bun.sh) runtime
- WhatsApp account
- API keys for AI features (Anthropic, OpenAI)

### Installation

```bash
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli
bun install
bunx drizzle-kit push
cp .env.example .env
# Edit .env with your API keys
./bin/whatsmeow-cli auth qr
```

### Configuration

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...     # Claude for text generation
OPENAI_API_KEY=sk-...            # Embeddings

# Optional
OPENROUTER_API_KEY=sk-or-...     # Vision models
SELF_CHAT_ID=1234567890@s.whatsapp.net
```

## Works For All Relationships

Despite the romantic relationship examples, LifeOps works for any relationship:

- Partners and spouses
- Parents and family
- Close friends
- Professional contacts
- Anyone you want to stay connected with

## Documentation

- **[FAQ](docs/faq.md)** — Common questions
- **[Tech Stack](docs/tech-stack.md)** — Under the hood
- **[Architecture](docs/architecture.md)** — System design

## License

MIT — See [LICENSE](LICENSE)

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a> ·
  <a href="docs/faq.md">FAQ</a> ·
  <a href="docs/architecture.md">Docs</a>
</p>
