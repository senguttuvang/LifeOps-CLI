# Self-DM Command Interface Architecture

> **Context**: Using WhatsApp's "Message Yourself" feature as the primary interface for LifeOps commands.

**Last Updated**: 2026-01-05
**Status**: Core Architecture

---

## 🎯 **The Core Pattern: Self-DM as Bot Interface**

### How It Works
```
1. User opens WhatsApp "Message Yourself" (self-DM)
2. Types: "@lifeops suggest outdoor activity"
3. LifeOps (running on laptop):
   - Detects message in self-DM chat
   - Parses command
   - Generates response
   - Sends response to self-DM (from user's own account)
4. User sees response in self-DM
5. User can forward/copy to partner chat if desired
```

### Why This Is Elegant
✅ **WhatsApp-native**: No separate app needed
✅ **Private**: Partner doesn't see commands or responses (unless you share)
✅ **Familiar UX**: Just like texting yourself reminders
✅ **Command history**: All interactions logged in one chat
✅ **Simple**: One person uses it, no coordination needed

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────┐
│               WhatsApp Account                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  💬 Partner Chat                                │
│     "Hey! Want to go hiking?"                   │
│                                                 │
│  📝 Self-DM (Message Yourself)                  │
│     @lifeops suggest outdoor                    │
│     ↳ [LifeOps response appears here]          │
│                                                 │
└─────────────────────────────────────────────────┘
         ↓ (whatsmeow reads)      ↑ (whatsmeow sends)
┌─────────────────────────────────────────────────┐
│         LifeOps (Running on Laptop)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Message Sync (whatsmeow)                   │
│     ├─ Monitor all chats                       │
│     └─ Detect self-DM messages                 │
│                                                 │
│  2. Command Parser                             │
│     ├─ Match @lifeops pattern                  │
│     └─ Extract command + args                  │
│                                                 │
│  3. Command Handler (Effect-TS)                │
│     ├─ suggest → Activity suggestions          │
│     ├─ analyze → Relationship insights         │
│     ├─ memory → Search memories                │
│     ├─ draft → Message drafting                │
│     └─ [other commands]                        │
│                                                 │
│  4. Response Generator                         │
│     ├─ Format for WhatsApp                     │
│     └─ Send to self-DM                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 💬 **User Interaction Flow**

### Example 1: Activity Suggestion
```
[Self-DM]
You: @lifeops suggest outdoor

[LifeOps processes...]

You (via LifeOps):
💡 Outdoor Activity Suggestions

Based on 23 hiking trips, 8 beach visits:

1. 🏄 Sunrise Kayaking + Beach Breakfast
   Why: New experience (water), sunrise timing, food ritual
   Where: Marina del Rey - rentals $30
   When: Best on weekends, 6am start

2. 🌸 Wildflower Meadow Picnic
   Why: Nature + photography + elaborate food setup
   Where: Antelope Valley Poppy Reserve
   When: Peak bloom May 15-30

3. 🌙 Full Moon Night Hike
   Why: Less crowded, unique experience, stargazing
   Where: Griffith Observatory trail
   When: Next full moon: Jan 25

Want full plan for any of these? Reply:
@lifeops plan 1

[You can now forward this to Partner chat, or request more details]
```

### Example 2: Memory Search
```
[Self-DM]
You: @lifeops memory beach sunset

[LifeOps searches vector DB...]

You (via LifeOps):
🔍 Found 3 beach sunset memories:

1. "Beach Sunset Decision" - May 15, 2025
   📍 Santa Monica Beach
   💬 "The night we decided to move in together"
   🖼️ [Photo attached]
   Context: 23 messages from that evening about future plans

2. "Perfect Golden Hour" - July 4, 2025
   📍 Malibu
   💬 "Watched fireworks from the beach"
   🖼️ [2 photos]

3. "Sunset Proposal Spot" - Aug 20, 2025
   📍 Laguna Beach
   💬 "Came back to where I proposed"
   🖼️ [Photo]

Want details on any? Reply:
@lifeops memory 1
```

