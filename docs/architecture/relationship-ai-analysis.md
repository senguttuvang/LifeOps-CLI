# Relationship AI Analysis Architecture

**Created**: 2026-01-11
**Status**: Research & Design
**Context**: Behavioral signal extraction from WhatsApp messages for romantic relationship analysis

---

## Overview

This document outlines the architectural considerations for AI-powered relationship analysis, focusing on:
1. Optimal chunking strategies for preserving behavioral signals
2. Architectural factors beyond embeddings
3. Commercial system approaches
4. Data capture strategies for real-world engagement

---

## Multi-Level Chunking Strategy

### The Problem with Single-Level Chunking

Message-level chunking (current approach) loses critical relationship context:
- A single message doesn't capture dyadic patterns
- Time-based gaps (4-hour) miss semantic topic boundaries
- Embeddings of isolated messages lack conversational context

### Recommended Multi-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING HIERARCHY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  L5: SESSION                                                    │
│  ├── Time gap + topic shift combined                            │
│  ├── Preserves: Daily/weekly patterns                           │
│  └── Use for: Temporal rhythms, consistency analysis            │
│       │                                                         │
│       ▼                                                         │
│  L4: TOPIC SEGMENT                                              │
│  ├── Semantic boundary (cosine similarity drop)                 │
│  ├── Preserves: Full topic discussion                           │
│  └── Use for: Conflict resolution, emotional arcs              │
│       │                                                         │
│       ▼                                                         │
│  L3: EXCHANGE                                                   │
│  ├── 3-5 message back-and-forth                                 │
│  ├── Preserves: Micro-conversation flow                         │
│  └── Use for: Topic initiation, resolution patterns            │
│       │                                                         │
│       ▼                                                         │
│  L2: TURN PAIR                                                  │
│  ├── Your message + their response                              │
│  ├── Preserves: Response dynamics                               │
│  └── Use for: Response time, initiation patterns               │
│       │                                                         │
│       ▼                                                         │
│  L1: UTTERANCE                                                  │
│  ├── Single message                                             │
│  ├── Preserves: Individual expression style                     │
│  └── Use for: Emoji patterns, length distribution              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Level Definitions

| Level | Unit | Window | Behavioral Signals Preserved |
|-------|------|--------|------------------------------|
| **L1: Utterance** | Single message | 1 msg | Emoji usage, punctuation, message length, word choice |
| **L2: Turn Pair** | Your msg + response | 2 msgs | Response latency, length matching, sentiment matching |
| **L3: Exchange** | Back-and-forth | 3-5 msgs | Topic flow, question-answer patterns, engagement depth |
| **L4: Topic Segment** | Semantic unit | Variable | Conflict patterns, emotional trajectory, resolution style |
| **L5: Session** | Time-bounded | Hours/day | Daily rhythms, weekend vs weekday, consistency |

### Semantic Boundary Detection

Based on 2025 research on semantic chunking for RAG systems:

```typescript
interface SemanticChunker {
  // Step 1: Create embeddings for each message
  embedMessages(messages: Message[]): Promise<EmbeddedMessage[]>;

  // Step 2: Calculate cosine similarity between consecutive messages
  calculateSimilarities(embedded: EmbeddedMessage[]): number[];

  // Step 3: Detect boundaries where similarity drops
  detectBoundaries(similarities: number[], threshold: number): number[];

  // Step 4: Merge semantically related messages into chunks
  createChunks(messages: Message[], boundaries: number[]): TopicSegment[];
}

// Dynamic thresholding for relationship context
const thresholds = {
  conflict: 0.3,    // Lower threshold during conflict (catch topic shifts)
  casual: 0.7,      // Higher threshold for casual chat (group chitchat)
  emotional: 0.5,   // Medium threshold for emotional discussions
};
```

### Implementation Approach

```typescript
// Multi-level chunk storage
interface ChunkHierarchy {
  utterances: Utterance[];           // L1: Individual messages
  turnPairs: TurnPair[];             // L2: Message-response pairs
  exchanges: Exchange[];              // L3: Back-and-forth sequences
  topicSegments: TopicSegment[];      // L4: Semantic units
  sessions: Session[];                // L5: Time-bounded conversations
}

// Each level references its parent
interface TopicSegment {
  id: string;
  sessionId: string;                  // Parent session
  exchanges: Exchange[];              // Child exchanges
  startTime: Date;
  endTime: Date;
  dominantSentiment: number;
  topicEmbedding: number[];           // Aggregated embedding
  conflictScore: number;              // 0-1, detected conflict intensity
  resolutionStatus: 'resolved' | 'unresolved' | 'ongoing' | null;
}
```

