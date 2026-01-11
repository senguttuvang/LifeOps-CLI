# AI Data Pipeline Architecture

> **Last Updated**: 2026-01-11
>
> This document covers the integration between WhatsApp sync and AI processing pipelines, with focus on incremental processing, deduplication, and enterprise data integration patterns.

## Table of Contents

1. [Overview](#overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Ingestion Layer: Sync Integration](#ingestion-layer-sync-integration)
4. [Processing State Management](#processing-state-management)
5. [Incremental Processing Strategy](#incremental-processing-strategy)
6. [Vector Embedding Pipeline](#vector-embedding-pipeline)
7. [Signal Extraction Pipeline](#signal-extraction-pipeline)
8. [Deduplication & Idempotency](#deduplication--idempotency)
9. [Enterprise Patterns Applied](#enterprise-patterns-applied)
10. [Schema Reference](#schema-reference)

---

## Overview

The AI Data Pipeline transforms raw WhatsApp messages into:

1. **Vector Embeddings** → Semantic search (LanceDB)
2. **Behavioral Signals** → Personalization (SQLite `behavior_signals`)
3. **Topic Clusters** → Content categorization (SQLite `interaction_topics`)

### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Idempotency** | Process same message twice → same result |
| **Incremental** | Only process new/changed data |
| **At-Least-Once** | Tolerate duplicate processing via dedup |
| **Eventual Consistency** | AI state converges with source data |

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LIFEOPS AI DATA PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  WhatsApp    │    │   Sync       │    │     SQLite (OLTP)         │  │
│  │  Protocol    │───►│   Service    │───►│  communication_events     │  │
│  │  (whatsmeow) │    │              │    │  messages                 │  │
│  └──────────────┘    └──────────────┘    │  isIndexed: boolean       │  │
│                                          └──────────────────────────┘  │
│                                                     │                   │
│                              ┌──────────────────────┼──────────────────┐│
│                              │                      │                  ││
│                              ▼                      ▼                  ││
│                    ┌──────────────────┐   ┌──────────────────┐        ││
│                    │  VECTOR PIPELINE  │   │ SIGNAL PIPELINE   │        ││
│                    │                   │   │                   │        ││
│                    │  Query:           │   │  Query:           │        ││
│                    │  WHERE isIndexed  │   │  WHERE partyId    │        ││
│                    │  = FALSE          │   │  NOT IN signals   │        ││
│                    │                   │   │                   │        ││
│                    │  Process:         │   │  Process:         │        ││
│                    │  • Embed text     │   │  • Extract stats  │        ││
│                    │  • Store vector   │   │  • Compute scores │        ││
│                    │  • Set isIndexed  │   │  • Store signals  │        ││
│                    │    = TRUE         │   │                   │        ││
│                    └────────┬──────────┘   └────────┬──────────┘        ││
│                             │                       │                   ││
│                             ▼                       ▼                   ││
│                    ┌──────────────────┐   ┌──────────────────┐        ││
│                    │    LanceDB       │   │  behavior_signals │        ││
│                    │  (Vector Store)  │   │  (Structured)     │        ││
│                    └──────────────────┘   └──────────────────┘        ││
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Ingestion Layer: Sync Integration

The AI pipeline is **downstream** of the sync service. It never queries WhatsApp directly.

### Data Contract

```typescript
// Sync Service produces → AI Pipeline consumes

interface SyncStats {
  partiesAdded: number;
  conversationsAdded: number;
  messagesAdded: number;
  callsAdded: number;
  syncedAt: Date;
}

// After sync completes, AI pipelines query:
// 1. New messages: communication_events WHERE isIndexed = FALSE
// 2. New parties:  parties WHERE id NOT IN (SELECT partyId FROM behavior_signals)
```

### Sync-to-AI Handoff

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SYNC → AI HANDOFF                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Sync Service completes                                               │
│     └─► Updates syncState.lastSyncAt                                    │
│     └─► Inserts new communication_events with isIndexed = FALSE         │
│                                                                          │
│  2. AI Pipeline triggered (manual or scheduled)                          │
│     └─► Queries: SELECT * FROM communication_events WHERE isIndexed=0   │
│     └─► Processes each event                                            │
│     └─► Sets isIndexed = TRUE on completion                             │
│                                                                          │
│  3. No Tight Coupling                                                    │
│     • Sync doesn't call AI directly                                     │
│     • AI pulls based on state flags                                     │
│     • Allows independent scaling                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Processing State Management

### The `isIndexed` Flag Pattern

The `communication_events.isIndexed` boolean is the **processing watermark** for vector embeddings:

```typescript
// Schema: src/infrastructure/db/schema/communications.ts

export const communicationEvents = sqliteTable("communication_events", {
  id: text("id").primaryKey(),
  // ... other fields ...
  isIndexed: integer("is_indexed", { mode: "boolean" }).default(false), // ← AI state
});
```

### State Transition

```
┌──────────────────────────────────────────────────────────────────────┐
│                    isIndexed STATE MACHINE                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌───────────────┐     Vector Pipeline      ┌───────────────┐      │
│   │  isIndexed    │   ─────────────────────► │  isIndexed    │      │
│   │  = FALSE      │   Embed + Store in       │  = TRUE       │      │
│   │  (Pending)    │   LanceDB + Update flag  │  (Processed)  │      │
│   └───────────────┘                          └───────────────┘      │
│                                                                       │
│   Invariants:                                                         │
│   • FALSE → TRUE: Only when embedding successfully stored            │
│   • TRUE → FALSE: Only on schema migration or forced reindex         │
│   • Atomic: Update flag in same transaction as vector insert         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Signal Processing State

Unlike vectors, signals are stored per-party, not per-message:

```typescript
// Schema: src/infrastructure/db/schema/analytics.ts

export const behaviorSignals = sqliteTable("behavior_signals", {
  partyId: text("party_id").unique().references(() => parties.id),
  sampleSize: integer("sample_size"),      // Messages analyzed
  confidence: real("confidence"),           // 0-1 quality score
  computedAt: integer("computed_at"),       // Last computation timestamp
  validUntil: integer("valid_until"),       // Expiry (stale after N days)
});
```

**Recomputation Triggers:**
- New messages exceed threshold (e.g., 50+ new messages since last compute)
- `validUntil` has passed (scheduled refresh)
- User explicitly requests refresh

---

## Incremental Processing Strategy

### Vector Pipeline: Event-Level Granularity

```typescript
// Pseudocode: Incremental Vector Indexing

async function indexNewMessages() {
  // 1. Query unindexed events
  const pending = await db
    .select()
    .from(communicationEvents)
    .innerJoin(messages, eq(messages.eventId, communicationEvents.id))
    .where(eq(communicationEvents.isIndexed, false))
    .limit(100);  // Batch size

  // 2. Generate embeddings (batched for API efficiency)
  const documents = pending.map(row => ({
    id: row.communication_events.id,
    text: row.messages.content,
    metadata: {
      partyId: row.communication_events.fromPartyId,
      conversationId: row.communication_events.conversationId,
      occurredAt: row.communication_events.occurredAt,
    }
  }));

  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: documents.map(d => d.text),
  });

  // 3. Store in LanceDB
  await vectorStore.addDocuments(
    documents.map((doc, i) => ({
      ...doc,
      vector: embeddings.data[i].embedding
    }))
  );

  // 4. Mark as indexed (atomic batch update)
  await db
    .update(communicationEvents)
    .set({ isIndexed: true })
    .where(inArray(communicationEvents.id, documents.map(d => d.id)));

  return { processed: documents.length };
}
```

### Signal Pipeline: Party-Level Granularity

```typescript
// Pseudocode: Incremental Signal Extraction

async function refreshStaleSignals() {
  const now = Date.now();

  // 1. Find parties needing refresh
  const staleParties = await db
    .select({ partyId: parties.id })
    .from(parties)
    .leftJoin(behaviorSignals, eq(behaviorSignals.partyId, parties.id))
    .where(
      or(
        isNull(behaviorSignals.partyId),           // Never computed
        lt(behaviorSignals.validUntil, now),       // Expired
        lt(behaviorSignals.sampleSize, 50)         // Insufficient data previously
      )
    );

  // 2. For each party, check if enough new messages
  for (const party of staleParties) {
    const messageCount = await db
      .select({ count: count() })
      .from(communicationEvents)
      .where(eq(communicationEvents.fromPartyId, party.partyId));

    if (messageCount[0].count >= MIN_MESSAGES_FOR_SIGNALS) {
      await signalService.extractSignals(party.partyId);
    }
  }
}
```

---

## Vector Embedding Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VECTOR EMBEDDING PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Input: communication_events WHERE isIndexed = FALSE                     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     CHUNKING STRATEGY                             │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Current: Message-Level (no chunking)                             │   │
│  │                                                                    │   │
│  │  Why: WhatsApp messages are typically short (<300 chars)          │   │
│  │       Each message has distinct metadata (sender, timestamp)      │   │
│  │       Chunking would lose conversation context                    │   │
│  │                                                                    │   │
│  │  Future: Semantic chunking for long messages (>1000 chars)        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     EMBEDDING MODEL                               │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Model: text-embedding-3-small (OpenAI)                           │   │
│  │  Dimension: 1536                                                  │   │
│  │  Batch Size: 100 documents                                        │   │
│  │  Rate Limit: 3000 RPM                                             │   │
│  │                                                                    │   │
│  │  Fallback: OpenRouter (OPENROUTER_API_KEY)                        │   │
│  │  Future: Local embeddings via Ollama                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     VECTOR STORAGE                                │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Database: LanceDB (local-first, columnar)                        │   │
│  │  Table: "vectors"                                                 │   │
│  │  Index: HNSW (Hierarchical Navigable Small World)                 │   │
│  │  Path: data/lancedb/                                              │   │
│  │                                                                    │   │
│  │  Schema:                                                          │   │
│  │  {                                                                │   │
│  │    id: string,       // communication_events.id                   │   │
│  │    text: string,     // messages.content                          │   │
│  │    vector: float[],  // 1536-dim embedding                        │   │
│  │    timestamp: int,   // occurredAt                                │   │
│  │    sender: string,   // fromPartyId                               │   │
│  │    chatId: string    // conversationId                            │   │
│  │  }                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Output: isIndexed = TRUE on success                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Retrieval Flow

```typescript
// RAG Retrieval for Draft Generation

async function retrieveContext(query: string, partyId: string, limit = 5) {
  // 1. Generate query embedding
  const queryVector = await getEmbedding(query);

  // 2. Hybrid search: Vector similarity + Metadata filter
  const results = await vectorTable
    .search(queryVector)
    .where(`sender = '${partyId}'`)  // Filter to specific party
    .limit(limit)
    .toArray();

  // 3. Format for prompt injection
  return results.map(r => ({
    text: r.text,
    timestamp: new Date(r.timestamp).toISOString(),
    relevance: r._distance  // Similarity score
  }));
}
```

---

## Signal Extraction Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SIGNAL EXTRACTION PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Input: Parties without signals OR with expired signals                  │
│         Query: parties LEFT JOIN behavior_signals                        │
│                WHERE signals IS NULL OR validUntil < NOW()               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    EXTRACTION PHASES                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                    │   │
│  │  1. DATA COLLECTION                                               │   │
│  │     • Fetch last 1000 messages for party                          │   │
│  │     • Minimum 50 messages required                                │   │
│  │     • Join with conversations for context                         │   │
│  │                                                                    │   │
│  │  2. PARALLEL EXTRACTORS                                           │   │
│  │     ┌─────────────────────────────────────────────────────────┐   │   │
│  │     │ Response Times  │ Message Structure │ Emoji Patterns   │   │   │
│  │     │ • P50, P95     │ • Avg length      │ • Per message    │   │   │
│  │     │ • Avg response │ • Word count      │ • Top emojis     │   │   │
│  │     │ • Initiation % │ • Variance        │ • Position       │   │   │
│  │     ├─────────────────────────────────────────────────────────┤   │   │
│  │     │ Punctuation    │ Phrase Patterns   │ Behavioral       │   │   │
│  │     │ • ! rate       │ • N-grams         │ • Follow-up Q?   │   │   │
│  │     │ • ? rate       │ • Greetings       │ • Multi-message  │   │   │
│  │     │ • ... rate     │ • Sign-offs       │ • Voice notes    │   │   │
│  │     └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                    │   │
│  │  3. AGGREGATION                                                   │   │
│  │     • Combine all signals into UserSignals object                 │   │
│  │     • Calculate confidence score based on sample size             │   │
│  │     • Set validUntil (default: 7 days)                            │   │
│  │                                                                    │   │
│  │  4. STORAGE                                                       │   │
│  │     • Upsert to behavior_signals table                            │   │
│  │     • JSON-encode complex fields (topEmojis, commonPhrases)       │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Output: behavior_signals row updated                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Refresh Strategy

| Trigger | Action | Rationale |
|---------|--------|-----------|
| First sync for party | Compute if ≥50 messages | Bootstrap personalization |
| `validUntil` expired | Recompute from latest 1000 | Capture behavioral drift |
| Major message influx (100+ new) | Recompute | Significant new data |
| User requests refresh | Force recompute | Manual override |

---

## Deduplication & Idempotency

### Why Duplicates Occur

1. **Overlapping sync windows**: Fetching 30 days includes messages from previous sync
2. **Retry on failure**: If embedding API fails mid-batch, retry includes processed items
3. **Re-sync after corruption**: User may re-import same data

### Deduplication Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEDUPLICATION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Layer 1: SYNC LAYER (Message Ingestion)                                 │
│  ─────────────────────────────────────────                               │
│  • Key: (channelId, externalId)                                          │
│  • Strategy: ON CONFLICT DO NOTHING                                      │
│  • Effect: Same WhatsApp message ID → single row                         │
│                                                                          │
│  Layer 2: VECTOR LAYER (Embedding Storage)                               │
│  ─────────────────────────────────────────                               │
│  • Key: communication_events.id                                          │
│  • Strategy: Check isIndexed before processing                           │
│  • Effect: Already indexed → skip embedding                              │
│                                                                          │
│  Layer 3: SIGNAL LAYER (Behavioral Analysis)                             │
│  ─────────────────────────────────────────                               │
│  • Key: partyId (unique constraint)                                      │
│  • Strategy: UPSERT with validUntil check                                │
│  • Effect: Recompute replaces stale signals                              │
│                                                                          │
│  Layer 4: LANCEDB LAYER (Vector Dedup)                                   │
│  ─────────────────────────────────────                                   │
│  • Key: document.id                                                      │
│  • Strategy: Upsert by ID                                                │
│  • Effect: Re-indexing same doc updates rather than duplicates           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Idempotent Processing Guarantees

```typescript
// Guaranteed idempotent vector indexing

async function idempotentIndex(eventId: string) {
  // 1. Check if already processed
  const event = await db
    .select()
    .from(communicationEvents)
    .where(eq(communicationEvents.id, eventId))
    .limit(1);

  if (event[0]?.isIndexed) {
    return { status: 'already_indexed', eventId };
  }

  // 2. Process (may be called multiple times)
  const embedding = await generateEmbedding(event[0]);

  // 3. Atomic store + flag update
  await db.transaction(async (tx) => {
    await vectorStore.upsert({ id: eventId, ...embedding });
    await tx
      .update(communicationEvents)
      .set({ isIndexed: true })
      .where(eq(communicationEvents.id, eventId));
  });

  return { status: 'indexed', eventId };
}
```

---

## Enterprise Patterns Applied

### From Designing Data-Intensive Applications (DDIA)

| Pattern | Our Implementation | Location |
|---------|-------------------|----------|
| **Watermark-Based Processing** | `isIndexed` flag on events | `communication_events.is_indexed` |
| **Idempotent Consumer** | Dedup by `externalId` + flag check | Sync service + vector pipeline |
| **At-Least-Once Delivery** | Overlapping time windows tolerated | Sync options (`days` param) |
| **Derived Data** | Signals computed from messages | `behavior_signals` table |
| **Event Sourcing (Partial)** | Events are immutable source of truth | `communication_events` + `messages` |
| **CQRS (Read/Write Split)** | SQLite for writes, LanceDB for vector reads | Separate storage engines |

### ETL Pipeline Characteristics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ETL CLASSIFICATION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Extract: WhatsApp → whatsmeow → JSON → Adapter                          │
│  ────────                                                                │
│  • Source: WhatsApp multi-device protocol                               │
│  • Format: Binary protobuf → JSON → TypeScript types                    │
│  • Trigger: Manual (`bun run cli sync`) or scheduled                    │
│                                                                          │
│  Transform: Adapter → Domain Entities                                    │
│  ──────────                                                              │
│  • JID normalization (remove @s.whatsapp.net)                           │
│  • UUID generation (deterministic from JID hash)                        │
│  • Party type inference (individual vs organization)                    │
│  • Timestamp conversion (Unix → Date)                                   │
│                                                                          │
│  Load: Domain Entities → SQLite + LanceDB                                │
│  ─────                                                                   │
│  • SQLite: Structured data (parties, events, signals)                   │
│  • LanceDB: Unstructured embeddings (vector search)                     │
│  • Strategy: Upsert with conflict resolution                            │
│                                                                          │
│  Pipeline Type: Micro-batch (not streaming)                              │
│  ─────────────                                                           │
│  • Batch size: All messages in time window                              │
│  • Frequency: On-demand (user-triggered)                                │
│  • Latency: Minutes (not real-time)                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Quality Dimensions

| Dimension | Measure | Enforcement |
|-----------|---------|-------------|
| **Completeness** | All messages in window captured | Time overlap in sync |
| **Consistency** | Same message → same UUID | Deterministic ID generation |
| **Timeliness** | Processing lag from sync | `isIndexed` backlog monitoring |
| **Accuracy** | Embedding quality | Model version tracking |
| **Uniqueness** | No duplicate vectors | Dedup by `externalId` |

---

## Schema Reference

### Core Tables for AI Pipeline

```sql
-- Source: communication_events (OLTP)
-- AI reads from this table to find unprocessed events

CREATE TABLE communication_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- 'message', 'call'
  direction TEXT NOT NULL,            -- 'inbound', 'outbound'
  from_party_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  external_id TEXT NOT NULL,          -- WhatsApp message ID (dedup key)
  occurred_at INTEGER NOT NULL,
  is_indexed INTEGER DEFAULT 0,       -- ← AI processing watermark

  UNIQUE(channel_id, external_id)     -- Dedup constraint
);

CREATE INDEX idx_events_indexed ON communication_events(is_indexed);

-- Derived: behavior_signals (Analytics)
-- AI writes computed signals here

CREATE TABLE behavior_signals (
  id TEXT PRIMARY KEY,
  party_id TEXT UNIQUE NOT NULL,
  signal_data TEXT NOT NULL,          -- JSON blob
  sample_size INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  computed_at INTEGER,
  valid_until INTEGER,                -- Expiry timestamp

  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- Derived: interaction_topics (Analytics)
-- AI writes extracted topics here

CREATE TABLE interaction_topics (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  confidence REAL NOT NULL,
  extracted_at INTEGER,

  FOREIGN KEY (event_id) REFERENCES communication_events(id)
);
```

### LanceDB Schema

```typescript
// Vector store schema (LanceDB)

interface VectorDocument {
  id: string;          // communication_events.id
  text: string;        // messages.content
  vector: number[];    // 1536-dim float array
  timestamp: number;   // occurred_at (Unix)
  sender: string;      // from_party_id
  chatId: string;      // conversation_id
}
```

---

## Monitoring & Observability

### Key Metrics

| Metric | Query | Alert Threshold |
|--------|-------|-----------------|
| **Indexing Backlog** | `COUNT(*) WHERE isIndexed = FALSE` | > 1000 events |
| **Stale Signals** | `COUNT(*) WHERE validUntil < NOW()` | > 10 parties |
| **Embedding Errors** | Failed API calls in last hour | > 5% failure rate |
| **Signal Confidence** | `AVG(confidence) FROM behavior_signals` | < 0.7 average |

### Health Check Query

```sql
-- AI Pipeline Health Dashboard

SELECT
  (SELECT COUNT(*) FROM communication_events WHERE is_indexed = 0)
    AS pending_embeddings,
  (SELECT COUNT(*) FROM parties p
   LEFT JOIN behavior_signals s ON p.id = s.party_id
   WHERE s.id IS NULL)
    AS parties_without_signals,
  (SELECT COUNT(*) FROM behavior_signals
   WHERE valid_until < unixepoch())
    AS stale_signals,
  (SELECT MAX(occurred_at) FROM communication_events)
    AS last_event_time,
  (SELECT last_sync_at FROM sync_state WHERE id = 'whatsapp')
    AS last_sync_time;
```

---

## Future Enhancements

### Roadmap

| Phase | Feature | Benefit |
|-------|---------|---------|
| **Phase 1** | Real-time indexing | Index as messages arrive (vs batch) |
| **Phase 2** | Local embeddings (Ollama) | Full privacy, no API calls |
| **Phase 3** | Incremental signal updates | Update signals without full recompute |
| **Phase 4** | Topic evolution tracking | Detect conversation theme drift |

### Real-Time Architecture (Future)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FUTURE: REAL-TIME PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WhatsApp ──events.Message──► Event Queue ──► Parallel Workers           │
│                                    │                                     │
│                    ┌───────────────┼───────────────┐                    │
│                    ▼               ▼               ▼                    │
│              ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│              │ Persist  │   │ Embed    │   │ Update   │                │
│              │ to DB    │   │ Vector   │   │ Signals  │                │
│              └──────────┘   └──────────┘   └──────────┘                │
│                                                                          │
│  Benefits:                                                               │
│  • Sub-second latency                                                   │
│  • No batch processing delay                                            │
│  • Signals update incrementally                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## References

- [WhatsApp Sync Architecture](./whatsapp-sync.md) - Upstream sync patterns
- [Implementation Plan: RAG + Signals](../capabilities/implementation-plan-rag-signals.md) - Detailed implementation
- [Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/) - Enterprise patterns
- [LanceDB Documentation](https://lancedb.github.io/lancedb/) - Vector storage

---

*Document created: 2026-01-11*
