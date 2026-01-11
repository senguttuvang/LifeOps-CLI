# Implementation Plan: RAG + Signals (Enterprise Grade)

> **Goal**: Implement 75-80% personalization using enterprise RAG standards with behavioral signal extraction

**Timeline**: 2-3 weeks
**Current**: Basic RAG (60-70%)
**Target**: RAG + Signals (75-80%)
**Status**: Ready to Start
**Last Updated**: 2026-01-11

> **Related Documentation**:
> - [AI Data Pipeline Architecture](../architecture/ai-data-pipeline.md) - Sync integration & incremental processing
> - [WhatsApp Sync Architecture](../architecture/whatsapp-sync.md) - Upstream data flow

---

## 📡 Sync Integration (Upstream Dependency)

The RAG + Signals pipeline is **downstream** of WhatsApp sync. Understanding this integration is critical for incremental processing.

### Data Flow Overview

```
WhatsApp ──► Sync Service ──► SQLite ──► AI Pipeline ──► LanceDB/Signals
                │                              │
                └── Sets isIndexed=FALSE ──────┴── Sets isIndexed=TRUE
```

### Incremental Processing Keys

| Layer | Watermark | Purpose |
|-------|-----------|---------|
| **Sync** | `syncState.lastSyncAt` | Track last WhatsApp fetch |
| **Vectors** | `communication_events.isIndexed` | Track embedding status |
| **Signals** | `behavior_signals.validUntil` | Track signal freshness |

### Avoiding Duplicate Processing

1. **Sync Layer**: `ON CONFLICT (channelId, externalId) DO NOTHING`
2. **Vector Layer**: Check `isIndexed = FALSE` before embedding
3. **Signal Layer**: Check `validUntil > NOW()` before recomputing

For full details, see [AI Data Pipeline Architecture](../architecture/ai-data-pipeline.md).

---

## 🎯 What We're Building

### Current System (Basic RAG)
```
Girlfriend: "I had the worst day 😩"

Draft: "Oh no, that sounds tough jaan! What happened? I'm here if you need to talk ❤️"

Matches:
✅ Vocabulary ("sucks", "jaan")
✅ Casual tone
✅ Generic pattern

Misses:
❌ Consistent style (sometimes 1 emoji, sometimes 3)
❌ Message length precision (varies 30-100 chars)
❌ Common phrase enforcement ("want to talk" vs "wanna chat")
```

### Target System (RAG + Signals)
```
Girlfriend: "I had the worst day 😩"

Draft: "Oh no, that sounds tough jaan! What happened? Want to talk? ❤️"

Matches:
✅ Vocabulary ("sucks", "jaan")
✅ Casual tone
✅ Exactly 1 emoji (enforced)
✅ ~45 characters (enforced to match avg)
✅ Common phrase ("Want to talk?" - user's exact pattern)
✅ Question ending (user always asks follow-up)
```

**Improvement**: From 60-70% → 75-80% personalization

---

## 📊 Enterprise RAG Architecture

### Standard Enterprise RAG Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    INGESTION LAYER                       │
│  - Document parsing                                      │
│  - Chunking strategy (fixed vs semantic)                 │
│  - Metadata extraction                                   │
│  - Quality filtering                                     │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   EMBEDDING LAYER                        │
│  - Model: text-embedding-3-small (OpenAI)               │
│  - Dimension: 1536                                       │
│  - Batch processing: 100 docs/batch                     │
│  - Rate limiting: 3000 RPM                              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                          │
│  - Vector DB: LanceDB (local-first)                     │
│  - Metadata DB: SQLite (structured signals)             │
│  - Indexes: HNSW for fast similarity search             │
│  - Partitioning: By user, by date, by type              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   RETRIEVAL LAYER                        │
│  - Hybrid search: Vector + Metadata filters             │
│  - Reranking: Cohere/Cross-encoder (optional)           │
│  - Context window management                            │
│  - Deduplication                                         │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   GENERATION LAYER                       │
│  - Model: DeepSeek R1 (Groq via OpenRouter)            │
│  - Prompt engineering: Few-shot with signals            │
│  - Temperature: 0.7 (balanced)                          │
│  - Max tokens: 150 (short responses)                    │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   SIGNAL ENFORCEMENT                     │
│  - Post-processing: Enforce emoji count, length         │
│  - Phrase injection: Insert common phrases              │
│  - Style validation: Check against signals              │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Implementation Phases

