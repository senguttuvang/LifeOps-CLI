# WhatsApp Sync Architecture

## Overview

LifeOps CLI syncs WhatsApp messages using a two-phase approach that respects user privacy and provides control over what data is imported.

## The Challenge

WhatsApp's behavior creates unique sync challenges:

### History Sync Happens Once

When you first link a device via QR code scan, WhatsApp sends a **one-time history sync** containing ALL your messages. This sync:

- Happens immediately after QR authentication
- Contains full message history (not just recent)
- Is delivered via `events.HistorySync` event
- **Never repeats** - subsequent connections only receive new real-time messages

This means we must capture everything during the first sync, then let users choose what to keep.

### Contact Name Matching Problem

Users might want to sync specific contacts (e.g., `--contacts "Mom,Girlfriend"`), but:

- WhatsApp stores contacts by JID (e.g., `919876543210@s.whatsapp.net`)
- Display names come from the user's phone contacts (which we don't have access to)
- "Push names" (self-set names) may differ from how users think of contacts
- Fuzzy matching is unreliable and creates ambiguity with duplicates

**Solution**: Interactive selection AFTER showing what exists.

## Two-Phase Sync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Phase 1: Raw Dump                         │
│                                                                 │
│  WhatsApp ──QR──▶ Go CLI ──HistorySync──▶ whatsapp-raw/dump.json│
│                                                                 │
│  • Captures ALL messages without filtering                      │
│  • Groups by contact JID with push names                       │
│  • Gitignored temporary storage                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 2: Contact Selection                    │
│                                                                 │
│  Effect-TS CLI reads dump, shows contact list with search:     │
│                                                                 │
│  📱 WhatsApp Contacts                                          │
│                                                                 │
│  Type to filter: mo                                            │
│  [1] Mom (+91 87654 32109) - 156 messages                     │
│  [2] Mohan Uncle - 23 messages                                 │
│  [3] Mom Work Group - 891 messages                             │
│                                                                 │
│  Select: 1,3                                                   │
│                                                                 │
│  • Fuzzy search on name, phone, JID                            │
│  • Selection by index, range, or 'all'                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 3: SQLite Import                       │
│                                                                 │
│  Selected contacts ──Adapter──▶ WhatsAppSyncResult              │
│                        │                                        │
│                        ▼                                        │
│  SyncService.syncFromData() ──▶ Domain Entities ──▶ SQLite     │
│                                                                 │
│  • Anti-corruption layer translates WhatsApp → Domain          │
│  • Stores in source-agnostic schema                            │
│  • User can delete or keep raw dump                            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Boundaries

### Go CLI (Anti-Corruption Layer 1)

The Go CLI using `whatsmeow` library is the ONLY component that speaks WhatsApp protocol:

```go
// tools/whatsmeow-cli/main.go

case *events.HistorySync:
    conversations := v.Data.GetConversations()
    for _, conv := range conversations {
        chatJID := conv.GetID()
        for _, histMsg := range conv.GetMessages() {
            // Extract and store message
        }
    }
```

**Output Format** (`whatsapp-raw/dump.json`):
```json
{
  "contacts": [
    {
      "jid": "919876543210@s.whatsapp.net",
      "pushName": "Mom",
      "isGroup": false,
      "messageCount": 156,
      "messages": [...]
    }
  ],
  "totalMessages": 5420,
  "dumpedAt": 1704931200
}
```

### Effect-TS Domain (Anti-Corruption Layer 2)

The `DumpAdapterService` converts raw dump to `WhatsAppSyncResult`:

```typescript
// src/domain/sync/dump-adapter.service.ts

convertDump: (dump, selectedJids) => {
  // Filter to selected contacts
  // Map RawMessage → WhatsAppMessageData
  // Map RawContact → WhatsAppChatData
  return { messages, chats, syncedAt }
}
```

### Domain Model (Source-Agnostic)

The `SyncService` uses `WhatsAppAdapter` to translate to domain entities:

