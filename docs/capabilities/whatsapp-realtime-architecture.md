# WhatsApp Real-Time Architecture: Polling vs WebSockets

> **Context**: How LifeOps receives WhatsApp messages - Is it real-time or polling?

**Last Updated**: 2026-01-05
**Status**: Production Architecture

---

## 🎯 The Question

**User expectation**: "Messages are real-time. Boyfriend has Mac on, LifeOps running locally, it gets all WhatsApp data instantly."

**Reality**: It's **hybrid** - persistent WebSocket connection + event-driven polling.

---

## 📡 How WhatsApp Web Protocol Works

### WhatsApp Web (whatsmeow library)

```
┌─────────────────────────────────────────────┐
│           WhatsApp Servers                   │
│  (handles billions of messages globally)     │
└─────────────────┬───────────────────────────┘
                  │
                  │ Persistent WebSocket
                  │ (encrypted connection)
                  ↓
┌─────────────────────────────────────────────┐
│         whatsmeow (Go Library)               │
│  - Maintains WebSocket to WhatsApp servers   │
│  - Decrypts Signal Protocol messages         │
│  - Emits events when messages arrive         │
└─────────────────┬───────────────────────────┘
                  │
                  │ Events: onMessage, onReceipt, etc.
                  ↓
┌─────────────────────────────────────────────┐
│         whatsmeow-cli (Our Wrapper)          │
│  - CLI binary we call via exec()             │
│  - Exposes sync/send commands                │
└─────────────────┬───────────────────────────┘
                  │
                  │ Shell commands (exec)
                  ↓
┌─────────────────────────────────────────────┐
│           LifeOps (TypeScript)              │
│  - Calls CLI to sync messages                │
│  - Stores in database                        │
└─────────────────────────────────────────────┘
```

---

## ⚡ Is It Real-Time?

### Short Answer: **Near Real-Time** (10-30 second latency)

### How It Actually Works

**Step 1: WhatsApp → whatsmeow (Real-Time)**
```
Girlfriend sends message
  ↓
WhatsApp server receives (< 1 second)
  ↓
WebSocket push to whatsmeow (< 1 second)
  ↓
whatsmeow decrypts and stores (< 1 second)
```

**Total latency: ~1-3 seconds** ✅ Real-time

**Step 2: whatsmeow → LifeOps (Polling)**
```
whatsmeow has message
  ↓
LifeOps polls via `sync` command every 30 seconds
  ↓
CLI returns new messages
  ↓
LifeOps processes and generates draft
```

**Total latency: Up to 30 seconds** ⚠️ Polling delay

**End-to-end latency**: **1-33 seconds** (1-3s delivery + up to 30s poll interval)

---

## 🔄 Current Implementation: Polling

### Why Polling?

```typescript
// Our current approach
const pollInterval = 30; // seconds

Effect.repeat(
  Effect.gen(function* () {
    // Call whatsmeow-cli to sync
    const result = yield* whatsapp.syncMessages({ days: 1 });

    // Process new messages
    for (const msg of result.messages) {
      // Generate draft, send to self-DM, etc.
    }
  }),
  Schedule.spaced(`${pollInterval} seconds`)
);
```

**Pros**:
- ✅ Simple implementation
- ✅ Works with current whatsmeow-cli wrapper
- ✅ Resource-efficient (no constant CPU usage)
- ✅ Resilient to errors (retries automatically)

**Cons**:
- ❌ Up to 30-second delay before draft appears
- ❌ Not truly "instant"
- ❌ Wastes some resources polling when no messages

---

## 🚀 Alternative: Event-Driven (True Real-Time)

### How It Would Work

```typescript
// Hypothetical event-driven approach
whatsmeow.on('message', async (message) => {
  // Triggered IMMEDIATELY when message arrives

  if (message.from === girlfriendChatId) {
    const draft = await generateDraft(message);
    await sendToSelfDM(draft);
  }
});
```

**Pros**:
- ✅ Instant response (<3 seconds end-to-end)
- ✅ No wasted polling
- ✅ More efficient

**Cons**:
- ❌ Requires native whatsmeow integration (not CLI wrapper)
- ❌ More complex architecture
- ❌ Needs persistent process management

---

## 🏗️ Architecture Comparison

### Current: Polling Architecture

```
WhatsApp Server
  ↓ WebSocket (real-time)
whatsmeow (always connected)
  ↓ Stores messages locally
LifeOps polls every 30s
  ↓ Calls: whatsmeow-cli sync
  ↓ Gets: New messages since last sync
  ↓ Processes: Generates drafts
  ↓ Sends: To self-DM

Latency: 1-33 seconds
Complexity: Low
Resource usage: Low (polls only when scheduled)
```

### Future: Event-Driven Architecture

```
WhatsApp Server
  ↓ WebSocket (real-time)
whatsmeow (always connected)
  ↓ Emits: onMessage event
LifeOps listener (always listening)
  ↓ Receives: Event immediately
  ↓ Processes: Generates draft
  ↓ Sends: To self-DM

Latency: 1-3 seconds
Complexity: Medium
Resource usage: Medium (always listening)
```

---

## 📊 Latency Breakdown

### Polling (Current)

| Step | Time | Cumulative |
|------|------|------------|
| Girlfriend sends message | 0s | 0s |
| WhatsApp delivers to whatsmeow | 1-3s | 1-3s |
| LifeOps next poll cycle | 0-30s | 1-33s |
| Draft generation (RAG + AI) | 2-5s | 3-38s |
| Send to self-DM | 1s | 4-39s |
| **Total** | **4-39 seconds** | - |

**Average**: ~21 seconds (if poll interval is 30s)

### Event-Driven (Future)