### Week 1: Signal Extraction Pipeline

#### Day 1-2: Schema & Infrastructure

**Task**: Create signal storage schema

```sql
-- src/infrastructure/db/signal-schema.ts

CREATE TABLE user_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES contacts(id),

  -- Response patterns
  avg_response_time_minutes REAL,
  response_time_p50 REAL,           -- Median
  response_time_p95 REAL,           -- 95th percentile
  initiation_rate REAL,             -- % convos they start

  -- Message structure
  avg_message_length REAL,
  message_length_std REAL,          -- Standard deviation
  median_message_length REAL,
  avg_words_per_message REAL,

  -- Expression style
  emoji_per_message REAL,           -- Avg emojis per message
  emoji_variance REAL,
  top_emojis TEXT,                  -- JSON: [{"emoji": "❤️", "freq": 0.4}, ...]
  emoji_position TEXT,              -- JSON: {"start": 0.1, "middle": 0.2, "end": 0.7}

  -- Punctuation patterns
  exclamation_rate REAL,            -- % messages with !
  question_rate REAL,               -- % messages with ?
  period_rate REAL,                 -- % messages with .
  ellipsis_rate REAL,               -- % messages with ...

  -- Common patterns
  common_greetings TEXT,            -- JSON: ["hey jaan", "hey love", ...]
  common_endings TEXT,              -- JSON: ["❤️", "love you", ...]
  common_phrases TEXT,              -- JSON: [{"phrase": "want to talk", "freq": 0.3}, ...]
  filler_words TEXT,                -- JSON: ["like", "just", "basically", ...]

  -- Behavioral patterns
  asks_followup_questions REAL,    -- % messages that ask questions
  uses_voice_notes REAL,           -- % voice vs text
  sends_multiple_messages REAL,    -- % sends 2+ messages in row
  edits_messages REAL,             -- % messages edited

  -- Temporal patterns
  active_hours TEXT,                -- JSON: {"peak": [18, 22], "low": [2, 6]}
  weekend_vs_weekday_diff REAL,    -- Communication difference

  -- Quality metrics
  message_count INTEGER,            -- Total messages analyzed
  confidence REAL,                  -- 0-1 confidence score
  last_computed_at INTEGER,         -- Timestamp

  UNIQUE(user_id)
);

CREATE INDEX idx_signals_user ON user_signals(user_id);
CREATE INDEX idx_signals_confidence ON user_signals(confidence DESC);
```

**Task**: Create signal extraction service

```typescript
// src/domain/signals/signal-extraction.service.ts

import { Effect, Context } from "effect";
import { DatabaseService } from "../../infrastructure/db/client";

export interface SignalExtractionService {
  readonly extractSignals: (userId: string) => Effect.Effect<UserSignals, Error>;
  readonly refreshSignals: (userId: string) => Effect.Effect<void, Error>;
}

export class SignalExtractionServiceTag extends Context.Tag("SignalExtractionService")<
  SignalExtractionServiceTag,
  SignalExtractionService
>() {}

export interface UserSignals {
  userId: string;

  // Response patterns
  avgResponseTimeMinutes: number;
  responseTimeP50: number;
  responseTimeP95: number;
  initiationRate: number;

  // Message structure
  avgMessageLength: number;
  messageLengthStd: number;
  medianMessageLength: number;
  avgWordsPerMessage: number;

  // Expression style
  emojiPerMessage: number;
  emojiVariance: number;
  topEmojis: Array<{ emoji: string; frequency: number }>;
  emojiPosition: { start: number; middle: number; end: number };

  // Punctuation
  exclamationRate: number;
  questionRate: number;
  periodRate: number;
  ellipsisRate: number;

  // Common patterns
  commonGreetings: string[];
  commonEndings: string[];
  commonPhrases: Array<{ phrase: string; frequency: number }>;
  fillerWords: string[];

  // Behavioral
  asksFollowupQuestions: number;
  usesVoiceNotes: number;
  sendsMultipleMessages: number;

  // Metadata
  messageCount: number;
  confidence: number;
}
```

