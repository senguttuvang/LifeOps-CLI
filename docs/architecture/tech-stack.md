# Tech Stack

> The nerdy details for those who appreciate good architecture decisions.

## Overview

LifeOps CLI is built with a modern TypeScript stack emphasizing:
- **Type Safety**: Errors caught at compile time, not runtime
- **Local-First**: Your data never leaves your machine
- **Functional Patterns**: Effect-TS for explicit error handling and dependency injection

## Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | [Bun](https://bun.sh) | Fast JavaScript runtime, built-in TypeScript, better than Node |
| **Framework** | [Effect-TS](https://effect.website) | Type-safe functional programming with explicit errors |
| **Database** | [Drizzle ORM](https://orm.drizzle.team) + SQLite | Type-safe SQL, local storage, no server needed |
| **Vector DB** | [LanceDB](https://lancedb.github.io/lancedb/) | Local vector embeddings for RAG without cloud dependencies |
| **AI** | Anthropic Claude + OpenAI | Text generation (Claude) and embeddings (OpenAI) |
| **WhatsApp** | [whatsmeow](https://github.com/tulir/whatsmeow) | WhatsApp Web protocol implementation in Go |
| **CLI** | [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) | Type-safe CLI framework built on Effect |

## Why These Choices?

### Bun over Node

- Native TypeScript execution (no build step for dev)
- 3x faster `bun install` than npm
- Built-in test runner, bundler, and more
- Compatible with Node.js packages

### Effect-TS over Plain TypeScript

Traditional async/await hides failure modes:

```typescript
// Plain TS: What can go wrong? 🤷
async function analyze(chatId: string): Promise<Analysis> {
  const messages = await db.query(chatId);  // DB error? Network error?
  return ai.analyze(messages);               // API error? Rate limit?
}

// Effect: Everything is explicit
const analyze = (chatId: string): Effect.Effect<
  Analysis,
  DatabaseError | AIError,      // ← These can fail
  DatabaseService | AIService   // ← These are required
> => ...
```

See [why-effect.md](why-effect.md) for the full explanation.

### SQLite + Drizzle over PostgreSQL

- **No server needed**: Single file database
- **Privacy**: Data stays on your machine
- **Drizzle ORM**: Type-safe queries, migrations, schema as code
- **WAL mode**: Concurrent reads during writes

### LanceDB over Pinecone/Weaviate

- **Local-first**: Embeddings stored on disk, not in cloud
- **No API costs**: Pay once for embedding generation
- **Privacy**: Vector search without network calls
- **Good enough**: For personal use, cloud vector DBs are overkill

## Architecture Patterns

### Domain-Driven Design

```
src/
├── cli/                 # CLI interface layer
│   ├── commands/        # Command handlers
│   └── main.ts          # Entry point
├── domain/              # Business logic (pure, Effect-TS)
│   ├── relationship/    # Analysis, drafting, health scoring
│   ├── signals/         # Behavioral signal extraction
│   └── whatsapp/        # Sync, event parsing
└── infrastructure/      # External integrations
    ├── db/              # Drizzle + SQLite
    ├── llm/             # AI service adapters
    ├── rag/             # LanceDB vector store
    └── whatsapp/        # WhatsApp adapter (whatsmeow)
```

### Bounded Contexts

| Context | Purpose | Integration |
|---------|---------|-------------|
| **Messaging** | Raw message storage, sync | Anti-corruption layer to external WhatsApp |
| **Relationship** | Analysis, health scoring | Consumes from Messaging |
| **Signals** | Pattern extraction | Consumes from Messaging |
| **Memory** | User-captured context | RAG store for retrieval |

### Anti-Corruption Layer

WhatsApp's data format is messy. We transform it at the boundary:

```typescript
// WhatsApp gives us
{ key: { remoteJid: "1234567890@s.whatsapp.net" }, ... }

// We store
{ chatId: "1234567890", source: "whatsapp", ... }
```

This isolates our domain from external format changes.

## Required API Keys

| Service | Purpose | Required? |
|---------|---------|-----------|
| `ANTHROPIC_API_KEY` | Claude for text generation | Yes (for AI features) |
| `OPENAI_API_KEY` | Embeddings for vector search | Yes (for RAG) |
| `OPENROUTER_API_KEY` | Vision models for screenshots | Optional |

## Configuration

```bash
# Core paths
LIFEOPS_DB_PATH=lifeops.db           # SQLite database
LIFEOPS_VECTOR_PATH=data/lancedb     # Vector embeddings

# WhatsApp
SELF_CHAT_ID=1234567890@s.whatsapp.net  # Your self-chat for commands

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...         # Optional
```

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Database migrations
bunx drizzle-kit push    # Apply schema changes
bunx drizzle-kit studio  # Open DB browser
```

## Further Reading

- [Architecture](architecture.md) — Full system design
- [Why Effect-TS](why-effect.md) — Deep dive on functional patterns
- [Why TypeScript](why-typescript.md) — Type safety philosophy
- [FAQ](faq.md) — Common questions

---

*"We could have used Python. But then we'd have to deal with runtime type errors in production. Like receiving 'k.' in response to a heartfelt message—technically valid, emotionally devastating."*
