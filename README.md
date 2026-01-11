# @lifeops/cli

> A relationship memory assistant for developers.
> Because your RAM can't store "She mentioned Goa 3 weeks ago."

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## The Problem

Three weeks ago, your girlfriend mentioned—casually, while scrolling Instagram—that she'd love to visit Goa someday. You nodded, said "that sounds amazing," and meant it.

Today, you're planning a surprise for her birthday. You remember she mentioned a travel destination recently... but was it Goa? Manali? That place with the beach resorts?

The moment is gone. The detail is lost. And now you're panic-buying a Nykaa gift card.

**LifeOps remembers so you don't have to.**

---

## What It Does

LifeOps is a CLI tool that syncs your WhatsApp conversations locally and uses AI to help you be more thoughtful. Built for developers who can manage production systems but somehow can't remember her coffee order.

| Feature | What It Does |
|---------|-------------|
| **Message Sync** | Keeps a searchable archive of your conversations on your machine |
| **Context Memory** | Store important details: "She wants to visit Goa" → retrievable months later |
| **Message Decoder** | Understand what "I'm fine" actually means (spoiler: 3% chance it's fine) |
| **Pattern Insights** | Notice when she's mentioned work stress 5 times this week |
| **Draft Help** | AI suggestions when you want to text but aren't sure what to say |

---

## Real Scenarios

### 🎂 The Birthday Gift

**Without LifeOps:** "What should I get her?" → *Orders random Myntra kurta. Again.*

**With LifeOps:**
```bash
bun run cli search "wants" --contact="Girlfriend"
# → "wants that Zara bag she saw at Phoenix Mall" (Nov 2)
# → "wants to learn Kathak" (Sep 15)
# → "wants to visit Goa with college friends" (Oct 15)
```
*Books a Kathak class. Absolute legend.*

### 📞 The Family Check-In

**Without:** Mom mentioned something about a puja. Was it this week? You meant to call...

**With LifeOps:**
```bash
bun run cli search "puja" --contact="Mom"
# → "Satyanarayan puja on Thursday, be home by 6" (3 days ago)
```
You show up on time. She's genuinely impressed.

### 💬 The Decode

**Without:** She texts "I'm fine" and you reply "Cool!" This was a mistake.

**With LifeOps:**
```bash
bun run cli decode "I'm fine"

🔍 Analysis
───────────────────────────────
Confidence: 97% — NOT fine
Context: She was excited about dinner plans you just cancelled

⚠️ DO NOT: Say "okay then" and go back to gaming
✅ DO: "I can tell something's off. Want to talk about it?"
```

### 👀 The Family Group Survival Guide

Family WhatsApp groups require patience. LifeOps helps you remember context and respond thoughtfully.

**The Situation:**
```
Sharma Aunty: Beta, when are you getting married?
              Pinky's son is already settled!
```

**Your Context:**
```bash
bun run cli search "Sharma Aunty" --contact="Family Group"
# → Asked about marriage 4 times in 2 months
# → Last response: "focusing on career, Aunty" (Nov 15)
# → Uncle had knee surgery recently (good topic to redirect)
# → Aunty's grandson started 10th standard (she's proud of him)
```

**Thoughtful Responses:**
```bash
bun run cli draft "respectful redirect"

# Warm Deflection (recommended):
"Aunty, your blessings are always with me 🙏 Right now focusing
on a big project at work. How is uncle's recovery going?
Mom said he's walking better now!"

# Involve Parents (classic Indian move):
"Aunty, Mom and Dad are looking into it! Will definitely
share good news when the time comes. How is Rahul's
board exam preparation going?"

# Self-Deprecating Humour:
"Aunty, pehle salary double karni hai, tabhi rishte aayenge! 😅
Please keep me in your prayers. How is everyone at home?"

# Nuclear Option (use once per decade):
"Aunty, actually I've been thinking about becoming a sanyasi.
The Himalayas are calling. Worldly attachments and all that...
But don't worry, I'll visit during Diwali. 🙏"
```

*The goal isn't to "win"—it's to maintain warmth while buying yourself time. Aunties come from a place of care, even if the timing feels off. (The sanyasi line works exactly once—use wisely.)*

### 🎯 The "We Never Talk" Accusation

**The Situation:** She says "You never ask about my day anymore."

**Your Defense:**
```bash
bun run cli stats --contact="Girlfriend" --days=30
# → Initiated conversation: 47 times
# → Asked about her day: 12 times
# → Average response time: 8 minutes
# → Topics discussed: work (34%), family (28%), us (22%), random (16%)
```

*You have data. Use it wisely. (Or don't use it at all—some battles aren't worth winning.)*

---

## Who It's For

You're a developer. You manage servers, write clean code, debug production issues at 2 AM.

But you also:
- Forgot what she wanted for her birthday (she told you twice)
- Missed that she's been stressed about her promotion
- Can't remember if Mom's Satyanarayan puja is this Thursday or next
- Get ambushed by relatives in family WhatsApp groups

**LifeOps is `git log` for your relationships.**

---

## Privacy First

Your conversations are personal. They stay that way.

- **Everything on your machine** — Local SQLite database, no cloud sync
- **You control what's analyzed** — AI only sees what you explicitly ask
- **No tracking** — We don't collect usage data. We don't want it.

---

## Getting Started

### Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| **Node.js 18+** | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **Bun** | Fast JS runtime & package manager | `curl -fsSL https://bun.sh/install \| bash` |
| **Go 1.21+** | Build WhatsApp CLI bridge | See below |

**Install Go:**
- **macOS:** `brew install go`
- **Ubuntu/Debian:** `sudo apt install golang-go`
- **Windows:** `choco install golang` or [download](https://go.dev/dl/)

### Quick Setup

```bash
# 1. Clone and install
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install

# 2. Run the setup wizard (builds WhatsApp CLI, creates config)
bun run cli setup

# 3. Authenticate WhatsApp (run directly in terminal for QR code)
./bin/whatsmeow-cli auth

# 4. Sync messages
bun run cli sync --all

# 5. Configure your partner (for relationship analysis)
bun run cli contacts setup
```

### Manual Setup (Alternative)

If you prefer step-by-step control:

```bash
# 1. Clone and install dependencies
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install

# 2. Build the WhatsApp CLI bridge (requires Go)
cd tools/whatsmeow-cli
make install-local
cd ../..

# 3. Set up database
bunx drizzle-kit push
cp .env.example .env  # Add your API keys

# 4. Authenticate WhatsApp (run directly in terminal for QR code)
./bin/whatsmeow-cli auth
# Open WhatsApp → Settings → Linked Devices → Scan QR code

# 5. Sync messages
bun run cli sync --all

# 6. Configure contacts (mark your partner for relationship analysis)
bun run cli contacts setup

# 7. Verify setup
bun run cli health
```

### WhatsApp Authentication

**Run the auth command directly in your terminal** (not through `bun run cli sync`):

```bash
./bin/whatsmeow-cli auth
```

A QR code will appear:

![WhatsApp QR Authentication](docs/images/whatsapp-auth-qr.png)

**To authenticate:**
1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code in your terminal
4. Wait for "Authentication successful!" and history sync to complete

> **Note:** The auth command captures your message history during initial sync. This only happens once per session—subsequent syncs are incremental.

### WhatsApp Session Management

```bash
# Check auth status and history cache
./bin/whatsmeow-cli cache status

# Refresh history cache (requires re-auth on phone)
./bin/whatsmeow-cli cache refresh

# Clear cache and session (full re-authentication needed)
./bin/whatsmeow-cli cache clear
```

### Troubleshooting

Run the doctor command to diagnose issues:

```bash
bun run cli doctor
```

This checks all prerequisites and provides specific fix instructions.

### Start Using

```bash
bun run cli remember "She wants the blue Zara bag from Phoenix Mall"
bun run cli decode "Sure, whatever you want"
bun run cli relationship analyze "919876543210@s.whatsapp.net"
```

---

## CLI Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `doctor` | System diagnostics | `bun run cli doctor` |
| `health` | Quick system health check | `bun run cli health` |
| `sync` | Sync WhatsApp messages to local DB | `bun run cli sync --all` |
| `contacts setup` | Configure relationships (mark partner) | `bun run cli contacts setup` |
| `contacts list` | Show configured contacts | `bun run cli contacts list` |

### Sync Options

```bash
# Full sync with interactive contact selection
bun run cli sync

# Import all contacts without selection
bun run cli sync --all

# Use existing dump (skip WhatsApp API)
bun run cli sync --skip-dump --all

# Keep dump file after import
bun run cli sync --all --keep-dump
```

### Relationship Analysis (Requires API Key)

| Command | Description | Example |
|---------|-------------|---------|
| `relationship analyze <contact>` | AI analysis of relationship state | `bun run cli relationship analyze "Priya"` |
| `relationship draft <contact> <intent>` | Generate contextual message draft | `bun run cli relationship draft "Mom" "apologize for being distant"` |
| `relationship health` | Overview of relationship health | `bun run cli relationship health --list` |

> **Human Names Supported**: You can use contact names (e.g., "Priya", "Mom") instead of WhatsApp JIDs. The CLI automatically resolves names to their corresponding chat IDs.

### Memory & Decode (No API Key Needed)

| Command | Description | Example |
|---------|-------------|---------|
| `decode <message>` | Decode what "I'm fine" really means | `bun run cli decode "I'm fine"` |
| `remember <content>` | Store important context for later | `bun run cli remember "Priya wants the blue Zara bag"` |

### Signal Extraction (50+ Messages Required)

| Command | Description | Example |
|---------|-------------|---------|
| `extract-signals <userId>` | Extract behavioral patterns | `bun run cli extract-signals "919876543210@s.whatsapp.net"` |
| `extract-signals --refresh <userId>` | Force re-extraction | `bun run cli extract-signals --refresh "919876543210@s.whatsapp.net"` |

### Data Import

| Command | Description | Example |
|---------|-------------|---------|
| `import-android --db <path>` | Import from Android WhatsApp backup | `bun run cli import-android --db ./msgstore.db` |

### Chat IDs

Chat IDs use WhatsApp JID format:
- **Individual:** `<country><phone>@s.whatsapp.net` (e.g., `919876543210@s.whatsapp.net`)
- **Group:** `<id>@g.us` (e.g., `120363123456789012@g.us`)

Find chat IDs by checking your database after sync:
```bash
sqlite3 data/lifeops.db "SELECT title, external_id FROM conversations;"
```

---

## The Philosophy

This isn't about faking thoughtfulness. It's about making sure the care you feel actually shows up.

You love your girlfriend. But you forgot she has an interview this week.
You care about Mom. But you missed the puja timing she mentioned.

Using a calendar to remember her birthday isn't cheating—forgetting it is. LifeOps works the same way.

**We bridge the gap between intention and action.**

---

## Important Notes

**On WhatsApp:** This tool uses unofficial WhatsApp Web protocols. It's designed for personal use—analyzing your own conversations. While the risk is low for normal usage, please be aware this operates in a gray area with WhatsApp's terms.

**On ethics:** LifeOps is a memory aid, not a manipulation tool. If you're using this to fake care you don't feel, the relationship has bigger issues than software can solve.

---

## Learn More

| Resource | Description |
|----------|-------------|
| [FAQ](docs/guides/faq.md) | Common questions, honest answers |
| [Tech Stack](docs/architecture/tech-stack.md) | Bun, Effect-TS, Drizzle, LanceDB |
| [Architecture](docs/architecture/architecture.md) | System design deep-dive |
| [Roadmap](docs/architecture/roadmap.md) | What's coming next |

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a> ·
  <a href="docs/guides/faq.md">FAQ</a> ·
  <a href="docs/architecture/architecture.md">Docs</a>
</p>

<p align="center">
  <em>Built by developers who also forget birthdays.</em>
</p>