#### Day 3-4: Core Signal Extractors

**Task**: Implement response time analyzer

```typescript
// src/domain/signals/extractors/response-time.ts

export const extractResponseTimes = (messages: Message[]) => {
  const responseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];

    // User responding to partner
    if (current.fromMe && !previous.fromMe) {
      const diffMinutes = (current.timestamp - previous.timestamp) / 60;
      responseTimes.push(diffMinutes);
    }
  }

  // Calculate percentiles
  responseTimes.sort((a, b) => a - b);

  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  return {
    avgResponseTimeMinutes: avg,
    responseTimeP50: p50,
    responseTimeP95: p95,
    sampleSize: responseTimes.length
  };
};
```

**Task**: Implement emoji analyzer

```typescript
// src/domain/signals/extractors/emoji-patterns.ts

export const extractEmojiPatterns = (messages: Message[]) => {
  const userMessages = messages.filter(m => m.fromMe);

  // Count emojis per message
  const emojiCounts = userMessages.map(m => {
    const text = m.text || '';
    const emojis = text.match(/[\p{Emoji}]/gu) || [];
    return emojis.length;
  });

  const avgEmojis = emojiCounts.reduce((a, b) => a + b, 0) / emojiCounts.length;
  const variance = calculateVariance(emojiCounts);

  // Find top emojis
  const emojiFreq = new Map<string, number>();
  userMessages.forEach(m => {
    const emojis = (m.text || '').match(/[\p{Emoji}]/gu) || [];
    emojis.forEach(emoji => {
      emojiFreq.set(emoji, (emojiFreq.get(emoji) || 0) + 1);
    });
  });

  const topEmojis = Array.from(emojiFreq.entries())
    .map(([emoji, count]) => ({
      emoji,
      frequency: count / userMessages.length
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Analyze emoji position (start, middle, end)
  const positions = { start: 0, middle: 0, end: 0 };
  userMessages.forEach(m => {
    const text = m.text || '';
    const emojis = text.match(/[\p{Emoji}]/gu);
    if (!emojis) return;

    const firstEmojiPos = text.indexOf(emojis[0]);
    const textLength = text.length;

    if (firstEmojiPos < textLength * 0.2) positions.start++;
    else if (firstEmojiPos > textLength * 0.8) positions.end++;
    else positions.middle++;
  });

  const totalWithEmojis = positions.start + positions.middle + positions.end;

  return {
    emojiPerMessage: avgEmojis,
    emojiVariance: variance,
    topEmojis,
    emojiPosition: {
      start: positions.start / totalWithEmojis,
      middle: positions.middle / totalWithEmojis,
      end: positions.end / totalWithEmojis
    }
  };
};
```

**Task**: Implement phrase extractor (N-gram analysis)

```typescript
// src/domain/signals/extractors/phrase-patterns.ts

export const extractCommonPhrases = (messages: Message[], nGramSize: number = 3) => {
  const userMessages = messages.filter(m => m.fromMe && m.text);

  const phraseFreq = new Map<string, number>();

  userMessages.forEach(m => {
    const text = (m.text || '').toLowerCase();
    const words = text.split(/\s+/);

    // Extract n-grams
    for (let i = 0; i <= words.length - nGramSize; i++) {
      const phrase = words.slice(i, i + nGramSize).join(' ');

      // Filter out common stop phrases
      if (!isStopPhrase(phrase)) {
        phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
      }
    }
  });

  // Find common phrases (appear in >5% of messages)
  const threshold = userMessages.length * 0.05;

  return Array.from(phraseFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([phrase, count]) => ({
      phrase,
      frequency: count / userMessages.length
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
};

const STOP_PHRASES = new Set([
  'i am', 'you are', 'to the', 'in the', 'of the',
  'and the', 'is a', 'it is', 'that is', 'this is'
]);

const isStopPhrase = (phrase: string): boolean => {
  return STOP_PHRASES.has(phrase) || phrase.length < 5;
};
```

#### Day 5: Integration & Testing

**Task**: Wire up all extractors

