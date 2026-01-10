# @lifeops/cli

> **Relationship Intelligence Platform™**
>
> Because "fine" rarely means fine.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

**LifeOps** applies enterprise-grade observability patterns to the most complex distributed system you'll ever manage: your relationships.

We've taken everything you hate about corporate software—SLAs, dashboards, incident response—and applied it to the one area where you actually need it: remembering that she mentioned wanting to visit Iceland 3 weeks ago.

## The Problem

You're a competent professional. You manage production systems handling millions of requests. You've got monitoring, alerting, and runbooks for everything.

And yet:
- You forgot the anniversary (again)
- You missed the subtle "I'm stressed" signals for 3 days straight
- You have no idea what gift she actually wants (hint: she told you. Twice.)

**LifeOps fixes this.** We're not relationship therapy. We're relationship *observability*.

## What You Get

### 🔍 The Fine Decoder™

```bash
$ bun run cli decode "I'm fine"

🔍 Fine Decoder™ Analysis

Message: "I'm fine"

What they said: Fine
What they meant: Not fine
Confidence: 97%

Recommended response: "I can tell something's up. Want to talk about it?"
```

Finally, a system that understands subtext. Like Prometheus metrics, but for emotional state.

### 📊 Relationship Observability

| Feature | Corporate Equivalent | What It Actually Does |
|---------|---------------------|----------------------|
| **Message Sync** | Log aggregation | Syncs WhatsApp messages locally (your data, your machine) |
| **Signal Extraction** | Anomaly detection | Detects stress patterns, mood shifts, important dates mentioned |
| **Memory Capture** | Event sourcing | "Remember: she wants to visit Iceland" stored and retrievable |
| **Health Dashboard** | SLA monitoring | Communication balance, response times, engagement trends |
| **Draft Assistance** | Auto-remediation | AI-powered message drafts when you need them |

### 🎯 Core Capabilities

- **Sync**: Pull your WhatsApp history to a local database
- **Decode**: Translate "I'm fine" into actionable intelligence
- **Remember**: Store important context AI can use later
- **Analyze**: Communication patterns across all your relationships
- **Draft**: Context-aware message suggestions (you still press send)

### 🔒 Privacy-First Architecture

Your relationship data is *intimate data*. It stays on your machine:

- Local SQLite database (not someone else's server)
- Local vector embeddings for AI (no cloud RAG)
- API calls only when you explicitly trigger analysis
- No telemetry, no tracking, no "we value your privacy" doublespeak

## Quick Start

```bash
# Install
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli
bun install

# Initialize
bunx drizzle-kit push
cp .env.example .env
# Add your API keys

# Authenticate WhatsApp
./bin/whatsmeow-cli auth qr

# Start using
bun run cli sync
bun run cli decode "I'm fine"
bun run cli remember "She wants to visit Iceland"
```

## Usage Examples

```bash
# Sync recent messages
bun run cli sync --days=7

# Decode cryptic messages
bun run cli decode "Sure, whatever you want"
# → Translation: "I have a strong preference you should know by now"

# Remember important context
bun run cli remember "Her mom's birthday is March 15"

# Check system health
bun run cli health
```

## FAQ (The Honest Version)

**"Is this creepy?"**
> You're analyzing your own conversations to be more thoughtful. The bar is low, friend.

**"What if I don't have a girlfriend?"**
> Works for any relationship. Friends, family, that one colleague who's impossible to read.

**"Should I tell my partner I use this?"**
> That's between you and your conscience. We just provide the tools.

**"What if I message the wrong person?"**
> Read-only by default. All AI outputs are drafts. You press send. We gave you safeties.

**See full FAQ →** [docs/faq.md](docs/faq.md)

## The Tech (For Those Who Care)

We're built on a modern TypeScript stack with functional programming patterns. If terms like "Effect-TS", "Drizzle ORM", and "local-first RAG" excite you, see our technical documentation:

- **[Architecture](docs/architecture.md)** — Domain-driven design, bounded contexts
- **[Why Effect-TS](docs/why-effect.md)** — Error handling that doesn't gaslight you
- **[Why TypeScript](docs/why-typescript.md)** — Type safety for emotional safety

## Philosophy

LifeOps is a **memory aid**, not a manipulation tool.

- ✅ Using a calendar to remember your anniversary? That's fine.
- ❌ Forgetting your anniversary? That's the problem.
- ✅ Using AI to help you BE thoughtful? That's LifeOps.
- ❌ Using AI to FAKE thoughtfulness? Get therapy.

Technology amplifies intent. If your intent is good, LifeOps helps. If it's not, we don't want your business.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

See [docs/architecture.md](docs/architecture.md) for code patterns.

## License

MIT — See [LICENSE](LICENSE)

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a> ·
  <a href="docs/faq.md">FAQ</a> ·
  <a href="docs/architecture.md">Architecture</a>
</p>

<p align="center">
  <em>Built by people who also forget birthdays.</em>
</p>