### Example 3: Draft Message
```
[Self-DM]
You: @lifeops draft apology forgot anniversary

[LifeOps analyzes your communication style...]

You (via LifeOps):
💬 Message Draft (based on your usual style):

"Hey love, I messed up and I know it. I can't believe I forgot our anniversary yesterday. There's no excuse - it's important and you're important. I'm sorry.

I want to make it up to you properly. How about I plan something special this weekend? Your choice of activity.

Again, I'm really sorry. I love you. ❤️"

---
Feel free to edit and send!

[You review, maybe adjust, then copy to Partner chat]
```

### Example 4: Relationship Analysis
```
[Self-DM]
You: @lifeops analyze recent

[LifeOps processes last 50 messages + RAG context...]

You (via LifeOps):
📊 Relationship Analysis (Last 30 Days)

Connection Health: ✅ Strong
- Deep conversations: 8 (every 3-4 days)
- Avg response time: 12 minutes (engaged)
- Emotional balance: Both giving/receiving support

Recent Patterns:
📈 Positive:
  - Increased planning together (5 future activities discussed)
  - Humor/playfulness high (lots of jokes, memes)
  - Appreciation expressed 6x this month

⚠️ Watch:
  - Work stress mentions up 40% (mostly Partner)
  - Date nights down from 2/week to 1/week
  - Topic diversity moderate (mostly work, food, logistics)

Suggestions:
1. Send support about work stress (hasn't been acknowledged)
2. Plan date night for this weekend
3. Introduce new conversation topic (you haven't discussed: travel plans, hobbies, future dreams recently)

Want help with any of these?
```

### Example 5: Dashboard (Slack /stats Style)
```
[Self-DM]
You: @lifeops dashboard

[LifeOps generates weekly summary...]

You (via LifeOps):
━━━━━━━━━━━━━━━━━━━━━━━━
💖 Relationship Dashboard
Week of Jan 1-7, 2026
━━━━━━━━━━━━━━━━━━━━━━━━

Overall Health: 87/100 ✅
Trend: ↗️ +5 pts from last week

━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Key Metrics

Connection Debt: ✅ Low
└ Last deep convo: 2 days ago
└ Target: Every 3-4 days

Emotional Balance: ✅ Balanced
└ Support ratio: 1.14:1

Communication Quality: ⚠️ Moderate
└ Depth score: 6.2/10 (↓ from 7.1)
└ Topic diversity: 8 unique

Novelty & Growth: ⚠️ Declining
└ 12 days since new activity
└ Target: Every 8-10 days

Quality Time: ✅ Strong
└ Date nights: 2/2 this week
└ Shared activities: 5

━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Alerts (2)

🔔 Plan something new!
   No new activities in 12 days.
   → @lifeops suggest activity

🔔 Topic diversity declining
   Recent convos: 42% work, 31% logistics
   Only 27% personal/emotional topics.
   → @lifeops draft deep-check-in

━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Wins This Week

✨ Quick support response
   Responded in 8 min to Partner's stress message

✨ Conflict resolved fast
   4 hours (↓ 50% from avg)

✨ Spontaneous date night
   Tuesday (not planned - shows flexibility!)

━━━━━━━━━━━━━━━━━━━━━━━━

Full report: @lifeops analyze
Goal progress: @lifeops goals
Set reminders: @lifeops remind
```

---

## 🛠️ **Technical Implementation**

### Step 1: Detect Self-DM Messages

```typescript
import { Effect } from 'effect';
import type { Message } from './types';

// Identify self-DM chat ID
const SELF_CHAT_ID = yield* Effect.tryPromise({
  try: async () => {
    // User's phone number in WhatsApp format
    const userJID = `${userPhoneNumber}@s.whatsapp.net`;
    return userJID; // Self-DM chat ID is same as user's JID
  },
  catch: (e) => new Error(`Failed to get self-chat ID: ${e}`)
});

// Monitor messages
const monitorMessages = Effect.gen(function* () {
  const db = yield* DatabaseService;

  // Poll for new messages every 5 seconds
  yield* Effect.repeat(
    Effect.gen(function* () {
      const newMessages = yield* db.getUnprocessedMessages();

      for (const message of newMessages) {
        // Check if from self-DM
        if (message.chatId === SELF_CHAT_ID && message.fromMe === false) {
          // Message sent by user to themselves
          yield* handleSelfDMMessage(message);
        }

        // Mark as processed
        yield* db.markMessageProcessed(message.id);
      }
    }),
    Schedule.spaced('5 seconds')
  );
});
```