```typescript
// src/domain/signals/signal-extraction.service.ts

export const SignalExtractionLive = Layer.effect(
  SignalExtractionServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseService;

    const extractSignals = (userId: string) =>
      Effect.gen(function* () {
        // 1. Fetch all user messages
        const messages = yield* Effect.tryPromise({
          try: () => db.getUserMessages(userId),
          catch: (e) => new Error(`Failed to fetch messages: ${e}`)
        });

        if (messages.length < 50) {
          return yield* Effect.fail(
            new Error('Insufficient data: need at least 50 messages')
          );
        }

        // 2. Extract all signals in parallel
        const [
          responseTimeSignals,
          emojiSignals,
          phraseSignals,
          structureSignals,
          behavioralSignals
        ] = yield* Effect.all([
          Effect.sync(() => extractResponseTimes(messages)),
          Effect.sync(() => extractEmojiPatterns(messages)),
          Effect.sync(() => extractCommonPhrases(messages)),
          Effect.sync(() => extractMessageStructure(messages)),
          Effect.sync(() => extractBehavioralPatterns(messages))
        ]);

        // 3. Combine into UserSignals
        const signals: UserSignals = {
          userId,
          ...responseTimeSignals,
          ...emojiSignals,
          ...phraseSignals,
          ...structureSignals,
          ...behavioralSignals,
          messageCount: messages.length,
          confidence: calculateConfidence(messages.length)
        };

        // 4. Store in database
        yield* Effect.tryPromise({
          try: () => db.upsertSignals(signals),
          catch: (e) => new Error(`Failed to store signals: ${e}`)
        });

        return signals;
      });

    const refreshSignals = (userId: string) =>
      Effect.gen(function* () {
        yield* extractSignals(userId);
      });

    return {
      extractSignals,
      refreshSignals
    };
  })
);
```

**Task**: Add CLI command for signal extraction

```typescript
// src/cli/commands/extract-signals.command.ts

import { Command, Args } from "@effect/cli";
import { Effect, Console } from "effect";
import { SignalExtractionServiceTag } from "../../domain/signals/signal-extraction.service";

export const extractSignalsCommand = Command.make(
  "extract-signals",
  {
    userId: Args.text({ name: "userId" })
  },
  ({ userId }) =>
    Effect.gen(function* () {
      const service = yield* SignalExtractionServiceTag;

      yield* Console.log(`Extracting behavioral signals for user: ${userId}...`);

      const signals = yield* service.extractSignals(userId);

      yield* Console.log("\n✅ Signal Extraction Complete\n");
      yield* Console.log(`Messages analyzed: ${signals.messageCount}`);
      yield* Console.log(`Confidence: ${(signals.confidence * 100).toFixed(1)}%`);
      yield* Console.log(`\nKey Signals:`);
      yield* Console.log(`- Avg response time: ${signals.avgResponseTimeMinutes.toFixed(1)} minutes`);
      yield* Console.log(`- Avg message length: ${signals.avgMessageLength.toFixed(0)} characters`);
      yield* Console.log(`- Emojis per message: ${signals.emojiPerMessage.toFixed(2)}`);
      yield* Console.log(`- Top emoji: ${signals.topEmojis[0]?.emoji || 'N/A'}`);
      yield* Console.log(`- Common phrases: ${signals.commonPhrases.length}`);
    })
);
```

---

### Week 2: Signal-Enhanced RAG

#### Day 6-7: Enhanced Prompt Engineering

**Task**: Create signal-aware prompt builder

```typescript
// src/domain/signals/prompt-builder.ts

export const buildSignalEnhancedPrompt = (
  incomingMessage: string,
  ragExamples: string[],
  signals: UserSignals
): string => {
  return `
You are drafting a WhatsApp response that matches the user's EXACT communication style.

INCOMING MESSAGE:
"${incomingMessage}"

