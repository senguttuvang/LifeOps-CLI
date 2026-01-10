# @lifeops/cli

> Relationship Intelligence CLI. Because "fine" rarely means fine.

A personal relationship management CLI that syncs WhatsApp messages to a local database and provides AI-powered relationship insights using local RAG (Retrieval-Augmented Generation).

## Features

- **WhatsApp Sync**: Sync messages from WhatsApp Web to local SQLite database
- **Fine Decoder**: Decode the true meaning behind messages (what they said vs. what they meant)
- **Memory Capture**: Remember important relationship moments and context
- **Relationship Analysis**: AI-powered insights about communication patterns
- **Local-First**: All data stored locally - your conversations never leave your machine
- **Effect-TS Architecture**: Type-safe functional programming with explicit errors

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | [Bun](https://bun.sh) | Fast JavaScript runtime |
| Framework | [Effect-TS](https://effect.website) | Type-safe functional programming |
| Database | [Drizzle ORM](https://orm.drizzle.team) + SQLite | Type-safe SQL with local storage |
| Vector DB | [LanceDB](https://lancedb.github.io/lancedb/) | Local vector embeddings for RAG |
| AI | Anthropic Claude + OpenAI | Text generation and embeddings |
| WhatsApp | [whatsmeow](https://github.com/tulir/whatsmeow) | WhatsApp Web protocol |

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- WhatsApp account

### Setup

```bash
# Clone repository
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli

# Install dependencies
bun install

# Initialize database
bunx drizzle-kit push

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### WhatsApp Authentication

```bash
# Check authentication status
bun run cli health

# If not authenticated, scan QR code
./bin/whatsmeow-cli auth qr
```

## Usage

### CLI Commands

```bash
# Show available commands
bun run cli

# Sync WhatsApp messages (default: last 30 days)
bun run cli sync

# Sync specific number of days
bun run cli sync --days=7

# Decode a message (what they really meant)
bun run cli decode "I'm fine"

# Remember something important
bun run cli remember "First date at that coffee shop"

# Check system health
bun run cli health
```

### Example: Fine Decoder

```bash
$ bun run cli decode "I'm fine"

🔍 Fine Decoder™ Analysis

Message: "I'm fine"

What they said: Fine
What they meant: Not fine
Confidence: 97%

Recommended response: "I can tell something's up. Want to talk about it?"
```

## Configuration

Configure via environment variables (`.env`):

```bash
# Required API Keys
ANTHROPIC_API_KEY=your-key      # Claude API
OPENAI_API_KEY=your-key         # Embeddings
OPENROUTER_API_KEY=your-key     # Vision models

# WhatsApp
SELF_CHAT_ID=1234567890@s.whatsapp.net

# Optional: Custom paths
LIFEOPS_DB_PATH=lifeops.db
LIFEOPS_VECTOR_PATH=data/lancedb
```

## Architecture

```
src/
├── cli/                 # CLI commands
│   ├── commands/        # Command implementations
│   └── main.ts          # Entry point
├── domain/              # Business logic
│   ├── relationship/    # Analysis & drafting
│   ├── signals/         # Behavioral signal extraction
│   └── whatsapp/        # Sync & event extraction
└── infrastructure/      # External integrations
    ├── db/              # SQLite via Drizzle
    ├── llm/             # AI services
    ├── rag/             # Vector store
    └── whatsapp/        # WhatsApp adapter
```

## Privacy

Your data stays on your machine:

- All messages stored in local SQLite database
- Vector embeddings stored in local LanceDB
- API calls send only the data you explicitly analyze
- No telemetry, no cloud sync, no third-party access

## FAQ

### Is this legal?

You're analyzing your own messages from your own conversations. Use at your own risk.

### Why local-first?

Your relationship conversations are intimate data. They belong on your machine, not someone else's server.

### What about other platforms?

Currently focused on WhatsApp. PRs welcome for other platforms.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

### Code Style

- Effect-TS patterns (Effect.gen, Context.Tag, Layer)
- Explicit error handling (no throw)
- TypeScript strict mode

## License

MIT - See [LICENSE](LICENSE) for details.

---

**Built with [Effect-TS](https://effect.website) for type-safe functional programming.**