```
WhatsAppSyncResult → WhatsAppAdapter → Domain Entities → SQLite

Domain entities:
- Contact (with identifiers)
- Conversation (with participants)
- Interaction (message or call)
```

## CLI Options

```bash
# Standard flow: dump → interactive selection → import
bun run cli sync

# Import all contacts without selection
bun run cli sync --all

# Re-select from existing dump (skip network)
bun run cli sync --skip-dump

# Keep dump file after import
bun run cli sync --keep-dump
```

## Design Decisions

### Why Dump All Then Filter?

1. **History sync is one-time**: Can't re-request specific contacts later
2. **User agency**: Users see what exists before deciding
3. **No guessing**: Eliminates fuzzy matching failures
4. **Recoverable**: Can re-import from dump without re-authenticating

### Why Not `--contacts "Mom,Girlfriend"`?

- **Name ambiguity**: "Mom" might match "Mom Work Group"
- **No phone contacts**: We don't have access to the user's address book
- **Duplicates**: Multiple contacts might have similar names
- **User expectation mismatch**: User's mental model vs. stored push names

### Why Interactive Selection?

- **Visual confirmation**: Users see exactly what they're importing
- **Search-as-you-type**: Handles 200+ contacts efficiently
- **Flexible selection**: "1,2,5" or "1-10" or "all"
- **Re-indexing**: Filtered results get new indices for easy selection

## File Structure

```
src/domain/sync/
├── types.ts                    # RawDump, ContactSummary, etc.
├── contact-discovery.service.ts # Load dump, filter, parse selection
├── dump-adapter.service.ts      # Convert dump → WhatsAppSyncResult
└── index.ts                     # Exports

tools/whatsmeow-cli/
├── main.go                      # Go CLI with dump command
└── Makefile                     # Cross-platform build

whatsapp-raw/                    # Gitignored temp storage
└── dump.json                    # Raw dump (user deletes after import)
```

## Security Considerations

1. **Local-only**: All data stays on user's machine
2. **Gitignored**: Raw dump never committed
3. **User control**: Explicit selection before import
4. **Deletable**: User can remove dump after import
5. **No cloud sync**: LifeOps is privacy-first

## AI/ML Pipeline

After messages are persisted to SQLite, they flow through two parallel processing pipelines:

### Pipeline 1: Behavioral Signal Extraction