USER'S STYLE PROFILE (MUST MATCH):
- Message length: ${signals.avgMessageLength.toFixed(0)} characters (±${signals.messageLengthStd.toFixed(0)})
- Emojis: ${signals.emojiPerMessage.toFixed(1)} per message
- Top emojis: ${signals.topEmojis.slice(0, 3).map(e => e.emoji).join(', ')}
- Emoji position: ${getEmojiPositionPreference(signals.emojiPosition)}
- Common greetings: ${signals.commonGreetings.join(', ')}
- Common phrases: ${signals.commonPhrases.slice(0, 5).map(p => `"${p.phrase}"`).join(', ')}
- Question style: ${signals.asksFollowupQuestions > 0.6 ? 'Always asks follow-up questions' : 'Sometimes asks questions'}
- Punctuation: ${getPunctuationStyle(signals)}

PAST EXAMPLES (for reference):
${ragExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}

CRITICAL RULES:
1. Length: MUST be ${signals.avgMessageLength.toFixed(0)} characters (±10%)
2. Emojis: MUST use exactly ${Math.round(signals.emojiPerMessage)} emoji
3. Preferred emojis: Use ${signals.topEmojis[0]?.emoji || '❤️'}
4. Common phrases: Try to incorporate "${signals.commonPhrases[0]?.phrase || 'want to talk'}"
5. Questions: ${signals.asksFollowupQuestions > 0.6 ? 'MUST include a follow-up question' : 'May include a question'}

Draft response (matching EXACT style):
`.trim();
};

const getEmojiPositionPreference = (position: { start: number; middle: number; end: number }) => {
  if (position.end > 0.6) return 'Emoji at end';
  if (position.start > 0.6) return 'Emoji at start';
  return 'Emoji in middle';
};

const getPunctuationStyle = (signals: UserSignals) => {
  const styles = [];
  if (signals.exclamationRate > 0.3) styles.push('Uses ! often');
  if (signals.questionRate > 0.5) styles.push('Asks many questions');
  if (signals.ellipsisRate > 0.2) styles.push('Uses ...');
  return styles.join(', ') || 'Standard punctuation';
};
```

#### Day 8-9: Post-Processing Enforcement

**Task**: Create signal enforcer (post-generation validation)

```typescript
// src/domain/signals/signal-enforcer.ts

export const enforceSignals = (
  generatedDraft: string,
  signals: UserSignals
): string => {
  let draft = generatedDraft;

  // 1. Enforce emoji count
  draft = enforceEmojiCount(draft, signals);

  // 2. Enforce message length
  draft = enforceMessageLength(draft, signals);

  // 3. Inject common phrases (if missing)
  draft = injectCommonPhrases(draft, signals);

  // 4. Enforce question pattern
  draft = enforceQuestionPattern(draft, signals);

  return draft;
};

const enforceEmojiCount = (draft: string, signals: UserSignals): string => {
  const currentEmojis = (draft.match(/[\p{Emoji}]/gu) || []).length;
  const targetEmojis = Math.round(signals.emojiPerMessage);

  if (currentEmojis === targetEmojis) return draft;

  // Too many emojis: remove excess
  if (currentEmojis > targetEmojis) {
    const emojis = draft.match(/[\p{Emoji}]/gu) || [];
    const toRemove = currentEmojis - targetEmojis;

    // Remove from least common emojis first
    const leastCommon = emojis.filter(e =>
      !signals.topEmojis.slice(0, 3).map(t => t.emoji).includes(e)
    );

    let result = draft;
    for (let i = 0; i < toRemove && i < leastCommon.length; i++) {
      result = result.replace(leastCommon[i], '');
    }
    return result.trim();
  }

  // Too few emojis: add most common
  const toAdd = targetEmojis - currentEmojis;
  const topEmoji = signals.topEmojis[0]?.emoji || '❤️';

  // Add at preferred position
  if (signals.emojiPosition.end > 0.6) {
    return `${draft} ${topEmoji.repeat(toAdd)}`.trim();
  } else if (signals.emojiPosition.start > 0.6) {
    return `${topEmoji.repeat(toAdd)} ${draft}`.trim();
  } else {
    // Add in middle
    const mid = Math.floor(draft.length / 2);
    return `${draft.slice(0, mid)} ${topEmoji.repeat(toAdd)} ${draft.slice(mid)}`.trim();
  }
};

const enforceMessageLength = (draft: string, signals: UserSignals): string => {
  const currentLength = draft.length;
  const targetLength = signals.avgMessageLength;
  const tolerance = signals.messageLengthStd || targetLength * 0.2;

  // Within tolerance: keep as is
  if (Math.abs(currentLength - targetLength) <= tolerance) {
    return draft;
  }

  // Too long: truncate intelligently
  if (currentLength > targetLength + tolerance) {
    // Try to keep complete sentences
    const sentences = draft.split(/[.!?]\s+/);
    let result = '';
    for (const sentence of sentences) {
      if ((result + sentence).length <= targetLength + tolerance) {
        result += sentence + '. ';
      } else {
        break;
      }
    }
    return result.trim();
  }

  // Too short: keep as is (better short than artificial padding)
  return draft;
};

const injectCommonPhrases = (draft: string, signals: UserSignals): string => {
  const topPhrase = signals.commonPhrases[0]?.phrase;
  if (!topPhrase) return draft;

  // Check if draft already contains common phrase
  if (draft.toLowerCase().includes(topPhrase.toLowerCase())) {
    return draft;
  }

  // Inject if appropriate (e.g., support context)
  if (draft.match(/\b(here|support|help)\b/i)) {
    return draft.replace(
      /(\.|!|\?)(\s*)$/,
      `. ${capitalize(topPhrase)}?$2`
    );
  }

  return draft;
};

const enforceQuestionPattern = (draft: string, signals: UserSignals): string => {
  const hasQuestion = draft.includes('?');
  const shouldHaveQuestion = signals.asksFollowupQuestions > 0.6;

  if (shouldHaveQuestion && !hasQuestion) {
    // Add a question
    const commonQuestions = [
      'Want to talk?',
      'What happened?',
      'How are you feeling?',
      'Need anything?'
    ];

    return `${draft} ${commonQuestions[0]}`;
  }

  return draft;
};
```

