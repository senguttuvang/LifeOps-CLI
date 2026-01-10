# LifeOps CLI Roadmap

> **From "I forgot" to "I remembered" - The journey**

Last Updated: 2026-01-10
Current Phase: **Phase 1 In Progress**

---

## Vision

**LifeOps CLI** is a relationship intelligence platform that operationalizes peer-reviewed relationship psychology into actionable, real-time insights. We're not building another reminder app—we're building a **relationship intelligence platform** powered by decades of scientific research.

### The North Star
> "Make thoughtfulness effortless, so you can focus on being present."

### Competitive Moat
1. **Science-backed**: Gottman's research, attachment theory, NVC - no other app does this
2. **Local-first**: Privacy is a feature, not a compromise
3. **Signal extraction**: 25-dimension behavioral analysis per contact
4. **WhatsApp native**: Dominant messaging platform integration

---

## Phase Overview

```
Phase 0: Foundation        ████████████████████  100% ✅
Phase 1: Self-DM Interface ████████░░░░░░░░░░░░   40% 🚧
Phase 2: Gottman Features  ░░░░░░░░░░░░░░░░░░░░    0% 📋
Phase 3: Intelligence      ░░░░░░░░░░░░░░░░░░░░    0% 📋
Phase 4: Safety            ░░░░░░░░░░░░░░░░░░░░    0% 📋
Phase 5: Multi-Channel     ░░░░░░░░░░░░░░░░░░░░    0% 📋
Phase 6: Web & Mobile      ░░░░░░░░░░░░░░░░░░░░    0% 📋
```

---

## Phase 0: Foundation ✅ COMPLETE

**Goal**: Core infrastructure for local-first relationship CRM

### Completed
- [x] Effect-TS architecture implementation
- [x] Domain-driven database schema (v2)
- [x] WhatsApp sync via whatsmeow-cli
- [x] Anti-corruption layer pattern
- [x] Signal extraction system (25 dimensions)
- [x] Event extraction (text + vision)
- [x] Fun commands (decode, remember, relationship)
- [x] Health check system
- [x] Test infrastructure
- [x] Android message import

### Key Capabilities
- WhatsApp message sync and storage
- Contact and conversation tracking
- Message analysis and indexing
- RAG-ready vector embeddings

---

## Phase 1: Self-DM Interface 🚧 IN PROGRESS

**Goal**: Control LifeOps via WhatsApp messages to yourself

**Why This Matters**: Users shouldn't need to open a terminal. WhatsApp is already open.

### Implemented
- [x] Self-DM message detection
- [x] Auto-draft monitoring service
- [x] Signal extraction command

### In Progress
- [ ] `@lifeops suggest dinner` - Get date suggestions
- [ ] `@lifeops remember [text]` - Store a memory
- [ ] `@lifeops remind [contact] [event]` - Set reminder
- [ ] `@lifeops draft [contact] [topic]` - Generate response draft
- [ ] `@lifeops analyze [contact]` - Quick relationship insights