### Step 2: Parse Commands

```typescript
interface Command {
  name: string;
  args: string;
}

const parseCommand = (messageText: string): Command | null => {
  // Match @lifeops <command> [args]
  const pattern = /^@lifeops\s+(\w+)(?:\s+(.+))?$/i;
  const match = messageText.trim().match(pattern);

  if (!match) return null;

  const [, name, args = ''] = match;
  return { name: name.toLowerCase(), args: args.trim() };
};

// Examples:
parseCommand('@lifeops suggest outdoor')
// → { name: 'suggest', args: 'outdoor' }

parseCommand('@lifeops memory beach sunset')
// → { name: 'memory', args: 'beach sunset' }

parseCommand('@lifeops analyze')
// → { name: 'analyze', args: '' }
```

### Step 3: Handle Commands

```typescript
const handleSelfDMMessage = Effect.gen(function* (message: Message) {
  const command = parseCommand(message.content);

  if (!command) {
    // Not a command, ignore
    return;
  }

  const response = yield* dispatchCommand(command, message.chatId);

  // Send response back to self-DM
  yield* sendToSelfDM(response);
});

const dispatchCommand = Effect.gen(function* (command: Command, chatId: string) {
  switch (command.name) {
    case 'suggest':
      return yield* handleSuggest(command.args, chatId);

    case 'analyze':
      return yield* handleAnalyze(chatId);

    case 'memory':
      return yield* handleMemorySearch(command.args);

    case 'draft':
      return yield* handleDraft(command.args, chatId);

    case 'help':
      return yield* handleHelp();

    default:
      return `Unknown command: ${command.name}\nTry: @lifeops help`;
  }
});
```

### Step 4: Command Handlers

```typescript
const handleSuggest = Effect.gen(function* (args: string, chatId: string) {
  const analysisService = yield* AnalysisServiceTag;

  // Parse category from args (e.g., "outdoor", "food", "relaxation")
  const category = args || 'any';

  // Generate suggestions based on past activities
  const suggestions = yield* generateActivitySuggestions(chatId, category);

  // Format for WhatsApp
  const formatted = formatSuggestions(suggestions);

  return formatted;
});

const handleAnalyze = Effect.gen(function* (chatId: string) => {
  const analysisService = yield* AnalysisServiceTag;

  // Get relationship analysis
  const analysis = yield* analysisService.analyze(chatId);

  // Format with emoji, sections
  return formatAnalysis(analysis);
});

const handleMemorySearch = Effect.gen(function* (query: string) => {
  const vectorStore = yield* VectorStoreService;

  if (!query) {
    return 'Please provide search query.\nExample: @lifeops memory beach sunset';
  }

  // Search memories
  const memories = yield* vectorStore.search(query, 5);

  if (memories.length === 0) {
    return `No memories found for: "${query}"`;
  }

  // Format results
  return formatMemories(memories);
});

const handleDraft = Effect.gen(function* (intent: string, chatId: string) => {
  const analysisService = yield* AnalysisServiceTag;

  if (!intent) {
    return 'Please describe what you want to say.\nExample: @lifeops draft apology for being late';
  }

  // Generate draft based on user's communication style
  const draft = yield* analysisService.draftResponse(chatId, intent);

  return `💬 Message Draft (based on your style):\n\n${draft}\n\n---\nFeel free to edit and send!`;
});

const handleDashboard = Effect.gen(function* (chatId: string) => {
  const db = yield* DatabaseService;

  // Get latest health snapshot
  const snapshot = yield* db.query(sql`
    SELECT * FROM health_snapshots
    WHERE chat_id = ${chatId}
    ORDER BY date DESC
    LIMIT 1
  `);

  if (!snapshot) {
    return 'No dashboard data yet. Run: @lifeops analyze';
  }

  // Format dashboard (Slack /stats style)
  return formatDashboard(snapshot);
});

const formatDashboard = (snapshot: HealthSnapshot) => {
  const { healthScore, connectionMetrics, alerts, wins } = snapshot;

  return `