Extracts statistical patterns from message history to power style-matching in AI draft generation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNAL EXTRACTION PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SQLite Messages ──▶ SignalExtractionService                    │
│       │                      │                                  │
│       │                      ▼                                  │
│       │            ┌─────────────────────┐                      │
│       │            │  7 Signal Categories │                     │
│       │            ├─────────────────────┤                      │
│       │            │ • Response Patterns  │                     │
│       │            │ • Message Structure  │                     │
│       │            │ • Expression Style   │                     │
│       │            │ • Punctuation        │                     │
│       │            │ • Common Patterns    │                     │
│       │            │ • Behavioral         │                     │
│       │            │ • Temporal           │                     │
│       │            └──────────┬──────────┘                      │
│       │                       │                                 │
│       │                       ▼                                 │
│       └────────────▶ behavior_signals table                     │
│                      (JSON + confidence scores)                 │
└─────────────────────────────────────────────────────────────────┘
```

**Processing Limits:**
- Minimum: 50 messages required for reliable extraction
- Maximum: 1000 most recent messages processed per user

**Extracted Signals:**

| Category | Signals |
|----------|---------|
| Response Patterns | `avgResponseTimeMinutes`, `responseTimeP50`, `responseTimeP95`, `initiationRate` |
| Message Structure | `avgMessageLength`, `messageLengthStd`, `medianMessageLength`, `avgWordsPerMessage` |
| Expression Style | `emojiPerMessage`, `emojiVariance`, `topEmojis`, `emojiPosition` |
| Punctuation | `exclamationRate`, `questionRate`, `periodRate`, `ellipsisRate` |
| Common Patterns | `commonGreetings`, `commonEndings`, `commonPhrases`, `fillerWords` |
| Behavioral | `asksFollowupQuestions`, `usesVoiceNotes`, `sendsMultipleMessages` |
| Temporal | `activeHours`, `weekendVsWeekdayDiff` |

### Pipeline 2: Vector Embeddings (RAG)

Enables semantic search over message history for context retrieval during draft generation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAG INDEXING PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SQLite Messages ──▶ VectorStoreService                         │
│       │                      │                                  │
│       │                      ▼                                  │
│       │            ┌─────────────────────┐                      │
│       │            │ OpenAI Embeddings   │                      │
│       │            │ text-embedding-3-   │                      │
│       │            │ small               │                      │
│       │            └──────────┬──────────┘                      │
│       │                       │                                 │
│       │                       ▼                                 │
│       │            ┌─────────────────────┐                      │
│       │            │ LanceDB             │                      │
│       │            │ (Local Vector DB)   │                      │
│       │            └──────────┬──────────┘                      │
│       │                       │                                 │
│       └──isIndexed flag───────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tracking:** The `isIndexed` boolean on `communication_events` tracks which messages have been RAG-indexed, enabling incremental updates.

### Chunking Strategy

**Current Approach:** Message-level processing (no content chunking)

Messages are processed individually rather than chunking longer content. This design choice reflects:
1. WhatsApp messages are typically short (vs documents)
2. Each message has distinct metadata (timestamp, sender)
3. Preserves conversation threading context

**Conversation Segmentation:** 4-hour gaps between messages define conversation boundaries:

```typescript
const CONVERSATION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours
```

This is used for behavioral analysis (counting conversations, measuring initiation rates) rather than storage chunking.

### Signal-Enhanced Draft Generation

The two pipelines merge to power AI draft generation:

```
┌─────────────────────────────────────────────────────────────────┐
│              SIGNAL-ENHANCED DRAFT SERVICE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load User Signals                                           │
│     behavior_signals → BehaviorSignals object                   │
│                                                                 │
│  2. RAG Context Retrieval                                       │
│     LanceDB → similar past messages                             │
│                                                                 │
│  3. Prompt Building                                             │
│     SignalEnhancedPromptBuilder combines:                       │
│     • User's behavioral signals (style fingerprint)             │
│     • RAG-retrieved examples (context)                          │
│     • Current conversation thread (input)                       │
│                                                                 │
│  4. LLM Generation                                              │
│     OpenAI → raw draft                                          │
│                                                                 │
│  5. Signal Enforcement                                          │
│     SignalEnforcer post-processes to match:                     │
│     • Message length distribution                               │
│     • Emoji frequency and placement                             │
│     • Punctuation patterns                                      │
│                                                                 │
│  6. Quality Scoring                                             │
│     QualityScorer evaluates adherence                           │
│                                                                 │
│  Output: Draft with ~75-80% style match                         │
│          (vs 60-70% for basic RAG)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key AI/ML Files

| Component | Path |
|-----------|------|
| Signal Extraction | `src/domain/signals/signal-extraction.service.ts` |
| Behavioral Extractors | `src/domain/signals/extractors/behavioral-patterns.ts` |
| Prompt Builder | `src/domain/signals/prompt-builder.ts` |
| Signal Enforcer | `src/domain/signals/signal-enforcer.ts` |
| Quality Scorer | `src/domain/signals/quality-scorer.ts` |
| Vector Store | `src/infrastructure/rag/vector.store.ts` |
| Draft Service | `src/domain/whatsapp/auto-draft/signal-enhanced-draft.service.ts` |

## Future Improvements

1. **Ink-based UI**: Upgrade from readline to React-based terminal UI
2. **Incremental sync**: Track cursor for subsequent real-time messages
3. **Media download**: Optional media file download with selection
4. **Export formats**: Export selected contacts to other formats
5. **Local embeddings**: Replace OpenAI embeddings with Ollama for full privacy
6. **Adaptive chunking**: Chunk long messages for better RAG retrieval
