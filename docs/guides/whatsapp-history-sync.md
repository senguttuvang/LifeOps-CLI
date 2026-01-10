# WhatsApp History Sync - How It Works

**Last Updated:** 2026-01-05

## User Workflow (Simple - QR Code Only)

### First-Time Setup

```bash
bun run cli sync
```

**What happens:**
1. ✅ Shows QR code in terminal
2. ✅ User scans with WhatsApp app (Settings → Linked Devices → Link a Device)
3. ✅ **Automatic history sync** - WhatsApp sends ALL message history (one-time event)
4. ✅ Messages stored in `lifeops3.db` permanently
5. ✅ Connection stays active for future updates

**Duration:** First sync may take 5-30 minutes depending on message count (happens once)

### Subsequent Syncs

```bash
bun run cli sync --days=30
```

**What happens:**
1. ✅ Already authenticated (no QR code needed)
2. ✅ Gets only NEW messages since last sync
3. ✅ Real-time incremental updates
4. ✅ Much faster (~seconds)

## Technical Details

### How History Sync Works

**WhatsApp Web Multidevice Protocol:**
- Uses WebSocket connection (like WhatsApp Web on desktop)
- Works with BOTH iPhone and Android
- Phone is "primary device", computer is "linked device"

**History Sync Event (ONE-TIME):**
> After QR code authentication, WhatsApp automatically sends a `HistorySync` event containing ALL historical messages from the phone.

**Critical Implementation Details:**
1. History sync is **automatic** - happens immediately after QR scan
2. Sent as **protobuf-encoded blob** over WebSocket
3. **One-time only** - won't repeat (must store on first receipt)
4. Contains ALL messages, chats, contacts (complete history)

### Data Flow

```
User's Phone (WhatsApp)
    ↓ [QR Code Scan]
WhatsApp Servers
    ↓ [WebSocket: HistorySync Event]
whatsmeow-cli (Go binary)
  - Receives protobuf blob
  - Decrypts with session keys
  - Converts to JSON
    ↓ [JSON output]
Our TypeScript Service
  - Parses JSON
  - Converts to domain entities
    ↓ [SQL INSERT]
lifeops3.db (SQLite)
  - Stores permanently
```

### What Gets Synced

**First-Time History Sync:**
- ✅ All messages (text, images, videos, audio, documents)
- ✅ All chats (individual + groups)
- ✅ All contacts
- ✅ Message timestamps (preserves chronological order)
- ✅ Media metadata (file sizes, types, durations)
- ⚠️ Media files NOT downloaded (only metadata + download URLs)

**Incremental Updates (After First Sync):**
- ✅ New messages as they arrive (real-time)
- ✅ Message edits/deletions
- ✅ Read receipts
- ✅ Reactions

### Storage Guarantees

**Persistence:**
- All messages stored in `lifeops3.db` (SQLite)
- Survives restarts, reconnections, system reboots
- No dependency on phone being online after first sync

**Data Completeness:**
- First sync gets COMPLETE history (years of messages)
- No arbitrary time limits (gets everything from phone)
- Respects WhatsApp's data retention (what's on phone is what you get)

## For Users: No Complex Setup Required

### ✅ What Users DO

```bash
# Step 1: Run sync
bun run cli sync

# Step 2: Scan QR code with phone
# (WhatsApp app shows QR scanner)

# Step 3: Wait for history sync
# (Terminal shows progress: "Syncing... received 10,000 messages...")

# Done! All messages now in local database
```

### ❌ What Users DON'T Need

- ❌ Export backup files from phone
- ❌ Connect phone via USB cable
- ❌ Root/jailbreak phone
- ❌ Install special apps on phone
- ❌ Upload data to cloud
- ❌ Complex technical operations

## Developer Notes

### Android Import Command (Testing Only)

```bash
bun run cli import-android --db="/path/to/msgstore.db"
```

**Purpose:**
- Developer testing with real data
- Bulk import historical data without QR scan
- Useful for testing with large datasets (like AV-Events 193k messages)

**NOT for end users:**
- Requires exporting msgstore.db from Android (complex)
- Only works with Android (iOS uses different backup format)
- Real users should use QR code sync instead

### Implementation References

**whatsmeow Library:**
- Handles WebSocket connection to WhatsApp servers
- Manages encryption keys (stored in `data/whatsapp/session.db`)
- Provides history sync via `events.HistorySync`

**Our Implementation:**
- `src/infrastructure/whatsapp/whatsapp.client.ts` - Calls Go CLI binary
- `src/infrastructure/adapters/whatsapp/whatsapp.adapter.ts` - Converts to domain entities
- `src/domain/whatsapp/sync.service.ts` - Persists to database

### Future Enhancements

**Planned:**
- [ ] Progress indicator during first sync (show message count)
- [ ] Ability to resume interrupted first sync
- [ ] Media download (currently only metadata)
- [ ] Multi-account support (link multiple phones)

**Not Planned:**
- iOS backup import (too complex, encrypted iTunes backups)
- WhatsApp Business API (different protocol)
- Group admin features (read-only for now)

## Troubleshooting

### "First sync taking too long"
- **Normal:** 5-30 minutes for years of message history
- **Check:** Terminal shows progress updates
- **Wait:** Don't interrupt - one-time operation

### "No messages after QR scan"
- **Check:** Phone still shows as "Linked Device" in WhatsApp settings
- **Retry:** Unlink and re-scan QR code
- **Verify:** `sqlite3 lifeops3.db "SELECT COUNT(*) FROM messages"`

### "Want to re-sync history"
- **Solution:** Delete `data/whatsapp/session.db` and `lifeops3.db`, then re-run sync
- **Warning:** This removes ALL local data (cannot undo)

## References

- [whatsmeow GitHub](https://github.com/tulir/whatsmeow)
- [WhatsApp Web Protocol](https://github.com/tulir/whatsmeow/discussions/692)
- [History Sync Implementation](https://pkg.go.dev/go.mau.fi/whatsmeow)