━━━━━━━━━━━━━━━━━━━━━━━━
💖 Relationship Dashboard
Week of ${formatWeek(snapshot.date)}
━━━━━━━━━━━━━━━━━━━━━━━━

Overall Health: ${healthScore}/100 ${getHealthEmoji(healthScore)}
Trend: ${getTrendIcon(snapshot.trend)} ${snapshot.weekOverWeek > 0 ? '+' : ''}${snapshot.weekOverWeek} pts from last week

━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Key Metrics

${formatMetrics(snapshot)}

━━━━━━━━━━━━━━━━━━━━━━━━
${alerts.length > 0 ? `⚠️ Alerts (${alerts.length})\n\n${formatAlerts(alerts)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` : ''}
${wins.length > 0 ? `🎉 Wins This Week\n\n${formatWins(wins)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` : ''}

Full report: @lifeops analyze
Goal progress: @lifeops goals
Set reminders: @lifeops remind
  `.trim();
};

const handleHelp = Effect.succeed(`
🤖 LifeOps Commands

@lifeops suggest [category]
  Get activity suggestions
  Example: @lifeops suggest outdoor

@lifeops analyze
  Relationship health report

@lifeops memory <query>
  Search your memories
  Example: @lifeops memory beach 2025

@lifeops draft <intent>
  Draft a message
  Example: @lifeops draft apology forgot dinner

@lifeops dashboard
  View health metrics (Slack /stats style)
  Example: @lifeops dashboard

@lifeops help
  Show this message
`);
```

### Step 5: Send Response to Self-DM

```typescript
const sendToSelfDM = Effect.gen(function* (content: string) {
  const whatsapp = yield* WhatsAppServiceTag;

  // Send message to self-DM
  yield* whatsapp.sendMessage({
    to: SELF_CHAT_ID,
    content: content
  });
});
```

### Step 6: Extend WhatsApp Service to Support Sending

```typescript
// src/infrastructure/whatsapp/whatsapp.client.ts

export interface WhatsAppService {
  readonly syncMessages: (options: SyncOptions) => Effect.Effect<SyncResult, Error>;
  readonly healthCheck: () => Effect.Effect<HealthStatus, Error>;
  readonly sendMessage: (options: SendMessageOptions) => Effect.Effect<void, Error>; // NEW
}

interface SendMessageOptions {
  to: string; // JID (chat ID)
  content: string;
}

const sendMessage = (options: SendMessageOptions) =>
  Effect.tryPromise({
    try: async () => {
      // Use whatsmeow-cli to send message
      const args = [
        'send',
        '--to', options.to,
        '--message', options.content
      ];

      await execAsync(`${cliBinPath} ${args.join(' ')}`);
    },
    catch: (e) => new Error(`Failed to send message: ${e}`)
  });

export const WhatsAppServiceLive = Layer.sync(WhatsAppServiceTag, () => ({
  syncMessages,
  healthCheck,
  sendMessage // Add to implementation
}));
```

---

## 🎯 **Supported Commands** (Slack-Inspired)

### Design Philosophy: Slack Slash Commands

LifeOps commands follow **Slack's slash command UX patterns**:

✅ **Instant feedback**: Response appears immediately in same chat
✅ **Ephemeral responses**: Only you see the output (not Partner)
✅ **Rich formatting**: Emoji, sections, action buttons
✅ **Contextual help**: `/command help` shows usage
✅ **Auto-complete**: Fuzzy matching for typos
✅ **Inline actions**: Click buttons to execute follow-ups

**Example Slack commands**:
- `/remind me in 2 hours to call Sarah`
- `/poll "Where should we eat?" "Pizza" "Tacos" "Sushi"`
- `/giphy excited`

**LifeOps equivalent**:
- `@lifeops remind anniversary in 2 weeks`
- `@lifeops poll "Movie or dinner?" "Movie" "Dinner"`
- `@lifeops dashboard`

---

### Core Commands

