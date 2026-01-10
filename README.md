# @lifeops/cli

> A relationship memory assistant. Because you care—you just forget.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## The Iceland Problem

Three weeks ago, your partner mentioned—casually, while scrolling Instagram—that they'd love to visit Iceland someday. You nodded, said "that sounds amazing," and meant it.

Today, you're planning a surprise for their birthday. You remember they mentioned a travel destination recently... but was it Iceland? Portugal? That place with the Northern Lights? (Wait, that's also Iceland.)

The moment is gone. The detail is lost. And now you're panic-buying a gift card.

**LifeOps remembers so you don't have to.**

---

## What It Does

LifeOps is a personal CLI that syncs your WhatsApp conversations locally and uses AI to help you be more thoughtful in your relationships.

| Feature | What It Does |
|---------|-------------|
| **Message Sync** | Keeps a searchable archive of your conversations on your machine |
| **Context Memory** | Store important details: "She wants to visit Iceland" → retrievable later |
| **Message Decoder** | Understand what "I'm fine" actually means (spoiler: usually not fine) |
| **Pattern Insights** | Notice when someone's mentioned stress five times this week |
| **Draft Help** | AI suggestions when you want to reach out but aren't sure what to say |

---

## Real Scenarios

### 🎂 The Birthday Gift

**Without LifeOps:** "What should I get her?" → *Buys scented candle. Again.*

**With LifeOps:**
```bash
bun run cli search "wants" --contact="Partner"
# → "wants to learn pottery" (Nov 2)
# → "wants that cookbook by Samin Nosrat" (Sep 15)
# → "wants to visit Iceland" (Oct 15)
```
*Books a pottery class. Absolute hero.*

### 📞 The Check-In

**Without:** Dad mentioned a doctor's appointment. Was it this week? Last week? You meant to call...

**With LifeOps:**
```bash
bun run cli search "doctor" --contact="Dad"
# → "colonoscopy scheduled for Tuesday" (5 days ago)
```
You call Tuesday evening. He's genuinely touched you remembered.

### 💬 The Decode

**Without:** She texts "I'm fine" and you reply "Great!" This was a mistake.

**With LifeOps:**
```bash
bun run cli decode "I'm fine"

🔍 Analysis
───────────────────────────────
Confidence: 85% — likely not fine
Context: Previous messages show excitement about dinner plans
         that were just cancelled

Suggestion: "I can tell something's off. Want to talk about it?"
```

---

## Who It's For

LifeOps works for **any relationship** you want to nurture:

- **Partners & Spouses** — Remember the little things that add up over years
- **Parents & Family** — Stay connected even when life gets hectic
- **Close Friends** — Be the friend who actually follows up
- **Colleagues** — Maintain professional relationships thoughtfully

If you care about someone, LifeOps helps you show it.

---

## Privacy First

Your conversations are personal. They stay that way.

- **Everything on your machine** — Local SQLite database, no cloud sync
- **You control what's analyzed** — AI only sees what you explicitly ask
- **No tracking** — We don't collect usage data. We don't want it.

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install

# Set up database
bunx drizzle-kit push
cp .env.example .env  # Add your API keys

# Connect WhatsApp
./bin/whatsmeow-cli auth qr

# Start using
bun run cli sync
bun run cli remember "Mom wants the blue saree from Nalli's"
bun run cli decode "Sure, whatever you want"
```

---

## The Philosophy

This isn't about faking thoughtfulness. It's about making sure the care you feel actually shows up.

You love your mom. But you forgot she has a check-up this week.
You care about your friend. But you haven't asked about that thing they were stressed about.

Using a calendar to remember your anniversary isn't cheating—forgetting it is. LifeOps works the same way.

**We bridge the gap between intention and action.**

---

## Important Notes

**On WhatsApp:** This tool uses unofficial WhatsApp Web protocols. It's designed for personal use—analyzing your own conversations. While the risk is low, please be aware this operates in a gray area with WhatsApp's terms.

**On ethics:** LifeOps is a memory aid, not a manipulation tool. If you're using this to fake care you don't feel, the relationship has bigger issues than software can solve.

---

## Learn More

| Resource | Description |
|----------|-------------|
| [FAQ](docs/faq.md) | Common questions, honest answers |
| [Tech Stack](docs/tech-stack.md) | How it's built (for the curious) |
| [Architecture](docs/architecture/architecture.md) | System design deep-dive |
| [Roadmap](docs/architecture/roadmap.md) | What's coming next |

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a> ·
  <a href="docs/faq.md">FAQ</a> ·
  <a href="docs/architecture/architecture.md">Docs</a>
</p>

<p align="center">
  <em>Built by people who also forget birthdays.</em>
</p>
