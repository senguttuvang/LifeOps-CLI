# Profile & Pattern System: Current Status

> **Context**: How LifeOps understands user and partner behavior, preferences, and personas for intelligent drafting and suggestions.

**Last Updated**: 2026-01-05
**Status**: 🟡 Designed but Not Implemented
**Related Docs**: [perspective-engine.md](./perspective-engine.md)

---

## 🎯 The Core Question

**"How does our system know what to respond?"**

Currently: **It doesn't**. The system has basic RAG (similarity search) but no deep understanding of:
- Who the user is (communication style, values, priorities)
- Who the partner is (preferences, emotional needs, patterns)
- What themes/activities/functions their relationship revolves around

---

## 📊 Current State vs Design

### What Exists ✅

#### 1. Basic Message Indexing (LanceDB)
```typescript
// src/infrastructure/rag/vector.store.ts
// ✅ Messages ARE indexed into LanceDB with embeddings
// ✅ Semantic search works (find similar messages)

await vectorStore.addDocuments([
  {
    id: "msg-123",
    text: "Me: Let's go hiking this weekend!",
    metadata: {
      timestamp: "2025-01-01T10:00:00Z",
      sender: "me",
      chatId: "girlfriend-chat"
    }
  }
]);

// Search works
const results = await vectorStore.search("outdoor activities", 5);
```

**What's missing**: No categorization. Messages aren't segmented into:
- Themes (travel, food, work stress, family)
- Life functions (dating, conflict resolution, support, celebration)
- Activities (hiking, dining, watching movies)
- Emotional contexts (happy, stressed, loving, frustrated)

#### 2. Schema Has Profile Tables ✅

```sql
-- src/infrastructure/db/schema.ts
-- ✅ Relationship insights table EXISTS
CREATE TABLE relationship_insights (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL,
  insight_type TEXT,  -- 'communication_pattern', 'mood_trend', etc.
  insight_data TEXT,  -- JSON payload
  generated_at TIMESTAMP
);

-- ✅ Response patterns table EXISTS
CREATE TABLE response_patterns (
  relationship_id TEXT,
  avg_response_time_minutes INTEGER,
  avg_your_response_time_minutes INTEGER,
  response_time_variance REAL
);

-- ✅ Interaction topics table EXISTS
CREATE TABLE interaction_topics (
  interaction_id TEXT,
  topic TEXT,  -- e.g., "travel plans", "work stress"
  confidence REAL
);
```

**What's missing**: These tables are EMPTY. No code populates them.

#### 3. Analysis Service Exists ✅

```typescript
// src/domain/relationship/analysis.service.ts
// ✅ draftResponse() method exists
// ✅ Uses RAG to find similar past messages
// ✅ Passes context to AI for generation

const draftResponse = (chatId: string, intent: string) =>
  Effect.gen(function* (_) {
    // 1. Get recent messages (context)
    const recentMessages = yield* db.getRecentMessages(chatId, 10);

    // 2. RAG search for similar style
    const ragResults = yield* vectorStore.search(intent, 3);

    // 3. Generate draft
    const prompt = `
      Reference (My past style):
      ${ragResults.map(doc => doc.text).join('\n')}

      Recent Chat:
      ${recentMessages.map(m => m.content).join('\n')}

      Intent: ${intent}

      Draft:
    `;

    return yield* ai.generateText([
      { role: "system", content: "Mimic the user's style." },
      { role: "user", content: prompt }
    ]);
  });
```

**What's present**: Basic tone matching via RAG examples
**What's missing**: No deep persona understanding. Drafts are generic, don't account for:
- User's values (does user value directness vs diplomacy?)
- Partner's preferences (does partner prefer logic vs emotion?)
- Relationship phase (dating vs married)
- Current emotional context (partner stressed vs happy)

---

### What's Missing ❌

#### 1. NO Profile/Persona Extraction

**Designed in** `perspective-engine.md` but **NOT implemented**:

```typescript
// DOES NOT EXIST
interface PerspectiveProfile {
  userId: string;

  // Layer 1: Behavioral Signals
  signals: {
    communication: {
      avgResponseTime: number;
      emojiUsage: number;
      humorFrequency: number;
    };
    emotional: {
      baselineMood: 'optimistic' | 'neutral' | 'pessimistic';
      stressResponse: 'problem-solve' | 'vent' | 'withdraw';
    };
  };

  // Layer 2: Values & Traits
  attributes: {
    values: {
      family: 0.8,
      adventure: 0.6,
      stability: 0.7
    };
    traits: {
      openness: 0.75,
      humor: 0.8
    };
  };

  // Layer 3: Worldview
  worldview: {
    narrative: "Grounded optimist who values connection...",
    corePrinciples: ["Family first", "Try new things"],
    relationshipGoals: ["Deep connection", "Shared adventures"]
  };
}
```