| Command | Description | Example | Slack Equivalent |
|---------|-------------|---------|------------------|
| `@lifeops suggest [category]` | Activity suggestions | `@lifeops suggest outdoor` | `/giphy` (content generation) |
| `@lifeops analyze` | Relationship health report | `@lifeops analyze` | `/status` (system status) |
| `@lifeops memory <query>` | Search memories | `@lifeops memory beach sunset` | `/search` (search history) |
| `@lifeops draft <intent>` | Draft message | `@lifeops draft apology` | `/remind` (contextual help) |
| `@lifeops dashboard` ⭐ | View health dashboard | `@lifeops dashboard` | `/stats` (metrics overview) |
| `@lifeops help` | Show available commands | `@lifeops help` | `/help` (command list) |

### Future Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@lifeops plan <activity>` | Full activity plan | `@lifeops plan kayaking` |
| `@lifeops create memory` | Guided memory creation | `@lifeops create memory` |
| `@lifeops meme <name>` | Lookup inside joke | `@lifeops meme The Look` |
| `@lifeops remind <what> <when>` | Set reminder | `@lifeops remind anniversary in 2 weeks` |
| `@lifeops time-capsule` | Create time capsule | `@lifeops time-capsule` |

---

## 📱 **User Experience Flow**

### Daily Workflow

```
Morning:
User wakes up, opens WhatsApp

[Self-DM]
User: @lifeops analyze
LifeOps: [Sends overnight analysis - connection health, suggestions]

User reads, decides to plan weekend activity

User: @lifeops suggest
LifeOps: [3 personalized suggestions]

User picks one, forwards to Partner:
[Partner Chat]
User: "Hey! Want to try sunrise kayaking this weekend?"

Partner: "That sounds amazing! Let's do it 🏄"

---

Later that day:
Partner texts: "Stressful day 😩"

User opens self-DM:
User: @lifeops draft support partner work stress
LifeOps: [Sends drafted supportive message]

User copies, sends to Partner:
[Partner Chat]
User: "I know today was rough. Want to talk about it tonight? I'm here for you ❤️"

---

Weekend:
After kayaking adventure

User opens self-DM:
User: @lifeops create memory
LifeOps: "Great! Let's capture this. What did you do?"
User: "Sunrise kayaking at Marina del Rey"
LifeOps: "How was it? (Rate 1-5)"
User: "5 stars!"
LifeOps: "What made it special?"
User: "We both fell in the water but laughed the whole time"
LifeOps: "Perfect! Created 'Sunrise Kayaking Mishap - Jan 11, 2026' ⭐⭐⭐⭐⭐"
```

---

## 🔄 **Background Processing + On-Demand**

### Two Modes of Operation

**Mode 1: Passive Monitoring** (Always running)
```typescript
// Background service running 24/7
const backgroundMonitor = Effect.gen(function* () {
  // Sync messages every 5 minutes
  yield* Effect.repeat(
    syncMessages({ days: 1 }),
    Schedule.spaced('5 minutes')
  );

  // Check for self-DM commands
  yield* monitorMessages(); // Polls every 5 seconds
});
```

**Mode 2: Proactive Suggestions** (Optional)
```typescript
// Every 6 hours, check for triggers
cron.schedule('0 */6 * * *', async () => {
  const triggers = await detectProactiveTriggers();

  if (triggers.length > 0 && shouldNotify()) {
    // Send proactive suggestion to self-DM
    await sendToSelfDM(`
      🔔 Noticed something!

      ${triggers[0].message}

      Want to explore? Reply with:
      @lifeops ${triggers[0].suggestedCommand}
    `);
  }
});
```

### Example Proactive Notification
```
[Self-DM]
LifeOps (automatic):
🔔 Noticed something!

Partner mentioned "stressful week" 3 times this week.
You haven't sent support yet.

Want to draft a supportive message?
Reply: @lifeops draft support

[User can ignore or respond]
```

---

## 🎨 **Message Formatting for WhatsApp**

### Best Practices

```typescript
const formatSuggestions = (suggestions: Activity[]) => {
  // Use emoji, line breaks, clear sections
  let output = '💡 Activity Suggestions\n\n';

  suggestions.forEach((activity, idx) => {
    output += `${idx + 1}. ${activity.emoji} ${activity.name}\n`;
    output += `   Why: ${activity.reasoning}\n`;
    output += `   Where: ${activity.location}\n`;
    output += `   When: ${activity.timing}\n`;
    output += '\n';
  });

  output += 'Want full plan? Reply:\n';
  output += '@lifeops plan <number>';

  return output;
};

const formatAnalysis = (analysis: Analysis) => {
  return `