---

## Architectural Factors Beyond Embeddings

### 1. Temporal Graph Structure

Beyond flat embeddings, relationship analysis benefits from graph-based representation:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RELATIONSHIP TEMPORAL GRAPH                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NODE TYPES:                                                    │
│  ├── message_event     - Individual messages with embeddings    │
│  ├── realworld_event   - Dates, conflicts, milestones          │
│  ├── external_event    - Travel, work stress, holidays         │
│  └── relationship_state - Periodic snapshots of health         │
│                                                                 │
│  EDGE TYPES:                                                    │
│  ├── temporal_follows  - Time sequence (message order)         │
│  ├── responds_to       - Reply relationships                   │
│  ├── references        - Mentions past event                   │
│  ├── co_occurs_with    - Real-world context linkage           │
│  └── causes            - Causal relationship (conflict → mood) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Dyadic Signal Extraction

Relationship analysis requires **pair patterns**, not just individual signals:

| Signal Category | Individual Signal | Dyadic Signal |
|-----------------|-------------------|---------------|
| **Response Time** | Your avg response time | Response time ratio (you/them) |
| **Message Length** | Your avg message length | Length matching coefficient |
| **Initiation** | Your initiation rate | Initiation balance (who starts more) |
| **Emotional Valence** | Your sentiment distribution | Sentiment contagion (do they match?) |
| **Topic Control** | Topics you introduce | Topic adoption rate (do they engage?) |
| **Question Asking** | Your question frequency | Question reciprocity |
| **Emoji Usage** | Your emoji frequency | Emoji mirroring |

```typescript
interface DyadicSignals {
  // Balance metrics (0 = you dominate, 1 = balanced, 2 = they dominate)
  initiationBalance: number;
  responseTimeRatio: number;
  messageLengthRatio: number;
  questionReciprocity: number;

  // Matching metrics (0 = no match, 1 = perfect match)
  sentimentContagion: number;      // Do they mirror your emotions?
  emojiMirroring: number;          // Do they use similar emojis?
  topicAdoption: number;           // Do they engage with your topics?
  responseStyleMatching: number;    // Similar punctuation, caps, etc.

  // Trend metrics
  balanceTrend: 'improving' | 'stable' | 'declining';
  matchingTrend: 'increasing' | 'stable' | 'decreasing';
}
```

### 3. Attachment Style Inference

Research shows distinct digital communication patterns by attachment style:

| Attachment Style | Digital Signature | Detection Signals |
|------------------|-------------------|-------------------|
| **Anxious** | High volume, frequent checking | High message count, short gaps, emotional expressions, double-texting |
| **Avoidant** | Short responses, delays | Low word count, prefers async, delays on emotional topics |
| **Secure** | Consistent, balanced | Stable patterns, comfortable silence, balanced initiation |
| **Disorganized** | Unpredictable | High variance in all metrics, inconsistent timing |

```typescript
interface AttachmentStyleSignals {
  // Anxious indicators
  messageFrequency: number;           // Messages per day
  doublTextingRate: number;           // Follow-up messages before response
  emotionalExpressionIntensity: number;
  responseAnxiety: number;            // Speed of checking for responses

  // Avoidant indicators
  averageResponseDelay: number;
  emotionalTopicAvoidance: number;    // Sentiment drops on emotional topics
  messageBrevity: number;             // Avg words per message
  asyncPreference: number;            // Gaps between message bursts

  // Computed attachment probability
  attachmentProfile: {
    anxious: number;      // 0-1 probability
    avoidant: number;
    secure: number;
    disorganized: number;
  };
}
```