#### Day 10: Integration with Auto-Draft

**Task**: Update auto-draft to use signal-enhanced generation

```typescript
// src/domain/whatsapp/auto-draft/auto-draft-monitor.ts

// Add to imports
import { SignalExtractionServiceTag } from "../../signals/signal-extraction.service";
import { buildSignalEnhancedPrompt } from "../../signals/prompt-builder";
import { enforceSignals } from "../../signals/signal-enforcer";

// Update draft generation logic
const generateDraftWithSignals = Effect.gen(function* () {
  const analysis = yield* AnalysisServiceTag;
  const signalService = yield* SignalExtractionServiceTag;
  const ai = yield* AIServiceTag;
  const vectorStore = yield* VectorStoreService;

  // 1. Load user signals
  const signals = yield* signalService.extractSignals(userId);

  // 2. RAG search for examples
  const ragExamples = yield* vectorStore.search(
    `respond to: ${incomingMessage}`,
    5
  );

  // 3. Build signal-enhanced prompt
  const prompt = buildSignalEnhancedPrompt(
    incomingMessage,
    ragExamples.map(r => r.text),
    signals
  );

  // 4. Generate draft
  const rawDraft = yield* ai.generateText([
    { role: "system", content: "Match the user's exact communication style." },
    { role: "user", content: prompt }
  ]);

  // 5. Enforce signals (post-processing)
  const finalDraft = enforceSignals(rawDraft, signals);

  return finalDraft;
});
```

---

### Week 3: Testing, Optimization, Monitoring

#### Day 11-12: Quality Metrics & A/B Testing

**Task**: Implement quality scoring

```typescript
// src/domain/signals/quality-scorer.ts

export interface DraftQualityScore {
  overallScore: number;  // 0-100

  styleMatch: {
    lengthMatch: number;      // 0-1
    emojiMatch: number;       // 0-1
    phraseMatch: number;      // 0-1
    punctuationMatch: number; // 0-1
  };

  deviations: string[];  // List of issues
}

export const scoreDraftQuality = (
  draft: string,
  signals: UserSignals
): DraftQualityScore => {
  const scores = {
    lengthMatch: scoreLengthMatch(draft, signals),
    emojiMatch: scoreEmojiMatch(draft, signals),
    phraseMatch: scorePhraseMatch(draft, signals),
    punctuationMatch: scorePunctuationMatch(draft, signals)
  };

  const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / 4 * 100;

  const deviations = [];
  if (scores.lengthMatch < 0.8) deviations.push('Length mismatch');
  if (scores.emojiMatch < 0.8) deviations.push('Emoji count off');
  if (scores.phraseMatch < 0.5) deviations.push('Missing common phrases');

  return {
    overallScore,
    styleMatch: scores,
    deviations
  };
};
```

