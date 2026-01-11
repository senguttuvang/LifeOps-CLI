# WhatsApp Sync Architecture

> **Last Updated**: 2026-01-11
>
> This document covers both WhatsApp's internal multi-device sync architecture and how LifeOps CLI integrates with it.

## Table of Contents

1. [Overview](#overview)
2. [WhatsApp Multi-Device Architecture](#whatsapp-multi-device-architecture)
3. [How Offline Devices Catch Up](#how-offline-devices-catch-up)
4. [Our Integration Strategy](#our-integration-strategy)
5. [CLI Passive Reading: Zero Phone Impact](#cli-passive-reading-zero-phone-impact)
6. [The Challenge](#the-challenge)
7. [Two-Phase Sync Architecture](#two-phase-sync-architecture)
8. [Data Integration Patterns (DDIA)](#data-integration-patterns-ddia)
9. [Schema: Sync State Tracking](#schema-sync-state-tracking)
10. [Gap Analysis & Future Improvements](#gap-analysis--future-improvements)

---

## Overview

LifeOps CLI syncs WhatsApp messages using a two-phase approach that respects user privacy and provides control over what data is imported.

---

## WhatsApp Multi-Device Architecture

Understanding how WhatsApp handles sync internally is critical for building a reliable integration.

### The Old Architecture (Pre-2021)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEGACY ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Phone (Source of Truth) ◄───────► WhatsApp Web               │
│          │                              │                       │
│          │                              │                       │
│          └── Persistent secure ─────────┘                       │
│              connection (mirror)                                │
│                                                                 │
│   Problems:                                                     │
│   • Phone must be online for Web to work                       │
│   • Phone battery drain                                         │
│   • Disconnects when phone has poor connectivity               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The New Multi-Device Architecture (2021+)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-DEVICE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              ┌──────────────────────────────┐                   │
│              │    WhatsApp Servers           │                   │
│              │  • Device registry            │                   │
│              │  • Account→[Devices] mapping  │                   │
│              │  • Message queue (Mnesia)     │                   │
│              │  • NO message storage         │                   │
│              └──────────────────────────────┘                   │
│                     │              │              │              │
│           ┌─────────┴─────────────┴──────────────┴─────────┐   │
│           ▼                  ▼                    ▼          │   │
│     ┌──────────┐      ┌──────────┐         ┌──────────┐     │   │
│     │  Phone   │      │  Web/    │         │  CLI     │     │   │
│     │ (Device1)│      │ Desktop  │         │ (Device3)│     │   │
│     │          │      │ (Device2)│         │          │     │   │
│     └──────────┘      └──────────┘         └──────────┘     │   │
│         │                   │                    │           │   │
│         └───────────────────┴────────────────────┘           │   │
│                             │                                │   │
│               Each device has its OWN identity key           │   │
│               No single source of truth                      │   │
│                                                               │   │
└───────────────────────────────────────────────────────────────────┘
```

**Key Changes** (per [Meta Engineering](https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/)):

| Aspect | Old | New |
|--------|-----|-----|
| Source of Truth | Phone only | All devices are peers |
| Identity Keys | Single per account | One per device |
| Phone Requirement | Must be online | Can be offline |
| Device Limit | 1 phone + web | 1 phone + 4 companions |
| E2EE | Phone encrypts for all | **Client-fanout**: sender encrypts N times |

### Client-Fanout Encryption

When you send a message, your device:

```
Sender Device
     │
     ├── Encrypt for Recipient's Phone (using their Device1 public key)
     ├── Encrypt for Recipient's Desktop (using their Device2 public key)
     ├── Encrypt for Recipient's CLI (using their Device3 public key)
     ├── Encrypt for YOUR Phone (for your own message history)
     └── Encrypt for YOUR Desktop (for your own message history)

Each encryption uses the pairwise Signal Protocol session established
with that specific device.
```

**Critical Implication**: Messages are **not stored on server after delivery**. The server is just a relay.

### Server-Side Technology Stack

Per [WhatsApp Architecture deep-dives](https://www.cometchat.com/blog/whatsapps-architecture-and-system-design):

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | Erlang | Concurrency, fault tolerance |
| OS | FreeBSD | Performance, networking |
| XMPP Server | Ejabberd (customized) | Message routing |
| VM | BEAM | Lightweight processes (2-3M per server) |
| Database | Mnesia | In-RAM routing tables, message queues |
| Media Server | YAWS | Multimedia handling |

---

## How Offline Devices Catch Up

This is the critical question: **When a device is offline and comes back online, how does it get messages it missed?**

### The Mnesia Message Queue

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE MESSAGE FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Sender sends message to your account                        │
│     │                                                           │
│     ▼                                                           │
│  2. WhatsApp server looks up your devices:                      │
│     Account "you" → [Phone, Desktop, CLI]                       │
│     │                                                           │
│     ├─► Phone: ONLINE → Deliver → ✓ One checkmark              │
│     │                                                           │
│     ├─► Desktop: ONLINE → Deliver → ✓                          │
│     │                                                           │
│     └─► CLI: OFFLINE → Queue in Mnesia                         │
│            │                                                    │
│            │   ┌───────────────────────────────┐               │
│            └──►│  Mnesia Offline Queue          │               │
│                │  • Write to RAM first          │               │
│                │  • Flush to disk if lingering  │               │
│                │  • Replicated to backup server │               │
│                │  • 98% served from memory      │               │
│                └───────────────────────────────┘               │
│                                                                 │
│  3. CLI comes back online:                                      │
│     │                                                           │
│     ▼                                                           │
│  4. CLI opens socket connection to Ejabberd                     │
│     │                                                           │
│     ▼                                                           │
│  5. Server queries Mnesia for waiting messages                  │
│     │                                                           │
│     ▼                                                           │
│  6. Messages delivered → CLI sends ACK                          │
│     │                                                           │
│     ▼                                                           │
│  7. Server deletes messages from Mnesia queue                   │
│     │                                                           │
│     ▼                                                           │
│  8. Sender sees second checkmark (✓✓)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Read Receipt Synchronization

When you read a message on one device, other devices need to know:

```
┌─────────────────────────────────────────────────────────────────┐
│                    READ STATUS SYNC                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. You read message on Phone                                   │
│     │                                                           │
│     ▼                                                           │
│  2. Phone sends "read receipt" to server                        │
│     │                                                           │
│     ▼                                                           │
│  3. Server broadcasts read status to:                           │
│     ├─► Your other devices (Desktop, CLI)                      │
│     └─► Sender's devices (they see blue ticks)                 │
│                                                                 │
│  Note: If Desktop is offline during this sync,                  │
│        it will receive the read status when it reconnects.      │
│        The message will appear as "read" even though            │
│        Desktop didn't read it locally.                          │
│                                                                 │
│  Technical detail:                                              │
│  • Server load >70% → 5% sync error rate                       │
│  • Auto-retry within 30 seconds                                │
│  • Group receipts 1.8x slower than 1:1                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Initial History Transfer (First-Time Link)

When you first link a new device via QR code:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL HISTORY SYNC                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phone (Primary Device)                                          │
│     │                                                           │
│     │  1. User scans QR code with new device                   │
│     │                                                           │
│     ▼                                                           │
│  2. Phone creates Account Signature:                            │
│     Signs new device's Identity Key with phone's key            │
│     │                                                           │
│     ▼                                                           │
│  3. New device creates Device Signature:                        │
│     Signs phone's Identity Key with new device's key            │
│     │                                                           │
│     ▼                                                           │
│  4. Phone transfers ENTIRE message history                      │
│     │                                                           │
│     │   ┌───────────────────────────────────────┐              │
│     │   │  E2EE History Blob                     │              │
│     │   │  • All conversations                   │              │
│     │   │  • All messages                        │              │
│     │   │  • Compressed & encrypted              │              │
│     │   │  • Sent via WhatsApp servers          │              │
│     │   └───────────────────────────────────────┘              │
│     │                                                           │
│     └──────► New Device                                         │
│              │                                                  │
│              │  events.HistorySync received                     │
│              │  Type: INITIAL_BOOTSTRAP                         │
│              │                                                  │
│              ▼                                                  │
│         Parse and store locally                                 │
│                                                                 │
│  THIS ONLY HAPPENS ONCE!                                        │
│  Subsequent syncs use the Mnesia queue mechanism above.         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### On-Demand History Request (whatsmeow)

After initial sync, if you need older messages:

```go
// whatsmeow provides BuildHistorySyncRequest
req := cli.BuildHistorySyncRequest(messageInfo, 50)
cli.SendMessage(ctx, jid, req, whatsmeow.SendRequestExtra{Peer: true})

// Response arrives as events.HistorySync with type ON_DEMAND
// Contains 50 messages BEFORE the specified message
```

**This is backward pagination, not incremental sync forward.**

---

## Our Integration Strategy

### What We Can and Cannot Do

| Feature | WhatsApp Support | Our Implementation |
|---------|------------------|-------------------|
| Initial full sync | ✅ Yes (QR scan) | ✅ `dump` command |
| Real-time new messages | ✅ events.Message | ⚠️ Manual polling |
| "Messages since X" | ❌ Not offered | ❌ Cannot implement |
| Backward pagination | ✅ BuildHistorySyncRequest | ❌ Not yet |
| Cursor-based delta | ❌ E2EE prevents | ❌ Cannot implement |

### Why No Delta API Exists

WhatsApp's E2EE architecture fundamentally prevents server-side delta tracking:

1. **Server can't read content**: Messages are encrypted end-to-end
2. **Server can't index by timestamp**: No plaintext metadata
3. **Messages deleted after delivery**: No server-side history
4. **Each device is independent**: No central "last sync cursor"

---

## CLI Passive Reading: Zero Phone Impact

A critical design decision: **our CLI operates in "stealth mode"** and does NOT affect your normal WhatsApp experience.

### Current Behavior

Our Go CLI (`tools/whatsmeow-cli/main.go`) is completely passive:

```go
client.AddEventHandler(func(evt interface{}) {
    switch v := evt.(type) {
    case *events.Message:
        msg := convertMessage(v)      // Convert to our format
        messages = append(messages, msg) // Store locally
        // ⚠️ NO MarkRead call - sender never sees "read"
    case *events.HistorySync:
        // Process history passively - no receipts sent
    }
})
```

**Key point**: We NEVER call `MarkRead()`, so:
- Messages remain "delivered" (double gray check) to senders
- Senders don't know you've seen their messages via CLI
- Your phone's unread state is completely unaffected

### whatsmeow Read Receipt Options

| Method | Effect | Sender Sees |
|--------|--------|-------------|
| `MarkRead(ids...)` | Blue checks | ✅ "Read" |
| `ReceiptTypeReadSelf` | Sync across YOUR devices only | ❌ Still "Delivered" |
| No call (our approach) | Nothing sent | ❌ Still "Delivered" |

### Passive Mode Settings

For production use, we recommend these whatsmeow settings:

```go
// Stealth configuration
client.SetPassive(true)                        // Don't appear "online"
client.SetForceActiveDeliveryReceipts(false)   // Inactive delivery receipts
// Don't call MarkRead() - keep messages unread for sender
```

### Implementation Phases

| Phase | Behavior | Phone Impact |
|-------|----------|--------------|
| **Current** | Passive receive only | ✅ Zero impact |
| **Phase 2** | Add `--passive`/`--mark-read` flags | User choice |
| **Phase 3** | Optional ReceiptTypeReadSelf | Syncs YOUR read state only |

### Why This Matters

Users can run the CLI to analyze their messages without:
- Alerting senders that messages were read
- Changing their phone's unread counts
- Appearing "online" to contacts
- Affecting their normal WhatsApp workflow

This is essential for use cases like:
- Relationship pattern analysis without revealing you're analyzing
- Batch processing old conversations
- Background sync for AI indexing

---

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

---

## Data Integration Patterns (DDIA)

Based on patterns from [Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/) and [Debezium's CDC analysis](https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/):

### Pattern Applicability Matrix

| Pattern | Applicable? | Reason |
|---------|-------------|--------|
| **Change Data Capture (CDC)** | ❌ No | We don't control WhatsApp's database |
| **Event Sourcing** | ⚠️ Partial | WhatsApp emits events, but no replay guarantee |
| **Log-Based Messaging** | ❌ No | No access to WhatsApp's event log |
| **Polling with Watermarks** | ✅ Yes | Poll with `lastSyncAt` watermark |
| **Dual Writes** | ❌ Dangerous | Would require writing to both systems |
| **Outbox Pattern** | ❌ No | We're consuming, not producing |

### Our Pattern: Polling Producer with Idempotent Consumer

```
┌─────────────────────────────────────────────────────────────────┐
│           DDIA PATTERN: POLLING + IDEMPOTENT UPSERT             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WhatsApp ──(poll every N mins)──► Transform ──► SQLite        │
│     │                                  │                        │
│     │                                  ▼                        │
│     │                          ┌─────────────┐                 │
│     │                          │  syncState  │                 │
│     │                          │ lastSyncAt  │                 │
│     │                          │ externalId  │                 │
│     │                          └─────────────┘                 │
│     │                                  │                        │
│     └───────────(time window)──────────┘                        │
│         "Give me messages from last 30 days"                    │
│                                                                 │
│  Deduplication:                                                 │
│    ON CONFLICT (channelId, externalId) DO NOTHING              │
│                                                                 │
│  Guarantees:                                                    │
│    • At-least-once delivery (overlap is fine)                  │
│    • Exactly-once storage (dedup by externalId)                │
│    • Failure recovery (retry without data loss)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Pattern Works

1. **Idempotent writes**: `externalId` (WhatsApp message ID) ensures dedup
2. **Watermark tracking**: `lastSyncAt` in syncState tracks progress
3. **Overlap tolerance**: Fetching 30 days overlaps with previous sync, dedup handles it
4. **Failure recovery**: If sync fails, retry without data loss
5. **No coordination**: No distributed transactions needed

### Pattern from DDIA Chapter 11

> "At-least-once delivery with dedup": The producer may send duplicates, but the consumer uses unique identifiers to detect and discard them. This provides effectively-once semantics without the complexity of exactly-once transactions.

---

## Schema: Sync State Tracking

Our `syncState` table enables watermark-based sync tracking:

```typescript
// src/infrastructure/db/schema/sync.ts

export const syncState = sqliteTable("sync_state", {
  id: text("id").primaryKey(),              // "whatsapp" or composite key
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id),
  cursor: text("cursor"),                    // For future delta sync
  lastSyncAt: integer("last_sync_at"),       // Watermark timestamp
  lastSyncStatus: text("last_sync_status"),  // "success" | "partial" | "failed"
  errorMessage: text("error_message"),
  syncedCount: integer("synced_count"),      // Items in last run
  totalCount: integer("total_count"),        // Total known items
  metadata: text("metadata"),                // JSON for channel-specific data
});
```

### Current Usage

```typescript
// sync.service.ts - After successful sync

await db.insert(syncState).values({
  id: "whatsapp",
  channelId: "whatsapp",
  lastSyncAt: syncedAt,
  lastSyncStatus: "success",
  cursor: null,  // ← Not used (WhatsApp doesn't provide cursors)
}).onConflictDoUpdate({
  target: syncState.id,
  set: {
    lastSyncAt: syncedAt,
    lastSyncStatus: "success",
  },
});
```

### Schema Design for Future Patterns

The schema supports multiple sync patterns:

| Field | Current Use | Future Use |
|-------|-------------|------------|
| `cursor` | Unused | Real-time event offset |
| `metadata` | Unused | `{ highestTimestamp: X, pendingMessageIds: [...] }` |
| `syncedCount` | Basic count | Progress tracking |
| `totalCount` | Unused | Discovery phase count |

### Potential Enhanced Metadata

```json
{
  "highestMessageTimestamp": 1704931200,
  "lastEventId": "msg_12345",
  "syncMode": "full" | "incremental" | "realtime",
  "deviceId": "abc123",
  "sessionStart": 1704931000,
  "gaps": [
    { "from": 1704920000, "to": 1704925000, "reason": "offline" }
  ]
}
```

---

## Gap Analysis & Future Improvements

### Current Gaps

| Gap | Impact | Solution Path |
|-----|--------|---------------|
| No real-time events | Manual re-sync needed | Add `monitor` command with event subscription |
| No backward pagination | Can't fill history gaps | Implement `BuildHistorySyncRequest` wrapper |
| Offline catch-up relies on overlap | Potential missed messages | Use `metadata.gaps` to track and fill |
| Read receipts not synced | Incomplete conversation state | Subscribe to receipt events |

### Proposed Enhancement: Hybrid Sync Modes

```typescript
interface EnhancedSyncOptions {
  mode: "full" | "incremental" | "realtime" | "backfill";
  since?: Date;              // For incremental
  beforeMessageId?: string;  // For backfill (backward pagination)
  chatJid?: string;          // Filter to specific chat
}

// Mode behaviors:
// full: Dump all within time window (current)
// incremental: Use lastSyncAt watermark + time overlap
// realtime: Subscribe to events.Message stream
// backfill: Use BuildHistorySyncRequest to fill gaps
```

### Roadmap

1. **Phase 1**: Real-time event monitoring
   - Add `monitor` command
   - Subscribe to `events.Message`, `events.Receipt`
   - Store events with `isRealtime: true` flag

2. **Phase 2**: Gap detection and backfill
   - Track gaps in `metadata.gaps`
   - On reconnect, use backward pagination to fill

3. **Phase 3**: Conflict resolution
   - Handle edits/deletes received out of order
   - Implement vector clocks for multi-device consistency

---

## References

### Internal Documentation

- [AI Data Pipeline Architecture](./ai-data-pipeline.md) - Downstream AI processing (vectors, signals)
- [Implementation Plan: RAG + Signals](../capabilities/implementation-plan-rag-signals.md) - AI personalization details

### External Sources

- [How WhatsApp enables multi-device capability - Meta Engineering](https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/)
- [Understanding WhatsApp's Architecture & System Design - CometChat](https://www.cometchat.com/blog/whatsapps-architecture-and-system-design)
- [How WhatsApp Works - GetStream](https://getstream.io/blog/whatsapp-works/)
- [whatsmeow Go Package Documentation](https://pkg.go.dev/go.mau.fi/whatsmeow)
- [Event Sourcing vs CDC - Debezium](https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/)
- [Designing Data-Intensive Applications, 2nd Edition - O'Reilly](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/)
- [Behind the Blue Ticks - JavaScript in Plain English](https://javascript.plainenglish.io/behind-the-blue-ticks-how-whatsapp-tracks-read-receipts-even-offline-c9329a23cd12)

---

## Legacy: Future Improvements (Original)

1. ~~**Ink-based UI**~~: ✅ Completed - using Ink for contact selection
2. **Incremental sync**: Track cursor for subsequent real-time messages
3. **Media download**: Optional media file download with selection
4. **Export formats**: Export selected contacts to other formats
5. **Local embeddings**: Replace OpenAI embeddings with Ollama for full privacy
6. **Adaptive chunking**: Chunk long messages for better RAG retrieval