### 4. Conflict Detection Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFLICT DETECTION PIPELINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STAGE 1: TOPIC SHIFT DETECTION                                 │
│  ├── Semantic boundary detection (embedding similarity drop)    │
│  └── Abrupt topic changes often signal conflict onset          │
│                                                                 │
│  STAGE 2: SENTIMENT TRAJECTORY                                  │
│  ├── Track sentiment over message sequence                      │
│  ├── Detect: positive → negative transitions                   │
│  └── Flag rapid sentiment drops (> 0.5 in 3 messages)          │
│                                                                 │
│  STAGE 3: LINGUISTIC MARKERS                                    │
│  ├── Accusatory: "you always", "you never"                     │
│  ├── Defensive: "I didn't mean", "that's not what I said"      │
│  ├── Contempt: sarcasm, eye-roll emoji, dismissive language    │
│  ├── Stonewalling: short replies, long delays, monosyllables   │
│  └── Criticism: "you're so...", generalizations                │
│                                                                 │
│  STAGE 4: RESOLUTION DETECTION                                  │
│  ├── Apology patterns: "I'm sorry", "my bad"                   │
│  ├── Repair attempts: humor, affection, topic change           │
│  ├── Topic return: conversation returns to baseline topics     │
│  └── Sentiment recovery: sustained positive sentiment          │
│                                                                 │
│  OUTPUT: ConflictEvent                                          │
│  ├── startTime, endTime                                        │
│  ├── intensity (0-1)                                           │
│  ├── trigger (topic/external event if identifiable)            │
│  ├── resolutionStatus                                          │
│  └── resolutionTime (if resolved)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Gottman's Four Horsemen Detection

Based on relationship research, detect destructive patterns:

| Horseman | Detection Signals | Example Patterns |
|----------|-------------------|------------------|
| **Criticism** | Generalizations, "you always/never" | "You never listen to me" |
| **Contempt** | Sarcasm, mockery, eye-roll emoji | "Oh, sure, like YOU would know" |
| **Defensiveness** | Blame-shifting, excuses | "It's not my fault, you made me" |
| **Stonewalling** | Withdrawal, short responses | "Fine." "Whatever." [long delay] |

---

## Commercial System Approaches

### Relationship-Focused Apps

| App | Architecture | Data Sources | Key Features |
|-----|--------------|--------------|--------------|
| **Maia** (YC) | Private chat + AI coaching | In-app messaging, activities | Real-time guidance, proactive insights |
| **Couples Analytics** | Real-time health tracking | Communication patterns | 25% dispute duration reduction, smart alerts |
| **Relish** | Quizzes + AI analysis | Self-reported + communication | Personalized guidance |
| **MosaicChats** | Chat import + analysis | WhatsApp/iMessage export | Attachment style detection, 76% accuracy |
| **Crushh** | Screenshot analysis | Exported chat images | Texting pattern analysis |
| **Lasting** | Self-guided therapy | In-app exercises | CBT-based modules |

### Health System Approaches

| Technique | Implementation | Behavioral Value |
|-----------|----------------|------------------|
| **Multimodal Integration** | Physiological + behavioral + self-reported | Holistic health picture |
| **NLP Sentiment Detection** | Real-time emotional state from text | Mood tracking, intervention triggers |
| **Bidirectional Messaging** | Patient-clinician async chat | Continuous engagement |
| **Behavioral Pattern Prediction** | ML on communication patterns | Adherence prediction, early warning |
| **Conversational Agents** | AI chatbots with CBT training | 24/7 support, skill building |

### Key Research Findings

- **Stanford 2025**: 35% of couples seeking help now use AI-assisted therapy
- **Journal of Couple Therapy**: 28% reduction in recurring arguments with AI tools
- **ML Emotion Recognition**: 90% accuracy in detecting emotions from therapy speech
- **Iris Dating**: 40x improvement in matchmaking with behavioral analysis

---

## Data Capture Strategies

### The Problem: Digital Messages Miss Real-World Context

WhatsApp captures only digital interactions. Real-world engagement (dates, conversations, conflicts) creates context that's invisible to message-only analysis.

### Multi-Modal Capture Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA CAPTURE TIMELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMMEDIATE (Within 1 hour of real-world event):                 │
│  ├── Voice memo reflection (2-3 minutes)                        │
│  │   → "How did that conversation feel?"                        │
│  │   → "What was the highlight/lowlight?"                       │
│  │   → Captures emotional nuance text misses                    │
│  └── Quick sentiment capture                                    │
│      → Emoji slider or 1-10 rating                              │
│      → Tags: date, conflict, milestone, casual                  │
│                                                                 │
│  SAME-DAY (Evening reflection):                                 │
│  ├── Structured prompts:                                        │
│  │   → "Did you feel heard today?"                              │
│  │   → "What topic did you avoid?"                              │
│  │   → "Rate connection (1-10)"                                 │
│  │   → "Any unresolved tension?"                                │
│  └── Link to digital messages from that day                     │
│      → Correlate digital + real-world sentiment                 │
│                                                                 │
│  WEEKLY (Relationship health check):                            │
│  ├── Weekly health score (1-10)                                 │
│  ├── Notable events tagging                                     │
│  ├── AI-generated weekly summary review                         │
│  └── Trend visualization                                        │
│                                                                 │
│  MONTHLY (Deep reflection):                                     │
│  ├── Relationship trajectory assessment                         │
│  ├── Goal setting and review                                    │
│  └── Pattern identification with AI assistance                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Voice-First Journaling (Recommended)