| Step | Time | Cumulative |
|------|------|------------|
| Girlfriend sends message | 0s | 0s |
| WhatsApp delivers to whatsmeow | 1-3s | 1-3s |
| Event fires immediately | 0s | 1-3s |
| Draft generation (RAG + AI) | 2-5s | 3-8s |
| Send to self-DM | 1s | 4-9s |
| **Total** | **4-9 seconds** | - |

**Average**: ~6.5 seconds

---

## 🎯 Is 30-Second Latency Acceptable?

### Use Case Analysis

**Scenario 1: Casual Conversation**
```
Girlfriend: "Hey jaan, what's for dinner?"
[30 seconds pass]
Draft appears in self-DM: "Hey love! Was thinking pasta? 🍝"

Verdict: ✅ Acceptable
Reasoning: User is busy working, checks self-DM when convenient
```

**Scenario 2: Urgent Message**
```
Girlfriend: "Where are you?? You're late!"
[30 seconds pass]
Draft appears in self-DM: "So sorry jaan! Traffic is crazy..."

Verdict: ⚠️ Borderline
Reasoning: She's already sent 2 more messages by the time draft appears
```

**Scenario 3: Emotional Support Needed**
```
Girlfriend: "I'm so stressed about this presentation 😩"
[30 seconds pass]
Draft appears in self-DM: "That sounds really tough. Want to talk?"

Verdict: ❌ Too slow
Reasoning: Delayed response feels uncaring
```

### Recommendation

**For MVP**: 30-second polling is **acceptable**
- User is actively working, checks self-DM periodically
- Draft quality matters more than speed
- Simple to implement and maintain

**For Production**: Reduce to **10-15 seconds**
- Still polling, but more responsive
- Balances latency with resource usage
- Good enough for most conversations

**For Premium**: Event-driven **(<5 seconds)**
- Near-instant drafts
- Feels like a real assistant
- Requires architectural upgrade

---

## 🔧 Tuning Polling Interval

### Trade-offs

| Interval | Latency | API Calls/Hour | Resource Usage | Use Case |
|----------|---------|----------------|----------------|----------|
| **5s** | 5-10s avg | 720 | High | Premium users, urgent situations |
| **10s** | 10-15s avg | 360 | Medium | Recommended for production |
| **30s** | 30-35s avg | 120 | Low | MVP, resource-constrained |
| **60s** | 60-65s avg | 60 | Very Low | Background monitoring |

### Current Configuration

```bash
# In auto-draft-monitor.ts
pollIntervalSeconds: 30 // Default

# Can be overridden via env
POLL_INTERVAL=10 bun run src/cli/commands/auto-draft-monitor.ts
```

---

## 🚀 How to Upgrade to Event-Driven (Future)

### Option 1: Native whatsmeow Integration

```go
// Would require writing Go code or Bun FFI
client := whatsmeow.NewClient(...)

client.AddEventHandler(func(evt interface{}) {
  switch v := evt.(type) {
  case *events.Message:
    // Call TypeScript handler via IPC
    notifyTypeScript(v)
  }
})
```

**Pros**: True real-time
**Cons**: Complex, requires Go knowledge

### Option 2: whatsmeow-cli with Watch Mode

```bash
# Hypothetical CLI enhancement
whatsmeow-cli watch --on-message="curl http://localhost:3000/webhook"
```

**Pros**: Simpler, stays in TypeScript
**Cons**: Requires modifying whatsmeow-cli

### Option 3: Reduce Poll Interval to 5-10s

```typescript
pollIntervalSeconds: 5 // Near real-time
```

**Pros**: Simplest, no architecture change
**Cons**: Higher resource usage, still not instant

---

## 📋 Polling Best Practices (Current Approach)

### 1. Adaptive Polling

```typescript
// Poll more frequently during active hours
const getInterval = () => {
  const hour = new Date().getHours();

  // 9 AM - 11 PM: Active hours (faster polling)
  if (hour >= 9 && hour <= 23) {
    return 10; // 10 seconds
  }

  // Late night: Slower polling
  return 60; // 60 seconds
};
```

### 2. Exponential Backoff on Errors

```typescript
Schedule.spaced("30 seconds").pipe(
  Schedule.exponential("1 second"), // Back off on errors
  Schedule.jittered() // Add randomness to prevent thundering herd
)
```

### 3. Smart Filtering

```typescript
// Only process messages newer than last poll
const isNew = msg.timestamp > lastProcessedTimestamp;

// Only process from girlfriend (not group messages)
const isGirlfriend = msg.chatJid === girlfriendChatId;

// Only process text messages (skip media-only)
const hasText = msg.text !== null;
```

---

## 📝 Summary: Polling vs Real-Time

### WhatsApp → whatsmeow
✅ **Real-time** (WebSocket, <3 seconds)

### whatsmeow → LifeOps
⚠️ **Polling** (30-second intervals, average 15-second delay)

### End-to-End
🟡 **Near real-time** (4-39 seconds total latency)

### Is It Acceptable?
✅ **Yes for MVP** - User checks self-DM when convenient
✅ **Yes for production** - Reduce to 10s interval
⚠️ **Future enhancement** - Event-driven for premium users

### Current Architecture

```
Girlfriend sends message
  ↓ (1-3 seconds) WebSocket
whatsmeow receives and stores
  ↓ (0-30 seconds) Polling
LifeOps detects new message
  ↓ (2-5 seconds) RAG + AI
Draft generated
  ↓ (1 second) Send
Self-DM receives draft
```

**Total**: ~4-39 seconds (avg ~21s with 30s polling)

---

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
**Related**: [auto-draft-monitor.ts](../src/domain/whatsapp/auto-draft/auto-draft-monitor.ts)