📊 Relationship Analysis

Connection Health: ${analysis.healthEmoji} ${analysis.healthLevel}

Recent Patterns:
${analysis.positivePatterns.map(p => `✅ ${p}`).join('\n')}

${analysis.concerns.length > 0 ?
  `⚠️ Watch:\n${analysis.concerns.map(c => `  - ${c}`).join('\n')}\n` : ''}

Suggestions:
${analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`.trim();
};
```

---

## ⚙️ **Configuration & Setup**

### First-Time Setup

```bash
# 1. Install dependencies
bun install

# 2. Configure WhatsApp
bun run cli health
# Scan QR code to authenticate

# 3. Get your self-DM chat ID
bun run cli get-self-chat-id
# Outputs: SELF_CHAT_ID=1234567890@s.whatsapp.net

# 4. Configure environment
echo "SELF_CHAT_ID=1234567890@s.whatsapp.net" >> .env

# 5. Start background service
bun run start
# Now LifeOps is monitoring your self-DM for commands
```

### Background Service (Systemd or PM2)

```bash
# Using PM2 (process manager)
pm2 start "bun run start" --name lifeops3
pm2 save
pm2 startup # Auto-start on boot

# Check logs
pm2 logs lifeops3
```

---

## 🔐 **Privacy & Security**

### What Gets Stored
```
✅ All messages from couple's chat (for analysis)
✅ Self-DM commands (for history)
✅ Generated memories, insights
✅ Activity suggestions history

❌ NOT stored on any cloud
❌ NOT shared with third parties
❌ Partner never sees self-DM content (unless you forward)
```

### Partner Privacy
```
Partner has no idea you're using AI unless you tell them:

What Partner sees:
"Hey! Want to try kayaking this weekend?"

What actually happened:
1. You typed: @lifeops suggest
2. AI analyzed 100+ past activities
3. Generated personalized suggestions
4. You picked one, forwarded to Partner
```

---

## 🚀 **Incremental Rollout**

### Phase 1: Core Commands (Week 1-2)
```
✅ @lifeops suggest
✅ @lifeops analyze
✅ @lifeops memory
✅ @lifeops help
```

### Phase 2: Advanced Commands (Week 3-4)
```
✅ @lifeops draft
✅ @lifeops plan
✅ @lifeops create memory
```

### Phase 3: Proactive Mode (Week 5+)
```
✅ Background trigger detection
✅ Proactive notifications to self-DM
✅ Learning from command usage patterns
```

---

## 🎯 **Success Criteria**

### User adopts self-DM pattern if:
- ✅ Faster than opening web UI
- ✅ Feels natural (like texting yourself reminders)
- ✅ Responses helpful and well-formatted
- ✅ Easy to forward to Partner when desired
- ✅ Command history useful to review

### Metrics to track:
- Commands per day
- Most-used commands
- Response satisfaction (implicit: user forwards to Partner)
- Time from command → action (measure engagement)

---

## 📝 **Summary**

**Self-DM as command interface solves**:
1. ✅ No separate app needed (WhatsApp native)
2. ✅ Private (Partner doesn't see)
3. ✅ Familiar UX (just message yourself)
4. ✅ Command history preserved
5. ✅ Easy to share (forward to Partner)

**Technical stack**:
- whatsmeow: Read + Send messages
- Self-DM monitoring: Poll every 5 seconds
- Command parser: `@lifeops <command>`
- Effect-TS: Command handlers
- Background service: Always running on laptop

**User experience**:
```
Think: "I need help with X"
  ↓
Open WhatsApp self-DM
  ↓
Type: @lifeops <command>
  ↓
Get response in seconds
  ↓
Forward to Partner if desired
```

---

**Next Steps**:
1. Implement `sendMessage` in WhatsAppService
2. Build command parser + dispatcher
3. Create self-DM monitoring loop
4. Implement 4 core commands (suggest, analyze, memory, help)
5. Test end-to-end flow

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