**Task**: Add A/B testing framework

```typescript
// src/domain/signals/ab-testing.ts

export const abTestDrafts = async (
  incomingMessage: string,
  userId: string
) => {
  // Generate both versions
  const [basicDraft, signalDraft] = await Promise.all([
    generateBasicDraft(incomingMessage, userId),
    generateSignalEnhancedDraft(incomingMessage, userId)
  ]);

  // Score both
  const signals = await getSignals(userId);
  const basicScore = scoreDraftQuality(basicDraft, signals);
  const signalScore = scoreDraftQuality(signalDraft, signals);

  // Log for analysis
  await logABTest({
    userId,
    incomingMessage,
    basicDraft,
    signalDraft,
    basicScore: basicScore.overallScore,
    signalScore: signalScore.overallScore,
    improvement: signalScore.overallScore - basicScore.overallScore
  });

  return {
    basic: { draft: basicDraft, score: basicScore },
    signalEnhanced: { draft: signalDraft, score: signalScore }
  };
};
```

#### Day 13-14: Performance Optimization

**Task**: Add caching layer

```typescript
// src/domain/signals/signal-cache.ts

// Cache signals in memory (avoid DB lookups every draft)
const signalCache = new Map<string, { signals: UserSignals; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

export const getCachedSignals = async (userId: string): Promise<UserSignals> => {
  const cached = signalCache.get(userId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.signals;
  }

  const signals = await extractSignals(userId);
  signalCache.set(userId, { signals, timestamp: Date.now() });

  return signals;
};
```

**Task**: Add monitoring/telemetry

```typescript
// src/domain/signals/telemetry.ts

export const logDraftMetrics = async (metrics: {
  userId: string;
  incomingMessage: string;
  draftGenerated: string;
  qualityScore: number;
  generationTimeMs: number;
  usedSignals: boolean;
}) => {
  // Log to database for analysis
  await db.insert(draftMetrics).values({
    ...metrics,
    timestamp: new Date()
  });

  // Optional: Send to analytics service
  // analytics.track('draft_generated', metrics);
};
```

#### Day 15: Documentation & Handoff

**Task**: Create usage guide

**Task**: Write testing guide

---

## 📋 Enterprise RAG Best Practices Applied

### 1. Hybrid Search (Vector + Metadata)

```typescript
// Enhanced RAG search with metadata filters
const searchWithMetadata = async (query: string, signals: UserSignals) => {
  return await vectorStore.search(query, {
    limit: 10,
    filters: {
      // Filter by similar style
      message_length: {
        gte: signals.avgMessageLength * 0.8,
        lte: signals.avgMessageLength * 1.2
      },
      emoji_count: {
        gte: Math.floor(signals.emojiPerMessage),
        lte: Math.ceil(signals.emojiPerMessage)
      },
      // Filter by recency (prefer recent messages)
      timestamp: {
        gte: Date.now() - 90 * 24 * 60 * 60 * 1000  // Last 90 days
      }
    }
  });
};
```

### 2. Reranking (Optional - Advanced)

```typescript
// Rerank RAG results by quality
const rerankResults = (results: Document[], signals: UserSignals) => {
  return results
    .map(doc => ({
      doc,
      score: calculateRelevanceScore(doc, signals)
    }))
    .sort((a, b) => b.score - a.score)
    .map(r => r.doc);
};

const calculateRelevanceScore = (doc: Document, signals: UserSignals) => {
  let score = doc.similarity || 0;  // Vector similarity

  // Boost if length matches
  const lengthDiff = Math.abs(doc.text.length - signals.avgMessageLength);
  score += (1 - lengthDiff / signals.avgMessageLength) * 0.3;

  // Boost if emojis match
  const docEmojis = (doc.text.match(/[\p{Emoji}]/gu) || []).length;
  const emojiDiff = Math.abs(docEmojis - signals.emojiPerMessage);
  score += (1 - emojiDiff / 2) * 0.2;

  return score;
};
```

