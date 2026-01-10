# LifeOps Architecture

In-depth architecture documentation for LifeOps Personal Relationship Management System.

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Philosophy](#design-philosophy)
3. [Bounded Contexts (DDD)](#bounded-contexts-ddd)
4. [Layer Architecture](#layer-architecture)
5. [Effect-TS Patterns](#effect-ts-patterns)
6. [Service Composition](#service-composition)
7. [Data Flow](#data-flow)
8. [Key Design Decisions](#key-design-decisions)
9. [Testing Strategy](#testing-strategy)

---

## System Overview

LifeOps is a **local-first personal CRM** for managing relationships through WhatsApp message analysis. It extracts messages from WhatsApp Web, stores them locally in SQLite, and provides AI-powered insights using Retrieval-Augmented Generation (RAG).

### Core Capabilities (MVP)

- **WhatsApp Sync**: Extract messages via whatsmeow Go CLI → SQLite
- **Health Check**: Verify WhatsApp CLI availability and authentication

### Planned Capabilities

- **RAG Indexing**: Semantic search with LanceDB vector embeddings
- **Relationship Analysis**: AI insights on communication patterns
- **Context-Aware Drafts**: Generate message responses from conversation history

---

## Design Philosophy

### 1. **Local-First**
All data (messages, embeddings, analysis) lives on the user's machine. No cloud dependencies for core functionality. AI services (Anthropic, OpenAI) are used only for generation/embeddings, not data storage.

### 2. **Explicit Over Implicit**
- Dependencies explicit in type signatures (Effect Context.Tag)
- Errors explicit in type signatures (Effect.Effect<Success, Error>)
- No decorators, reflection, or magic

### 3. **Anti-Corruption Layer**
WhatsApp protocol complexity isolated in Go binary (`whatsmeow-cli`). TypeScript sees only clean JSON interfaces.

### 4. **Functional Core, Imperative Shell**
- **Core**: Pure Effect-TS services (domain logic, business rules)
- **Shell**: CLI commands (I/O, user interaction)

### 5. **DDD Lite**
Bounded contexts for separation of concerns, but lightweight (no event sourcing, CQRS, or complex aggregates).

---

## Bounded Contexts (DDD)

LifeOps has four bounded contexts:

### 1. **Communication Context**
**Responsibility**: Sync messages from WhatsApp to local storage.

**Components**:
- `WhatsAppService` (infrastructure) - Adapter to whatsmeow CLI
- `SyncService` (domain) - Orchestrates sync workflow
- `whatsapp_chats`, `whatsapp_messages` tables (persistence)

**Key Operations**:
- `syncMessages({ days: number })` - Fetch messages from WhatsApp
- `getSyncState()` - Get last sync timestamp

### 2. **Knowledge Context** (Planned)
**Responsibility**: Index messages into vector embeddings for semantic search.

**Components**:
- `VectorStore` (infrastructure) - LanceDB adapter
- `IndexService` (domain) - Message → embedding pipeline
- `lancedb/` directory (persistence)

**Key Operations**:
- `indexChat(chatId)` - Generate embeddings for all messages in chat
- `search(query, chatId)` - Semantic search over messages

### 3. **Relationship Context** (Planned)
**Responsibility**: Analyze communication patterns and generate insights.

**Components**:
- `AIService` (infrastructure) - Anthropic/OpenAI adapter
- `AnalysisService` (domain) - RAG-based analysis
- `relationship_profiles` table (persistence)

**Key Operations**:
- `analyzeRelationship(chatId)` - Generate insights from messages
- `draftResponse(chatId, intent)` - Generate context-aware message

### 4. **Synthesis Context** (Planned)
**Responsibility**: Cross-relationship insights and meta-analysis.

**Components**:
- `SynthesisService` (domain) - Aggregate insights across relationships
- `synthesis_reports` table (persistence)

**Key Operations**:
- `generateReport()` - Weekly relationship health report
- `identifyPatterns()` - Cross-relationship communication patterns

---

## Layer Architecture

LifeOps follows a **three-layer architecture** inspired by Hexagonal Architecture and DDD:

```
┌─────────────────────────────────────────────────┐
│                  CLI Layer                      │
│  (User Interface - Commands, Argument Parsing)  │
│          src/cli/commands/*.command.ts          │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│                 Domain Layer                    │
│  (Business Logic - Services, Orchestration)     │
│         src/domain/*/​*.service.ts               │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│             Infrastructure Layer                │
│  (External Integrations - DB, AI, WhatsApp)     │
│        src/infrastructure/*/*.client.ts         │
└─────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### **CLI Layer** (`src/cli/`)
- Parse command-line arguments
- Display output to user (console.log)
- Handle user errors (invalid arguments, help text)
- **Dependency**: Domain layer services

**Example**: `sync.command.ts`
```typescript
export const syncCommand = (options: SyncCommandOptions = {}) =>
  Effect.gen(function* () {
    const syncService = yield* SyncServiceTag;  // Get domain service
    const result = yield* syncService.syncMessages({ days: options.days || 30 });
    console.log(`✅ Sync complete: ${result.messagesAdded} messages`);
  });
```

#### **Domain Layer** (`src/domain/`)
- Business logic and orchestration
- Coordinate infrastructure services
- Enforce business rules (e.g., sync state tracking)
- **Dependency**: Infrastructure layer services

**Example**: `sync.service.ts`
```typescript
const syncMessages = (options: SyncOptions = {}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService;           // Infrastructure dependency
    const whatsapp = yield* WhatsAppServiceTag;  // Infrastructure dependency

    // 1. Fetch from WhatsApp
    const syncResult = yield* whatsapp.syncMessages(options);

    // 2. Store in database (business logic: upsert chats, dedupe messages)
    for (const chat of syncResult.chats) {
      yield* db.upsertChat(chat);
    }

    // 3. Update sync state (business rule: track last sync time)
    yield* db.updateSyncState(new Date());

    return { messagesAdded: syncResult.messages.length };
  });
```

#### **Infrastructure Layer** (`src/infrastructure/`)
- Integrate with external systems (WhatsApp CLI, SQLite, AI APIs)
- Translate external data formats to domain types
- Handle I/O errors (network, file system, CLI execution)
- **Dependency**: None (pure adapters)

**Example**: `whatsapp.client.ts`
```typescript
const syncMessages = (options: WhatsAppSyncOptions = {}) =>
  Effect.tryPromise({
    try: async () => {
      const args = ["sync", "--json", `--days ${options.days || 30}`];
      const { stdout } = await execAsync(`${cliBinPath} ${args.join(" ")}`);
      return JSON.parse(stdout) as WhatsAppSyncResult;  // Translate JSON → domain type
    },
    catch: (e) => new Error(`Sync failed: ${e}`)        // I/O error handling
  });
```

### Layer Isolation Rules

1. **CLI depends on Domain** (not Infrastructure directly)
2. **Domain depends on Infrastructure** (via Context.Tag interfaces)
3. **Infrastructure depends on nothing** (no circular dependencies)

This ensures:
- Easy testing (swap Infrastructure layers with mocks)
- Parallel development (work on layers independently)
- Clear boundaries (changes to WhatsApp CLI don't affect CLI commands)

---

## Effect-TS Patterns

Effect-TS is the backbone of LifeOps's architecture. It provides:
- Type-safe dependency injection (Context.Tag + Layer)
- Explicit error handling (Effect.Effect<Success, Error>)
- Functional composition (Effect.gen, pipe)

### Pattern 1: Service Definition (Context.Tag)

Every service follows this pattern:

```typescript
// 1. Define service interface
export interface WhatsAppService {
  readonly syncMessages: (options: SyncOptions) => Effect.Effect<SyncResult, Error>;
  readonly healthCheck: () => Effect.Effect<HealthStatus, Error>;
}

// 2. Create service tag (for dependency injection)
export class WhatsAppServiceTag extends Context.Tag("WhatsAppService")<
  WhatsAppServiceTag,
  WhatsAppService
>() {}

// 3. Implement service as Layer
export const WhatsAppServiceLive = Layer.sync(WhatsAppServiceTag, () => {
  const cliBinPath = `${process.cwd()}/bin/whatsmeow-cli`;

  return {
    syncMessages: (options) => Effect.tryPromise({ ... }),
    healthCheck: () => Effect.gen(function* () { ... })
  };
});
```

**Key Points**:
- `WhatsAppService` = interface (what the service does)
- `WhatsAppServiceTag` = dependency token (how to request the service)
- `WhatsAppServiceLive` = implementation (how the service works)

### Pattern 2: Using Services (Effect.gen)

Services are accessed via `yield*` in Effect.gen:

```typescript
const program = Effect.gen(function* () {
  // Request services via tags
  const whatsapp = yield* WhatsAppServiceTag;
  const db = yield* DatabaseService;

  // Use services (all operations are Effects)
  const result = yield* whatsapp.syncMessages({ days: 30 });
  yield* db.storeMessages(result.messages);

  return { messagesAdded: result.messages.length };
});
```

**Type Safety**:
```typescript
Effect.Effect<
  { messagesAdded: number },  // Success type
  Error,                       // Error type
  WhatsAppServiceTag | DatabaseService  // Required dependencies
>
```

The type signature tells you:
- What the function returns on success
- What errors it can throw
- What services it depends on

### Pattern 3: Error Handling (tryPromise)

Infrastructure services wrap async operations in `Effect.tryPromise`:

```typescript
const syncMessages = (options: SyncOptions) =>
  Effect.tryPromise({
    try: async () => {
      const { stdout } = await execAsync(`${cliBinPath} sync --json`);
      return JSON.parse(stdout) as SyncResult;
    },
    catch: (e) => new Error(`Sync failed: ${e}`)  // Convert exception → typed Error
  });
```

**No throw statements.** All errors explicit in type signatures.

### Pattern 4: Layer Composition (provide, mergeAll)

Services depend on other services. Layers compose dependencies:

```typescript
// SyncService depends on DatabaseService + WhatsAppServiceTag
const SyncServiceLive = Layer.effect(
  SyncServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;        // Dependency
    const whatsapp = yield* WhatsAppServiceTag; // Dependency

    return { syncMessages: (...) => ... };
  })
);

// Provide dependencies when creating the layer
const MainLive = Layer.mergeAll(
  DatabaseLive,              // Standalone service
  WhatsAppServiceLive,       // Standalone service
  SyncServiceLive.pipe(      // Composite service
    Layer.provide(DatabaseLive),        // Inject DatabaseService
    Layer.provide(WhatsAppServiceLive)  // Inject WhatsAppServiceTag
  )
);

// Run program with all dependencies
const run = program.pipe(Effect.provide(MainLive));
NodeRuntime.runMain(run);
```

**Layer.mergeAll** makes all services available to the program.

---

## Service Composition

Visual representation of service dependencies:

```
┌────────────────────────────────────────────────┐
│          CLI Commands (Entry Points)           │
│  syncCommand, healthCommand, indexCommand      │
└────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────┐
│             Domain Services                    │
│  SyncService, AnalysisService (planned)        │
└────────────────────────────────────────────────┘
       ↓                ↓                ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ DatabaseSvc │  │ WhatsAppSvc │  │   AISvc     │
└─────────────┘  └─────────────┘  └─────────────┘
       ↓                ↓                ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   SQLite    │  │ whatsmeow   │  │  Anthropic  │
│   (Drizzle) │  │   Go CLI    │  │   OpenAI    │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Example: Sync Command Data Flow

```typescript
// 1. User runs: bun run cli sync --days=7

// 2. CLI command executes
const syncCommand = (options) =>
  Effect.gen(function* () {
    const syncService = yield* SyncServiceTag;  // Request SyncService
    const result = yield* syncService.syncMessages({ days: 7 });
    console.log(`Messages: ${result.messagesAdded}`);
  });

// 3. SyncService orchestrates
const syncMessages = (options) =>
  Effect.gen(function* () {
    const whatsapp = yield* WhatsAppServiceTag;  // Request WhatsAppService
    const db = yield* DatabaseService;           // Request DatabaseService

    // 4. WhatsAppService calls Go binary
    const syncResult = yield* whatsapp.syncMessages({ days: 7 });

    // 5. DatabaseService stores messages
    for (const msg of syncResult.messages) {
      yield* db.insertMessage(msg);
    }

    return { messagesAdded: syncResult.messages.length };
  });
```

**Dependencies resolved automatically** by Effect runtime via Layer composition.

---

## Data Flow

### WhatsApp Message Sync Flow

```
┌──────────────────────────────────────────────────────┐
│ 1. User runs: bun run cli sync --days=30            │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. sync.command.ts requests SyncService              │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. SyncService requests WhatsAppService              │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 4. WhatsAppService executes:                         │
│    ./bin/whatsmeow-cli sync --days 30 --json         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 5. Go CLI connects to WhatsApp Web via WebSocket    │
│    - Authenticates with QR code credentials          │
│    - Fetches messages from last 30 days              │
│    - Returns JSON: { chats: [...], messages: [...] } │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 6. WhatsAppService parses JSON → TypeScript types   │
│    WhatsAppSyncResult { chats, messages }            │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 7. SyncService stores data via DatabaseService      │
│    - Upsert chats (conflict: update metadata)        │
│    - Insert messages (conflict: skip duplicates)     │
│    - Update sync state (timestamp)                   │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 8. DatabaseService writes to SQLite via Drizzle     │
│    - whatsapp_chats table                            │
│    - whatsapp_messages table                         │
│    - whatsapp_sync_state table                       │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 9. SyncService returns SyncStats to CLI             │
│    { messagesAdded, chatsAdded, syncedAt }           │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 10. CLI displays result to user                     │
│     ✅ Sync complete: 1247 messages, 23 chats        │
└──────────────────────────────────────────────────────┘
```

### RAG Analysis Flow (Planned)

```
┌──────────────────────────────────────────────────────┐
│ 1. User runs: bun run cli analyze <chat-id>         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. AnalysisService fetches messages from DB         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. VectorStore performs semantic search             │
│    - User query → OpenAI embedding                   │
│    - L2 distance search in LanceDB                   │
│    - Returns top 10 relevant messages                │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 4. AnalysisService constructs prompt                │
│    - System prompt: relationship analyst             │
│    - Context: top 10 relevant messages               │
│    - Task: analyze communication patterns            │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 5. AIService calls Anthropic Claude API             │
│    - Model: claude-sonnet-4                          │
│    - Generates relationship insights                 │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 6. CLI displays analysis to user                    │
└──────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **Why whatsmeow Go CLI (not Baileys)?**

**Decision**: Use whatsmeow Go CLI as an anti-corruption layer.

**Rationale**:
- **Isolation**: WhatsApp protocol complexity isolated in Go binary
- **Stability**: whatsmeow is battle-tested, handles protocol changes
- **Type Safety**: JSON interface easier to validate than Baileys TypeScript internals
- **Anti-Corruption**: Domain code never touches WhatsApp Web internals

**Tradeoff**: Extra process overhead (exec Go binary), but worth it for stability.

### 2. **Why Effect-TS (not plain TypeScript)?**

**Decision**: Use Effect-TS for all business logic.

**Rationale**:
- **Explicit Dependencies**: `yield* ServiceTag` makes dependencies visible in code
- **Explicit Errors**: `Effect.Effect<Success, Error>` makes errors visible in types
- **Testability**: Swap layers for testing (no mocking frameworks needed)
- **Composability**: Layer.provide chains services cleanly

**Tradeoff**: Steeper learning curve, but pays off in maintainability.

### 3. **Why SQLite (not PostgreSQL)?**

**Decision**: Use SQLite for local storage.

**Rationale**:
- **Local-First**: No server setup, all data on user's machine
- **Simplicity**: Single file database, easy backups
- **Performance**: Fast for personal-scale data (thousands of messages)

**Tradeoff**: No concurrent writes, but not needed for personal use.

### 4. **Why LanceDB (not Pinecone/Weaviate)?**

**Decision**: Use LanceDB for vector embeddings (planned).

**Rationale**:
- **Local-First**: Embeddings stored locally, no API calls for search
- **Fast**: Apache Arrow columnar format optimized for vector search
- **Simple**: No server, just a directory of files

**Tradeoff**: No distributed search, but not needed for personal scale.

### 5. **Why Drizzle ORM (not Prisma)?**

**Decision**: Use Drizzle for SQLite access.

**Rationale**:
- **Type Safety**: Schema-first design, types generated from schema
- **Performance**: Thin layer over SQL, no query builder overhead
- **Effect-TS Compatible**: Easy to wrap in Effect.tryPromise

**Tradeoff**: Less magical than Prisma, but more explicit.

### 6. **Why Simple CLI Dispatcher (not @effect/cli)?**

**Decision**: Use switch statement for command dispatching.

**Rationale**:
- **Simplicity**: @effect/cli caused stack overflow errors
- **Control**: Manual argument parsing gives full control
- **Debugging**: Easier to debug than complex CLI framework

**Tradeoff**: Less declarative, but more predictable.

---

## Testing Strategy

### Current State (MVP)

- **Manual Testing**: `bun run cli sync`, `bun run cli health`
- **Type Checking**: `bun run typecheck` (strict mode)

### Planned Testing (Future)

#### Unit Tests (Vitest)

Test services in isolation by swapping layers:

```typescript
describe("SyncService", () => {
  it("should sync messages from WhatsApp to database", async () => {
    // Create mock layers
    const MockWhatsApp = Layer.succeed(WhatsAppServiceTag, {
      syncMessages: () => Effect.succeed({
        chats: [{ jid: "123", name: "Test" }],
        messages: [{ id: "msg1", text: "Hello" }]
      })
    });

    const MockDB = Layer.succeed(DatabaseService, {
      insertChat: () => Effect.succeed(void 0),
      insertMessage: () => Effect.succeed(void 0),
      updateSyncState: () => Effect.succeed(void 0)
    });

    // Test service with mocks
    const program = Effect.gen(function* () {
      const sync = yield* SyncServiceTag;
      return yield* sync.syncMessages({ days: 30 });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(MockWhatsApp), Effect.provide(MockDB))
    );

    expect(result.messagesAdded).toBe(1);
  });
});
```

**Key Benefit**: No mocking framework needed. Just create alternative layers.

#### Integration Tests

Test full stack with real SQLite database:

```typescript
describe("Sync Command (Integration)", () => {
  it("should sync messages end-to-end", async () => {
    // Use real database, mock only WhatsApp
    const program = Effect.gen(function* () {
      const sync = yield* SyncServiceTag;
      return yield* sync.syncMessages({ days: 1 });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayers))
    );

    expect(result.messagesAdded).toBeGreaterThan(0);
  });
});
```

#### E2E Tests

Test with real whatsmeow binary (requires authentication):

```bash
# Set up test environment
export WHATSAPP_TEST_MODE=true
bun run cli sync --days=1

# Verify database
sqlite3 lifeops3.db "SELECT COUNT(*) FROM whatsapp_messages;"
```

---

## Future Extensions

### 1. **Event Sourcing** (Optional)
Store all sync events as immutable log. Enables:
- Replay sync history
- Audit trail for data changes
- Time-travel debugging

### 2. **Incremental Sync** (Optimization)
Currently syncs last N days every time. Improvement:
- Track cursor in `whatsapp_sync_state` table
- Fetch only new messages since last sync
- Reduces API calls to WhatsApp

### 3. **Multi-Account Support** (Feature)
Support multiple WhatsApp accounts:
- Add `account_id` column to all tables
- Separate whatsmeow sessions per account
- CLI flag: `bun run cli sync --account=personal`

### 4. **Web UI** (Interface)
Add web interface for non-CLI users:
- Hono web framework (Effect-TS compatible)
- React frontend for chat browsing
- Live sync status dashboard

---

## Summary

LifeOps architecture is designed for:
- **Maintainability**: Explicit dependencies, errors, and layers
- **Testability**: Swap layers for testing without mocking frameworks
- **Local-First**: All data on user's machine, no cloud lock-in
- **Type Safety**: Effect-TS + Drizzle ensure compile-time correctness

**Core Principle**: Make complexity explicit, not hidden.

---

**Built with Effect-TS for type-safe functional programming.**