### Technical Requirements
- Command parser refinement
- Response delivery via WhatsApp
- Rate limiting (don't spam yourself)

---

## Phase 2: Gottman Features 📋 PLANNED

**Goal**: Operationalize Gottman's research into real-time features

### 2.1 Four Horsemen Detector
- [ ] Criticism pattern detection
- [ ] Contempt indicators (emoji, tone)
- [ ] Defensiveness tracking
- [ ] Stonewalling alerts (silence detection)
- [ ] Antidote suggestions
- [ ] Weekly horsemen report

### 2.2 Magic Ratio Tracker (5:1)
- [ ] Interaction valence classification
- [ ] Rolling ratio calculation
- [ ] Visual dashboard
- [ ] Alerts when ratio drops
- [ ] Positive interaction prompts

### 2.3 Bid Response Tracker
- [ ] Bid detection (questions, shares, attention requests)
- [ ] Response classification (toward/away/against)
- [ ] Turn-toward rate calculation
- [ ] Missed bid alerts
- [ ] Weekly bid report

### Success Criteria
- Horsemen detection accuracy > 80%
- User awareness of ratio > 90%
- Turn-toward improvement > 10% after 30 days

---

## Phase 3: Intelligence Layer 📋 PLANNED

**Goal**: Deep relationship insights powered by attachment theory

### 3.1 Love Language Detector
- [ ] Pattern analysis (asks, thanks, complaints)
- [ ] Language profile per contact
- [ ] Mismatch detection
- [ ] Translation suggestions
- [ ] Gift/action recommendations

### 3.2 A.R.E. Score
- [ ] Accessibility metrics
- [ ] Responsiveness tracking
- [ ] Engagement measurement
- [ ] Combined score dashboard
- [ ] Improvement recommendations

### 3.3 Attachment Style Detector
- [ ] Anxious indicators
- [ ] Avoidant indicators
- [ ] Secure baseline
- [ ] Anxious-avoidant trap warning
- [ ] Style-aware communication tips

### 3.4 NVC Translator
- [ ] Accusatory message detection
- [ ] NVC transformation
- [ ] Before/after preview
- [ ] Success probability score
- [ ] Learning feedback loop

---

## Phase 4: Safety Features 📋 PLANNED

**Goal**: Safety as first-class feature

### 4.1 Travel Safety
- [ ] Location share detection
- [ ] Expected arrival tracking
- [ ] "No message" alerts
- [ ] Trusted contact notification
- [ ] Route deviation detection

### 4.2 SOS Detection
- [ ] Distress keyword parsing
- [ ] Unusual pattern alerts
- [ ] One-tap emergency share
- [ ] Trusted circle configuration

### 4.3 Late Night Check-ins
- [ ] Travel context awareness
- [ ] Auto check-in prompts
- [ ] Escalation ladder
- [ ] Family notification (opt-in)

### Safety Principles
- Opt-in only (no surveillance by default)
- User-controlled (user decides who gets alerts)
- Local processing (no cloud location tracking)
- False positive tolerance (rather safe than sorry)

---

## Phase 5: Multi-Channel 📋 PLANNED

**Goal**: Beyond WhatsApp - unified relationship view

### 5.1 Email Integration
- [ ] Email sync adapter
- [ ] Anti-corruption layer
- [ ] Unified conversation view
- [ ] Cross-channel correlation

### 5.2 Calendar Integration
- [ ] Important date extraction
- [ ] Meeting context
- [ ] Shared calendar awareness
- [ ] Anniversary auto-detect

### 5.3 SMS/iMessage
- [ ] Message import
- [ ] Unified timeline
- [ ] Cross-platform signals

### Architecture Benefit
Anti-corruption layer (Phase 0) means adding channels requires ONLY new adapters, no schema changes.

---

## Phase 6: Web & Mobile 📋 FUTURE

**Goal**: Beyond CLI - accessible to non-technical users

### 6.1 Web Dashboard
- [ ] Relationship health overview
- [ ] Memory management
- [ ] Settings configuration
- [ ] Privacy controls

### 6.2 Mobile App
- [ ] iOS app (primary)
- [ ] Android app
- [ ] Push notifications
- [ ] Quick capture

### 6.3 Browser Extension
- [ ] WhatsApp Web integration
- [ ] Real-time insights overlay
- [ ] Draft suggestions

---

## Success Metrics

### User Outcomes
| Metric | Target | Measurement |
|--------|--------|-------------|
| Anniversary remembered | 100% | Zero missed with LifeOps active |
| Gift satisfaction | +50% | Post-gift survey |
| Conflict reduction | -20% | Horsemen frequency |
| Relationship satisfaction | +15% | Self-reported score |

### Technical Metrics
| Metric | Target |
|--------|--------|
| Sync reliability | 99.9% |
| Analysis accuracy | 85% |
| Response time | <2s |
| Test coverage | 80% |

---

## Risk Factors

### Technical Risks
| Risk | Mitigation |
|------|------------|
| WhatsApp API changes | Anti-corruption layer isolates impact |
| LLM cost scaling | Local models for common classifications |
| Data loss | SQLite backup, export features |

### Product Risks
| Risk | Mitigation |
|------|------------|
| Perceived as "creepy" | Clear privacy messaging, local-first |
| Over-reliance on AI | Human-in-the-loop for all actions |
| Relationship damage | Never auto-send, always draft mode |

---

## Contributing

### How to Propose Features
1. Create issue with `[FEATURE]` prefix
2. Include: Source (book/research), Effort estimate, Impact hypothesis

### How to Pick Up Work
1. Check current phase in this roadmap
2. Look for unassigned items
3. Create branch: `feature/phase-X-feature-name`
4. Follow ADR process for architectural decisions

---

**Maintained by**: LifeOps Team
**Last Roadmap Review**: 2026-01-10