**No code exists to**:
- Extract behavioral signals from messages
- Infer values from conversation patterns
- Generate worldview narratives
- Store profiles in database

#### 2. NO Message Categorization/Segmentation

**Messages indexed, but NOT categorized**:

```typescript
// DOES NOT EXIST
interface CategorizedMessage {
  id: string;
  text: string;

  // Missing categorization
  themes: string[];        // ["travel", "relationship goals"]
  lifeFunction: string;    // "planning future"
  activity: string | null; // "discussing vacation"
  emotionalContext: string; // "excited", "stressed"
  relationshipPhase: string; // "dating", "committed"
}

// Missing extraction service
const categorizeMessage = async (message: Message) => {
  // Use AI to extract:
  // - Primary theme (work, family, dating, conflict, etc.)
  // - Life function (support, celebration, planning, etc.)
  // - Activities mentioned (hiking, dinner, movies)
  // - Emotional tone (happy, stressed, loving, frustrated)

  // Store in interaction_topics table
};
```

#### 3. NO Pattern Detection

**Schema has tables, but NO code populates them**:

```typescript
// DOES NOT EXIST
const detectCommunicationPatterns = async (relationshipId: string) => {
  // Analyze last 100 interactions
  // Calculate:
  // - Average response times (both directions)
  // - Response time variance (consistency)
  // - Initiation rate (who starts conversations)
  // - Message length distribution
  // - Emoji/humor frequency

  // Store in response_patterns table
};

const detectEmotionalPatterns = async (relationshipId: string) => {
  // Track over time:
  // - Mood trends (improving vs declining)
  // - Stress mentions
  // - Conflict frequency
  // - Support exchanges

  // Store in relationship_insights table
};
```

#### 4. NO Continuous Refinement

**No background jobs to update profiles**:

```typescript
// DOES NOT EXIST
cron.schedule('0 0 * * *', async () => {
  // Daily: refine profiles
  const users = await getAllUsers();

  for (const user of users) {
    const newMessages = await getMessagesSince(user.lastProfileUpdate);

    if (newMessages.length > 50) {
      // Re-extract profile with new data
      await refineProfile(user.id);
    }
  }
});
```

---

## 🔍 Current Drafting Logic (Simple)

### How `draftResponse()` Works Now

```
Input: "tell her I'm running late"

Step 1: Fetch last 10 messages
  → Get recent conversation context

Step 2: RAG search with intent as query
  → Find 3 similar past messages by embedding similarity
  → Example matches:
      - "Sorry babe, stuck in traffic"
      - "Hey running 15 mins behind"
      - "Traffic is crazy, will be late"

Step 3: Build prompt
  Reference (My past style):
  - "Sorry babe, stuck in traffic"
  - "Hey running 15 mins behind"

  Recent Chat:
  - Partner: "What time will you be here?"
  - Me: "Leaving now"

  Intent: tell her I'm running late

  Draft:

Step 4: AI generates draft
  → "Hey jaan, I'm running a bit late. Traffic is crazy. Be there in 20!"

Output: Generic draft based on keyword similarity
```

### What's Missing from This Approach

**NO understanding of**:
1. **User persona**: Is user formal vs casual? Direct vs apologetic? Uses "jaan" vs "love" vs name?
2. **Partner preferences**: Does partner prefer detail ("stuck at X intersection") vs brevity ("running late")?
3. **Relationship context**: Are they dating (more formal) vs married (casual)? Any recent conflicts (tone matters)?
4. **Emotional intelligence**: Partner stressed today? (Add extra empathy) Partner had good day? (Can be lighter)

**Better approach would be**:
```
Input: "tell her I'm running late"

Step 1: Load user profile
  → communicationStyle: { formality: 0.3, humor: 0.7, emoji: "high" }
  → values: { punctuality: 0.9 } ← User values being on time!
  → stressResponse: "apologetic"

Step 2: Load partner profile
  → preferences: { needsDetail: true, appreciatesHumor: false when stressed }
  → currentContext: Partner mentioned "rough day" 2 hours ago

Step 3: RAG search + profile-aware filtering
  → Find past "running late" messages
  → Filter to match current emotional context (partner stressed)
  → Prioritize messages that showed empathy

Step 4: Generate draft with profile awareness
  → Add apology (user values punctuality)
  → Include specific detail (partner needs context)
  → Skip humor (partner stressed)
  → Use user's preferred term ("love" not "jaan")

Output: "Hey love, so sorry – stuck in traffic on Highway 1. Should be there by 7:15. I know you've had a rough day, let me know if you need anything ❤️"
```

