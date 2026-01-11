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

## Future Improvements

1. **Ink-based UI**: Upgrade from readline to React-based terminal UI
2. **Incremental sync**: Track cursor for subsequent real-time messages
3. **Media download**: Optional media file download with selection
4. **Export formats**: Export selected contacts to other formats