Voice capture preserves nuance that text journaling loses:

```typescript
interface VoiceMemoCapture {
  // Input
  audioFile: Buffer;
  recordedAt: Date;
  context: 'post-date' | 'post-conflict' | 'reflection' | 'milestone';

  // Processing
  transcription: string;           // Whisper/local transcription
  sentimentFromVoice: number;      // Tone analysis (not just words)
  emotionalIntensity: number;      // Volume, pace, pauses

  // AI extraction
  keyInsights: string[];           // LLM-extracted themes
  mentionedEvents: string[];       // Referenced real-world events
  unresolvedTopics: string[];      // Things left unsaid

  // Linkage
  linkedMessages: MessageId[];     // Messages from same day
  linkedEvents: EventId[];         // Tagged real-world events
}
```

### Data Type Matrix

| Data Type | Capture Method | Behavioral Value | Privacy Level |
|-----------|----------------|------------------|---------------|
| **Digital messages** | WhatsApp export | Communication patterns, response dynamics | High (shared) |
| **Voice memos** | Post-event recording | Emotional nuance, reflection depth | Very High (private) |
| **Structured check-ins** | Daily/weekly prompts | Longitudinal trends, ground truth | High |
| **Event tags** | Manual tagging | Context for message patterns | Medium |
| **Sentiment ratings** | Quick sliders | Training data, correlation | Medium |
| **Photos/media** | Optional upload | Memory anchoring, milestone tracking | Very High |

### Real-World Event Schema

```typescript
interface RealWorldEvent {
  id: string;
  type: 'date' | 'conflict' | 'milestone' | 'travel' | 'family' | 'other';
  occurredAt: Date;
  duration: number;              // Minutes

  // Capture methods
  voiceMemo?: VoiceMemoCapture;
  structuredInput?: {
    connectionRating: number;    // 1-10
    feltHeard: boolean;
    avoidedTopics: string[];
    highlights: string[];
    tensions: string[];
  };

  // AI correlation
  linkedMessageWindow: {
    before: MessageId[];         // 24h before event
    after: MessageId[];          // 24h after event
  };

  // Analysis
  digitalVsRealworldSentiment: {
    digital: number;             // Avg sentiment in linked messages
    realworld: number;           // Self-reported sentiment
    delta: number;               // Discrepancy (facade detection)
  };
}
```

---

## Implementation Roadmap

### Phase 1: Multi-Level Chunking (Current Sprint)

- [ ] Implement L1-L2 chunking (utterance, turn pair)
- [ ] Add semantic boundary detection for L4 (topic segments)
- [ ] Store chunk hierarchy in database
- [ ] Embeddings at multiple levels

### Phase 2: Dyadic Signals

- [ ] Extract pair patterns (balance, matching metrics)
- [ ] Attachment style inference
- [ ] Trend tracking over time

### Phase 3: Conflict Detection

- [ ] Implement Gottman's Four Horsemen detection
- [ ] Conflict lifecycle tracking (onset → resolution)
- [ ] Resolution pattern analysis

### Phase 4: Voice Integration

- [ ] Voice memo capture CLI command
- [ ] Whisper transcription integration
- [ ] Voice sentiment analysis (optional: tone analysis)

### Phase 5: Real-World Event Correlation

- [ ] Event tagging interface
- [ ] Digital ↔ real-world sentiment correlation
- [ ] Facade detection (digital positivity vs real tension)

---

## References

### Research
- Stanford Relationship Research Lab (2025) - AI-assisted therapy adoption
- Journal of Couple and Relationship Therapy - AI conflict resolution effectiveness
- Gottman Institute - Four Horsemen framework

### Commercial Systems
- [MosaicChats](https://www.mosaicchats.com/) - Chat analysis platform
- [Maia](https://www.ourmaia.com/) - YC-backed relationship app
- [AudioDiary.ai](https://audiodiary.ai/) - Voice journaling with AI

### Technical
- [Analytics Vidhya - RAG Chunking Strategies 2025](https://www.analyticsvidhya.com/blog/2025/02/types-of-chunking-for-rag-systems/)
- [NAACL 2025 - Dialogue Topic Segmentation](https://aclanthology.org/2025.naacl-long.252.pdf)
- [Springer - Max-Min Semantic Chunking](https://link.springer.com/article/10.1007/s10791-025-09638-7)