**This is what perspective engine would enable.**

---

## 📈 What Gets Indexed Now

### Current LanceDB Content

```typescript
// Every message indexed as:
{
  id: "msg-uuid",
  text: "Me: Let's try that new Italian place!",
  vector: [0.123, -0.456, ...], // OpenAI embedding
  metadata: {
    timestamp: "2025-01-05T18:30:00Z",
    sender: "me",
    chatId: "girlfriend-chat"
  }
}
```

**Searchable by**: Semantic similarity (keywords, concepts)

**NOT searchable by**:
- Theme ("Show me all travel planning messages")
- Activity type ("Find all dining experiences")
- Emotional context ("Find messages when partner was stressed")
- Relationship function ("Show support exchanges")
- Time period + category ("Food discussions in December")

---

## 🎯 What Would Full Implementation Look Like?

### Scenario: User messages girlfriend

**Current system**:
```
Girlfriend: "I had the worst day 😩"

@lifeops draft support

→ Searches vector DB for "support"
→ Finds 3 random support messages
→ Generates generic: "I'm sorry you had a bad day. Want to talk about it?"
```

**With profiles/patterns** (designed but not implemented):
```
Girlfriend: "I had the worst day 😩"

@lifeops draft support

Step 1: Load girlfriend profile
  - stressResponse: prefers "problem-solving" over "venting"
  - supportStyle: appreciates "action suggestions"
  - currentContext: Mentioned "big presentation" yesterday

Step 2: Load user profile
  - supportStyle: "listener + problem-solver"
  - loveLang

uage: "acts of service"
  - typicalResponse: Offers specific help

Step 3: RAG search filtered by context
  - Find: Past messages when girlfriend stressed about work
  - Priority: Messages that led to positive outcomes

Step 4: Generate profile-aware draft
  - Acknowledge stress (empathy first)
  - Reference presentation (show awareness)
  - Offer specific action (matches her preference)
  - Use user's typical style (balance empathy + problem-solving)

Output:
"That sounds really tough. How did the presentation go? Want me to bring dinner home so you don't have to cook? We can talk about it or just watch a movie - whatever you need ❤️"

Why this is better:
✅ Shows awareness (presentation)
✅ Offers action (dinner - user's love language)
✅ Gives choice (matches girlfriend's autonomy preference)
✅ Balances empathy + problem-solving (user's style)
```

---

## 📋 Implementation Roadmap (Designed but Not Built)

### Phase 1: Basic Signals Extraction (4-6 weeks)

```typescript
// Extract observable patterns
const extractBasicSignals = async (userId: string) => {
  const messages = await db.getUserMessages(userId);

  return {
    communication: {
      avgResponseTime: calculateAvgResponseTime(messages),
      avgMessageLength: calculateAvgLength(messages),
      emojiUsage: countEmojis(messages) / messages.length,
      humorFrequency: detectHumor(messages) / messages.length
    },
    activity: {
      outdoorMentions: countKeywords(messages, ['hike', 'beach', 'park']),
      foodMentions: countKeywords(messages, ['dinner', 'restaurant', 'cook']),
      culturalMentions: countKeywords(messages, ['movie', 'museum', 'show'])
    }
  };
};
```

**Deliverable**: Basic communication style metrics in database

### Phase 2: Value Extraction (4-6 weeks)

```typescript
// Infer what user values
const extractValues = async (userId: string) => {
  const messages = await vectorStore.search(userId, 200);

  const valueCategories = ['family', 'career', 'adventure', 'stability'];
  const scores = {};

  for (const value of valueCategories) {
    // Find messages about this value
    const related = await vectorStore.search(`${value} important`, 20);

    // Analyze sentiment + frequency
    const score = await calculateValueScore(related, value);
    scores[value] = score;
  }

  return scores;
};
```

**Deliverable**: Value scores (0-1) for each user

### Phase 3: Profile Generation (6-8 weeks)