### 3. Context Window Management

```typescript
// Intelligent context selection for LLM
const buildOptimalContext = (
  ragResults: Document[],
  signals: UserSignals,
  maxTokens: number = 1000
) => {
  let context = '';
  let tokens = 0;

  for (const doc of ragResults) {
    const docTokens = estimateTokens(doc.text);

    if (tokens + docTokens > maxTokens) break;

    context += `- "${doc.text}"\n`;
    tokens += docTokens;
  }

  return context;
};

const estimateTokens = (text: string) => {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
};
```

### 4. Metadata Enrichment at Index Time

```typescript
// Enrich documents with signals at index time
const indexMessageWithSignals = async (message: Message) => {
  const signals = extractMessageSignals(message);

  await vectorStore.addDocuments([{
    id: message.id,
    text: message.text,
    vector: await embedText(message.text),
    metadata: {
      timestamp: message.timestamp,
      sender: message.fromMe ? 'me' : 'partner',

      // Signal metadata for filtering
      message_length: message.text.length,
      emoji_count: (message.text.match(/[\p{Emoji}]/gu) || []).length,
      has_question: message.text.includes('?'),
      word_count: message.text.split(/\s+/).length,

      // Quality indicators
      is_substantive: message.text.split(/\s+/).length > 3,
      sentiment: await analyzeSentiment(message.text)
    }
  }]);
};
```

---

## 🎯 Success Criteria

### Quantitative Metrics

1. **Style Match Score**: >85% (vs 60% for basic RAG)
   - Length match: ±10% of user average
   - Emoji count: Exact match
   - Phrase usage: >50% incorporation

2. **User Approval Rate**: >75% drafts used without modification
   - Track in database: user copies draft vs ignores

3. **Generation Time**: <3 seconds end-to-end
   - Signal lookup: <100ms (cached)
   - RAG search: <500ms
   - LLM generation: <2s
   - Post-processing: <100ms

4. **Quality Score**: >80/100 average
   - A/B test: Signal-enhanced beats basic by >15 points

### Qualitative Validation

**Test Cases** (Indian youth context):

```
Test 1: Casual check-in
Input: "Hey jaan, what's up? 😊"
Expected: Match user's greeting style, emoji count, question pattern

Test 2: Stress support
Input: "I'm so stressed about this exam 😩"
Expected: Match support style, appropriate length, common phrases

Test 3: Excitement sharing
Input: "I got the job!!! 🎉🎉🎉"
Expected: Match celebration style, emoji enthusiasm level

Test 4: Hinglish mixing
Input: "Yaar, I'm so tired today. Too much kaam"
Expected: If user uses Hinglish, draft should too

Test 5: Multi-message pattern
Input: [3 messages in quick succession]
Expected: If user typically sends 1 message, draft should be single message
```

---

## 🚀 Quick Start Prompt (For New Session)

```
I'm implementing RAG + Signals for LifeOps to improve personalization from 60-70% to 75-80%.

Current status: Basic RAG works (searches past messages, mimics style)
Goal: Extract behavioral signals (emoji usage, message length, common phrases) and enforce them during generation

Implementation plan:
Week 1: Signal extraction (response time, emoji patterns, phrase n-grams, storage)
Week 2: Signal-enhanced RAG (hybrid search, signal-aware prompts, post-processing enforcement)
Week 3: Testing, optimization (A/B testing, quality scoring, caching, monitoring)

I'm starting with Day 1: Create SQLite schema for user_signals table.

Schema should include:
- Response patterns (avg time, p50, p95)
- Message structure (length, words, variance)
- Expression style (emoji count, top emojis, position)
- Punctuation patterns (!, ?, .)
- Common patterns (greetings, endings, phrases)
- Behavioral (asks questions, uses voice notes)

The schema is at: src/infrastructure/db/signal-schema.ts

Please implement the complete schema following the enterprise RAG standards outlined in the plan.
```

---

**Ready to start!** This plan provides enterprise-grade RAG implementation with clear milestones, code structure, and success criteria.

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
**Related**: [basic-vs-advanced-rag.md](./basic-vs-advanced-rag.md)
