# Version E: Story-Driven

> Consumer tone, relatable scenarios - shows real situations

---

# @lifeops/cli

> The relationship memory you wish you had.

[![Website](https://img.shields.io/badge/Website-lifeops.in-blue)](https://lifeops.in/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Three Weeks Ago

Your partner mentioned—casually, while scrolling through Instagram—that they'd love to visit Iceland someday. You nodded, said "that sounds amazing," and meant it.

Today, you're trying to plan a surprise for their birthday. You know they mentioned a travel destination recently, but was it Iceland? Portugal? That place with the hot springs?

The moment is gone. The detail is lost.

**LifeOps remembers.**

## What This Tool Does

LifeOps is a personal CLI that syncs your WhatsApp messages locally and helps you:

### Remember Context

```bash
bun run cli remember "She wants to visit Iceland"
```

Three months later:
```bash
bun run cli search "travel destination"
# → "She wants to visit Iceland" (saved Oct 15)
```

### Understand Ambiguous Messages

```bash
bun run cli decode "I guess we could do that"
```
```
Analysis: This phrasing suggests reluctance or disappointment.
The speaker may have preferred a different option.

Consider: "I sense some hesitation—what would you actually prefer?"
```

### Notice Patterns

When your friend has mentioned "work stress" five times in the past week, LifeOps can surface that. Not to be creepy—to help you check in.

### Draft Thoughtful Messages

When you want to reach out but aren't sure what to say:

```bash
bun run cli draft "check in with Amit about his job interview"
```
```
Suggested: "Hey Amit, been thinking about you. How did the interview go?
 No pressure to share details—just wanted you to know I'm rooting for you."

[Use as-is] [Edit] [Cancel]
```

You always decide what to send.

---

## Real Scenarios

### 🎂 The Birthday Gift

**Before LifeOps:** "What should I get her?" *Buys generic gift.*

**With LifeOps:**
```bash
bun run cli search "wants" --contact="Partner"
# → "wants to learn pottery" (Nov 2)
# → "wants that cookbook by Samin Nosrat" (Sep 15)
# → "wants to visit Iceland" (Oct 15)
```

*Books a pottery class. Nails it.*

### 📞 The Check-In

**Before:** Your dad mentioned something about a doctor's appointment. Was it this week? Last week? You meant to ask...

**With LifeOps:**
```bash
bun run cli search "doctor" --contact="Dad"
# → "colonoscopy scheduled for Tuesday" (5 days ago)
```

You call on Tuesday evening. He's touched you remembered.

### 💬 The Misread Message

**Before:** She texts "fine" and you take it at face value.

**With LifeOps:**
```bash
bun run cli decode "I'm fine"
# → Confidence: 85% - likely not fine
# → Context: Previous messages show she was excited about dinner plans
#   that were just cancelled
# → Suggestion: "I can tell something's off. Want to talk?"
```

---

## How It Works

1. **Sync** — Pull your WhatsApp messages to a local database
2. **Remember** — Save important context with natural language
3. **Search** — Find what you need when you need it
4. **Analyze** — Get AI insights on messages and patterns
5. **Draft** — Get help writing thoughtful responses

Everything stays on your machine. Always.

## Getting Started

```bash
git clone https://github.com/senguttuvang/LifeOps-CLI.git
cd lifeops-cli && bun install
bunx drizzle-kit push
cp .env.example .env  # Add API keys
./bin/whatsmeow-cli auth qr

# Start using
bun run cli sync
bun run cli remember "Mom wants the blue saree from Nalli's"
```

## Who It's For

Everyone who has people they care about:

- Partners navigating long-term relationships
- Adult children staying connected with parents
- Friends who want to show up better
- Anyone with a busy life and a good heart

## The Philosophy

This isn't about faking thoughtfulness. It's about making sure the care you feel actually translates into action.

You love your mom. But you forgot she has a check-up this week.

You care about your friend. But you haven't followed up on that thing they were stressed about.

**LifeOps bridges the gap between intention and action.**

## A Note on Privacy & Risks

- **Your data stays local** — SQLite on your machine, no cloud
- **Uses unofficial WhatsApp protocols** — technically against ToS (low ban risk for personal use, but be aware)
- **Designed for your own conversations** — don't use this to monitor others

## Learn More

- [FAQ](docs/faq.md) — Honest questions, honest answers
- [Tech Stack](docs/tech-stack.md) — How it's built
- [Roadmap](docs/roadmap.md) — What's coming

---

<p align="center">
  <a href="https://lifeops.in/">lifeops.in</a>
  <br><br>
  <em>For the moments that matter.</em>
</p>