```typescript
// AI-powered full profile extraction
const buildPerspectiveProfile = async (userId: string) => {
  const messages = await db.getUserMessages(userId, 200);
  const emotional = await vectorStore.search('emotional vulnerable', 20);
  const decisions = await vectorStore.search('decided chose', 20);

  const prompt = `
    Analyze this person's communication patterns and extract:
    1. Values (family, career, adventure, stability)
    2. Traits (openness, humor, empathy)
    3. Communication style
    4. Worldview narrative

    Messages: ${JSON.stringify(messages)}
    Emotional moments: ${JSON.stringify(emotional)}
    Decisions: ${JSON.stringify(decisions)}
  `;

  const profile = await ai.generateStructuredOutput(prompt, {
    schema: PerspectiveProfileSchema
  });

  await db.upsertProfile(userId, profile);
  return profile;
};
```

**Deliverable**: Complete perspective profiles for user + partner

### Phase 4: Continuous Refinement (4-6 weeks)

```typescript
// Background job: update profiles
cron.schedule('0 0 * * *', async () => {
  const users = await detectUsersNeedingRefinement();

  for (const user of users) {
    await refineProfile(user.id);
  }
});

const refineProfile = async (userId: string) => {
  const current = await getProfile(userId);
  const newMessages = await getMessagesSince(current.lastUpdated);

  if (newMessages.length > 50) {
    // Re-run extraction
    const updated = await buildPerspectiveProfile(userId);

    // Log evolution
    await db.insertEvolution({
      userId,
      previousProfile: current,
      newProfile: updated,
      trigger: 'new_data_threshold'
    });
  }
};
```

**Deliverable**: Self-updating profiles that evolve with new data

---

## 🏢 Enterprise Equivalent

**What LifeOps needs** = **B2B Lead Intelligence**

| LifeOps Need | B2B Equivalent | Tool Example |
|---------------|----------------|--------------|
| User/Partner Profiles | Lead/Customer 360 | Salesforce, HubSpot |
| Communication Patterns | Engagement Metrics | Mixpanel, Amplitude |
| Value Extraction | Buyer Intent Signals | 6sense, Demandbase |
| Profile Refinement | Lead Scoring Automation | Marketo, Pardot |
| Behavioral Segmentation | Customer Cohorts | Segment, mParticle |

**Core concept**: Deeply understand the person to predict what will resonate.

---

## 📝 Summary: Current Reality

### What Works ✅
1. **Message indexing**: All messages embedded in LanceDB
2. **Semantic search**: Can find similar messages
3. **Basic drafting**: Uses RAG to match tone
4. **Schema ready**: Tables exist for profiles/patterns

### What Doesn't Work ❌
1. **No profiles**: User/partner personas don't exist
2. **No categorization**: Messages not segmented by theme/function
3. **No pattern detection**: Communication patterns not tracked
4. **No continuous learning**: Profiles don't evolve
5. **Generic drafting**: No awareness of values/preferences

### The Gap
```
Designed System (perspective-engine.md):
  - 3-layer profile model
  - Continuous refinement
  - Enterprise-grade intelligence

Implemented System:
  - Basic RAG
  - No profiles
  - Generic responses
```

### Why Drafts Are Basic
**Current**: "Find similar text, generate draft"
**Needed**: "Understand WHO they are, WHAT they value, HOW they communicate → generate personalized draft"

---

## 🚀 Next Steps (Priority Order)

### Minimal Viable Profile System (8-10 weeks)

1. **Week 1-2**: Extract basic communication signals
   - Avg response time
   - Message length
   - Emoji usage
   - Store in database

2. **Week 3-4**: Add message categorization
   - Theme extraction (work, family, dating, etc.)
   - Activity detection (hiking, dinner, movies)
   - Emotional context (happy, stressed, loving)
   - Populate `interaction_topics` table

3. **Week 5-6**: Build simple value extraction
   - Keyword frequency + sentiment
   - Score 5-7 core values
   - Store in new `user_values` table

4. **Week 7-8**: Integrate profiles into drafting
   - Load user + partner profiles
   - Filter RAG results by context
   - Pass profile summary to AI prompt
   - Test improvement vs baseline

5. **Week 9-10**: Add basic refinement
   - Daily job to update profiles
   - Trigger on 50+ new messages
   - Log profile evolution

### Success Metrics

**Before** (current):
- Draft quality: Generic, 60% user approval
- Context awareness: Low (no profile data)
- Personalization: Minimal

**After** (with profiles):
- Draft quality: Personalized, 85%+ approval target
- Context awareness: High (profile-driven)
- Personalization: User style + partner preferences

---

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
**Related**: [perspective-engine.md](./perspective-engine.md), [ROADMAP.md](../ROADMAP.md)
