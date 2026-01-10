# Perspective Engine: Building Deep Personal Models

> **Context**: How LifeOps builds, maintains, and refines psychological profiles (worldview, values, priorities) for each person in a relationship.

**Last Updated**: 2026-01-05
**Status**: Core Architecture

---

## 🎯 **The Core Problem**

### What We Need to Understand About Each Person

**Surface Level** (Easy to extract):
- Favorite foods, music, activities
- Daily schedule, routines
- Communication style (formal, casual, emoji usage)

**Deep Level** (Harder but critical):
- **Worldview**: How do they see the world? (Optimistic, cynical, pragmatic?)
- **Values**: What matters most? (Family, career, freedom, security, novelty?)
- **Priorities**: What drives decisions? (Money, time, experiences, people?)
- **Attachment style**: How do they relate? (Secure, anxious, avoidant?)
- **Love language**: How do they give/receive love?
- **Conflict style**: How do they handle disagreements?
- **Aspirations**: What do they want from life? Career? Relationship?

**Why It Matters**:
```
Generic suggestion: "Go hiking this weekend"

With Perspective Engine:
User values: Adventure (0.9), Nature (0.8), Novelty (0.7)
Partner values: Relaxation (0.8), Connection (0.9), Planning (0.6)

Better suggestion: "Sunrise hike + picnic breakfast"
(Adventure + nature for User, peaceful + quality time for Partner)
```

---

## 🧠 **The Perspective Engine Architecture**

### Three-Layer Model

```
┌─────────────────────────────────────────────┐
│         Layer 1: Behavioral Signals         │
│  (Observable facts from messages/actions)   │
├─────────────────────────────────────────────┤
│ - Mentions "family" 2x/week                 │
│ - Plans activities 1 week in advance        │
│ - Uses humor in 60% of messages             │
│ - Responds to stress with problem-solving   │
│ - Shares 3 hiking photos/month              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Layer 2: Inferred Attributes          │
│   (Values, traits, preferences extracted)   │
├─────────────────────────────────────────────┤
│ Values:                                     │
│   - Family connection: 0.85                 │
│   - Spontaneity: 0.3 (low - plans ahead)    │
│   - Humor: 0.75                             │
│                                             │
│ Traits:                                     │
│   - Problem-solver (vs emotion-focuser)     │
│   - Planner (vs spontaneous)                │
│   - Outdoor enthusiast                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Layer 3: Worldview & Perspective      │
│    (Deep model of how they see the world)   │
├─────────────────────────────────────────────┤
│ Perspective Profile:                        │
│ "Grounded optimist who values stability     │
│  and connection. Finds joy in nature and    │
│  shared experiences. Processes challenges   │
│  through planning and action. Expresses     │
│  love through quality time and humor."      │
└─────────────────────────────────────────────┘
```

---

## 📊 **Perspective Schema**

### Data Structure

```typescript
interface PerspectiveProfile {
  userId: string;
  lastUpdated: Date;
  confidence: number; // 0-1, increases with more data

  // Layer 1: Behavioral Signals
  signals: {
    communication: CommunicationSignals;
    activities: ActivitySignals;
    emotional: EmotionalSignals;
    relational: RelationalSignals;
  };

  // Layer 2: Inferred Attributes
  attributes: {
    values: ValueScores;
    traits: TraitScores;
    preferences: PreferenceScores;
  };

  // Layer 3: Worldview
  worldview: {
    narrative: string; // AI-generated summary
    corePrinciples: string[]; // Key beliefs
    drivingMotivations: string[]; // What they optimize for
    relationshipGoals: string[]; // What they want from partnership
  };

  // Metadata
  evidence: Evidence[]; // Message IDs that support each inference
  evolutionHistory: ProfileSnapshot[]; // How perspective changed over time
}

// --- Communication Signals ---
interface CommunicationSignals {
  avgResponseTime: number; // minutes
  avgMessageLength: number; // characters
  emojiUsage: number; // per message
  humorFrequency: number; // % of messages
  vulnerabilityIndex: number; // 0-1, how often shares feelings
  initiationRate: number; // % of conversations they start
  questionAsking: number; // questions per conversation
}

// --- Activity Signals ---
interface ActivitySignals {
  categories: { [key: string]: number }; // "outdoor": 23, "food": 18
  planningLead: number; // days ahead they plan
  spontaneityScore: number; // 0-1
  noveltySeeker: number; // 0-1, tries new things vs repeats
  socialEnergyLevel: 'introvert' | 'ambivert' | 'extrovert';
}

// --- Emotional Signals ---
interface EmotionalSignals {
  baselineMood: 'optimistic' | 'neutral' | 'pessimistic';
  stressResponse: 'problem-solve' | 'vent' | 'withdraw' | 'seek-support';
  celebrationStyle: 'internal' | 'share-widely' | 'intimate-share';
  conflictStyle: 'confront' | 'avoid' | 'compromise' | 'problem-solve';
  emotionalExpression: number; // 0-1, how openly shares feelings
}

// --- Relational Signals ---
interface RelationalSignals {
  attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'fearful-avoidant';
  loveLanguages: {
    wordsOfAffirmation: number;
    qualityTime: number;
    physicalTouch: number;
    actsOfService: number;
    gifts: number;
  };
  connectionNeed: number; // 0-1, how often needs deep contact
  independenceNeed: number; // 0-1, how much alone time
  supportStyle: 'advice-giver' | 'listener' | 'cheerleader' | 'problem-solver';
}

// --- Values (What matters most) ---
interface ValueScores {
  family: number;           // 0-1
  career: number;
  adventure: number;
  stability: number;
  creativity: number;
  socialImpact: number;
  personalGrowth: number;
  wealth: number;
  freedom: number;
  connection: number;
  health: number;
  spirituality: number;
  // ... extensible
}

// --- Traits (How they are) ---
interface TraitScores {
  openness: number;         // 0-1 (Big 5)
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;

  // Additional
  optimism: number;
  humor: number;
  empathy: number;
  assertiveness: number;
  analyticalThinking: number;
}

// --- Preferences (What they like) ---
interface PreferenceScores {
  // Activity types
  outdoor: number;
  cultural: number;
  foodExperiences: number;
  athletic: number;
  creative: number;

  // Environmental
  morningPerson: boolean;
  quietVsLively: number; // 0 = quiet, 1 = lively
  structureVsSpontaneity: number;
}

// --- Evidence (Why we believe X) ---
interface Evidence {
  attribute: string; // e.g., "values.family"
  messageIds: string[]; // Messages that support this
  confidence: number; // How certain are we?
  lastObserved: Date;
}

// --- Evolution History ---
interface ProfileSnapshot {
  timestamp: Date;
  changedAttributes: string[];
  trigger: string; // What caused the change?
}
```

---

## 🔬 **Extraction Methods**

### Method 1: Frequency Analysis (Simple)

```typescript
const extractValueFromFrequency = Effect.gen(function* (userId: string) {
  const db = yield* DatabaseService;

  // Count mentions of value-related keywords
  const familyMentions = yield* db.query(sql`
    SELECT COUNT(*)
    FROM messages
    WHERE user_id = ${userId}
      AND (content LIKE '%family%' OR content LIKE '%parents%' OR content LIKE '%siblings%')
  `);

  const careerMentions = yield* db.query(sql`
    SELECT COUNT(*)
    FROM messages
    WHERE user_id = ${userId}
      AND (content LIKE '%work%' OR content LIKE '%job%' OR content LIKE '%career%')
  `);

  // Normalize by total messages
  const totalMessages = yield* db.query(sql`SELECT COUNT(*) FROM messages WHERE user_id = ${userId}`);

  const familyScore = familyMentions / totalMessages;
  const careerScore = careerMentions / totalMessages;

  return { family: familyScore, career: careerScore };
});
```

**Problem**: Too simplistic. Mentioning "family" doesn't mean you value it.

---

### Method 2: Sentiment + Context Analysis (Better)

```typescript
const extractValueFromSentiment = Effect.gen(function* (userId: string, value: string) {
  const vectorStore = yield* VectorStoreService;
  const ai = yield* AIServiceTag;

  // 1. Find messages related to this value
  const relatedMessages = yield* vectorStore.search(
    `Messages about ${value}`,
    50
  );

  // 2. Analyze sentiment when discussing this topic
  const sentimentScores = yield* Effect.all(
    relatedMessages.map(msg =>
      ai.analyzeSentiment(msg.text)
    )
  );

  const avgSentiment = sentimentScores.reduce((sum, s) => sum + s.score, 0) / sentimentScores.length;

  // 3. Frequency of positive mentions
  const positiveMentions = sentimentScores.filter(s => s.score > 0.6).length;

  // 4. Combine: frequency + sentiment = value score
  const valueScore = (positiveMentions / relatedMessages.length) * avgSentiment;

  return valueScore;
});
```

**Better**: Considers both how often AND how positively they talk about it.

---

### Method 3: Behavioral Action Analysis (Best)

```typescript
const extractValueFromActions = Effect.gen(function* (userId: string) {
  const db = yield* DatabaseService;

  // Values revealed by ACTIONS, not just words

  // 1. Family value: How often do they initiate family-related activities?
  const familyActions = yield* db.query(sql`
    SELECT COUNT(*)
    FROM messages
    WHERE user_id = ${userId}
      AND (content LIKE '%visit parents%'
           OR content LIKE '%call mom%'
           OR content LIKE '%family dinner%')
      AND is_action = true  -- They DID it, not just talked about it
  `);

  // 2. Adventure value: Do they suggest trying new things?
  const adventureActions = yield* db.query(sql`
    SELECT COUNT(*)
    FROM messages
    WHERE user_id = ${userId}
      AND (content LIKE '%let\'s try%'
           OR content LIKE '%new place%'
           OR content LIKE '%never done%')
  `);

  // 3. Stability value: How often do they plan ahead?
  const planningActions = yield* db.query(sql`
    SELECT AVG(days_ahead)
    FROM activities
    WHERE user_id = ${userId}
      AND was_planned = true
  `);

  return {
    family: familyActions,
    adventure: adventureActions,
    stability: planningActions > 7 ? 0.8 : 0.3 // Plans >1 week ahead = values stability
  };
});
```

**Best**: Actions reveal true values. "I value family" < "I visit family every week"

---

### Method 4: AI-Powered Perspective Extraction (Most Sophisticated)

```typescript
const buildPerspectiveProfile = Effect.gen(function* (userId: string) {
  const vectorStore = yield* VectorStoreService;
  const ai = yield* AIServiceTag;
  const db = yield* DatabaseService;

  // 1. Get representative message sample
  const messages = yield* db.getRecentMessages(userId, 200);

  // 2. Get diverse message types (not just recent)
  const emotionalMessages = yield* vectorStore.search('emotional vulnerable feelings', 20);
  const decisionMessages = yield* vectorStore.search('decided chose picked prioritized', 20);
  const conflictMessages = yield* vectorStore.search('disagreement frustrated angry upset', 10);
  const joyMessages = yield* vectorStore.search('excited happy love amazing', 20);

  // 3. Construct comprehensive analysis prompt
  const analysisPrompt = `
You are a behavioral psychologist analyzing someone's communication patterns.

Based on 200 recent messages + key moments (emotional, decisions, conflicts, joys),
extract a deep psychological profile.

RECENT MESSAGES (chronological sample):
${messages.slice(0, 50).map(m => `- ${m.content}`).join('\n')}

EMOTIONAL MOMENTS:
${emotionalMessages.map(m => `- ${m.text}`).join('\n')}

DECISION POINTS (reveals priorities):
${decisionMessages.map(m => `- ${m.text}`).join('\n')}

CONFLICTS (reveals conflict style):
${conflictMessages.map(m => `- ${m.text}`).join('\n')}

JOY MOMENTS (reveals what they value):
${joyMessages.map(m => `- ${m.text}`).join('\n')}

---

Extract and score (0-1):

1. VALUES (What matters most to them):
   - Family connection: [score]
   - Career achievement: [score]
   - Adventure/novelty: [score]
   - Stability/security: [score]
   - Personal growth: [score]
   - Creative expression: [score]
   - Social impact: [score]

2. TRAITS (Big 5 + additional):
   - Openness: [score]
   - Conscientiousness: [score]
   - Extraversion: [score]
   - Agreeableness: [score]
   - Neuroticism: [score]
   - Optimism: [score]
   - Humor: [score]

3. RELATIONAL STYLE:
   - Attachment style: [secure/anxious/avoidant/fearful-avoidant]
   - Love languages (rank 1-5):
     1. [language]
     2. [language]
     ...
   - Conflict style: [confront/avoid/compromise/problem-solve]
   - Support style: [advice/listen/cheerleader/problem-solver]

4. WORLDVIEW (narrative):
   Write 2-3 sentences capturing their core perspective on life.

5. RELATIONSHIP GOALS:
   What do they want from a romantic partnership? (3 key things)

6. EVIDENCE:
   For each major claim, cite specific message content.

Return as JSON.
`;

  const profile = yield* ai.generateStructuredOutput(analysisPrompt, {
    schema: PerspectiveProfileSchema
  });

  return profile;
});
```

**Most powerful**: Uses AI to synthesize qualitative patterns across hundreds of messages.

---

## 🔄 **Continuous Refinement**

### Seed → Evolve → Refine Loop

```
Stage 1: SEED (First 50 messages)
├─ Basic signals only (communication style, topics mentioned)
├─ Low confidence (0.3)
└─ Rough estimates of values/traits

Stage 2: INITIAL PROFILE (100-200 messages)
├─ First AI analysis
├─ Medium confidence (0.6)
└─ Testable hypotheses about perspective

Stage 3: VALIDATION (200-500 messages)
├─ Compare predictions vs actual behavior
├─ Adjust scores based on evidence
├─ High confidence (0.8)

Stage 4: MATURE PROFILE (500+ messages)
├─ Deep understanding
├─ Can predict preferences with accuracy
├─ Very high confidence (0.9+)
└─ Continuous micro-adjustments
```

### Refinement Triggers

```typescript
const shouldRefineProfile = Effect.gen(function* (userId: string) {
  const profile = yield* getProfile(userId);
  const triggers = [];

  // Trigger 1: New data threshold
  const messagesSinceLastUpdate = yield* db.query(sql`
    SELECT COUNT(*)
    FROM messages
    WHERE user_id = ${userId}
      AND timestamp > ${profile.lastUpdated}
  `);

  if (messagesSinceLastUpdate > 50) {
    triggers.push('new_data_threshold');
  }

  // Trigger 2: Prediction failure
  const recentPredictions = yield* getPredictions(userId);
  const failureRate = recentPredictions.filter(p => p.correct === false).length / recentPredictions.length;

  if (failureRate > 0.3) {
    triggers.push('prediction_failure');
  }

  // Trigger 3: Significant life event
  const recentMessages = yield* db.getRecentMessages(userId, 10);
  const lifeEvents = yield* detectLifeEvents(recentMessages);
  // e.g., "new job", "moving", "family crisis", "engagement"

  if (lifeEvents.length > 0) {
    triggers.push('life_event');
  }

  // Trigger 4: Behavioral shift
  const recentBehavior = yield* analyzeBehavior(userId, days: 30);
  const historicalBehavior = yield* analyzeBehavior(userId, days: 180);
  const divergence = calculateDivergence(recentBehavior, historicalBehavior);

  if (divergence > 0.4) {
    triggers.push('behavioral_shift');
  }

  return triggers;
});

// If any triggers, refine profile
if (triggers.length > 0) {
  yield* refineProfile(userId, { reason: triggers });
}
```

### Evolution Tracking

```typescript
interface ProfileEvolution {
  userId: string;
  snapshots: Array<{
    timestamp: Date;
    values: ValueScores;
    traits: TraitScores;
    trigger: string; // Why did we update?
  }>;
}

// Example evolution:
const evolution = {
  userId: 'user123',
  snapshots: [
    {
      timestamp: '2025-01-01',
      values: { career: 0.8, family: 0.5 },
      trigger: 'initial_seed'
    },
    {
      timestamp: '2025-03-15',
      values: { career: 0.8, family: 0.7 },
      trigger: 'new_data_threshold',
      note: 'Started mentioning parents more frequently'
    },
    {
      timestamp: '2025-06-01',
      values: { career: 0.6, family: 0.85 },
      trigger: 'life_event',
      note: 'Mother diagnosed with illness - family became priority'
    }
  ]
};
```

---

## 🏢 **Enterprise Equivalent: Lead Intelligence & Customer 360**

### What Is This in B2B?

| LifeOps (Personal) | Enterprise (B2B) | Tool Example |
|---------------------|------------------|--------------|
| Perspective Profile | Lead Score + Persona | Salesforce Einstein, HubSpot |
| Value Extraction | Buyer Intent Signals | 6sense, Demandbase |
| Behavioral Signals | Engagement Metrics | Mixpanel, Amplitude |
| Worldview Analysis | Psychographic Profiling | Clearbit, ZoomInfo |
| Continuous Refinement | Lead Scoring Automation | Marketo, Pardot |

### B2B Lead Intelligence Components

**1. Firmographic Data** (Company facts)
```javascript
// Enterprise equivalent of "basic demographics"
{
  company: "Acme Corp",
  industry: "SaaS",
  size: "500-1000 employees",
  revenue: "$50M-$100M",
  location: "San Francisco, CA"
}
```

**LifeOps equivalent**: Basic user data (age, location, occupation)

---

**2. Technographic Data** (Tech stack)
```javascript
{
  usesTools: ["Salesforce", "HubSpot", "Slack"],
  budget: "Enterprise tier",
  decisionMaker: true
}
```

**LifeOps equivalent**: Communication tools used (WhatsApp, Instagram, etc.)

---

**3. Behavioral Signals** (Intent)
```javascript
{
  websiteVisits: 15,
  pricingPageViews: 3,
  downloadedWhitepaper: true,
  emailEngagement: 0.7,
  lastActive: "2 hours ago"
}
```

**LifeOps equivalent**: Message frequency, response times, engagement patterns

---

**4. Psychographic Profile** (Values, motivations)
```javascript
{
  buyingMotivation: "efficiency",  // vs "innovation", "cost-saving"
  decisionStyle: "analytical",     // vs "relationship-driven", "risk-averse"
  priorities: ["ROI", "integration", "support"],
  painPoints: ["manual processes", "lack of visibility"]
}
```

**LifeOps equivalent**: Values (adventure, stability), traits (analytical, spontaneous)

---

**5. Lead Scoring Model**
```javascript
Score = (
  (Firmographic fit × 0.3) +
  (Behavioral engagement × 0.4) +
  (Buying intent signals × 0.3)
)

// Example:
Lead "Acme Corp":
  Firmographic: 0.9 (perfect ICP match)
  Behavioral: 0.7 (high engagement)
  Intent: 0.8 (pricing page views + demo request)

  Total Score: 0.79 → HIGH PRIORITY LEAD
```

**LifeOps equivalent**: Confidence score in perspective profile (0-1)

---

**6. Next Best Action** (Recommendation engine)
```javascript
// Based on lead profile, suggest next action
if (lead.score > 0.7 && lead.viewedPricing && !lead.requestedDemo) {
  recommend("Send personalized demo invitation");
} else if (lead.score < 0.4 && lead.emailEngagement < 0.2) {
  recommend("Nurture with educational content");
}
```

**LifeOps equivalent**: Activity suggestions, message drafts based on perspective

---

### The Parallel

| B2B Lead Intelligence | LifeOps Perspective Engine |
|-----------------------|-----------------------------|
| **Goal**: Convert lead to customer | **Goal**: Deepen relationship |
| **Data**: Website activity, email engagement | **Data**: Messages, activities, photos |
| **Analysis**: Buyer intent, pain points | **Analysis**: Values, emotional needs, preferences |
| **Output**: Lead score, next action | **Output**: Confidence score, activity suggestions |
| **Refinement**: Behavior → update score | **Refinement**: New messages → update profile |

**Core insight**: Both are trying to deeply understand a person/company to predict needs and suggest optimal actions.

---

## 🎯 **Implementation Roadmap**

### Phase 1: Basic Signals (Weeks 1-2)

```typescript
// Track observable facts
interface BasicSignals {
  communicationStyle: {
    avgResponseTime: number;
    avgMessageLength: number;
    emojiUsage: number;
  };
  activityFrequency: {
    outdoor: number;
    food: number;
    cultural: number;
  };
  emotionalBaseline: 'positive' | 'neutral' | 'negative';
}

// Extract from existing messages
const extractBasicSignals = Effect.gen(function* (userId) {
  const messages = yield* db.getMessages(userId);

  return {
    avgResponseTime: calculateAvgResponseTime(messages),
    avgMessageLength: messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length,
    emojiUsage: countEmojis(messages) / messages.length
  };
});
```

### Phase 2: Value Extraction (Weeks 3-4)

```typescript
// Analyze what they value
const extractValues = Effect.gen(function* (userId) {
  const vectorStore = yield* VectorStoreService;
  const ai = yield* AIServiceTag;

  const valueCategories = ['family', 'career', 'adventure', 'stability', 'creativity'];

  const scores = {};
  for (const value of valueCategories) {
    // Find related messages
    const messages = yield* vectorStore.search(`${value} important matters priority`, 20);

    // Analyze sentiment + frequency
    const score = yield* calculateValueScore(messages, value);
    scores[value] = score;
  }

  return scores;
});
```

### Phase 3: AI-Powered Profile (Weeks 5-6)

```typescript
// Full perspective extraction
const buildFullProfile = Effect.gen(function* (userId) {
  const messages = yield* db.getRecentMessages(userId, 200);
  const emotionalMoments = yield* vectorStore.search('emotional vulnerable', 20);
  const decisions = yield* vectorStore.search('decided chose', 20);

  const profile = yield* ai.generateStructuredOutput(
    buildAnalysisPrompt(messages, emotionalMoments, decisions),
    { schema: PerspectiveProfileSchema }
  );

  // Store in database
  yield* db.upsertProfile(userId, profile);

  return profile;
});
```

### Phase 4: Continuous Refinement (Weeks 7-8)

```typescript
// Background job: refine profiles
cron.schedule('0 0 * * *', async () => {
  // Daily: check if any profiles need updating
  const usersToRefine = await detectUsersNeedingRefinement();

  for (const userId of usersToRefine) {
    await refineProfile(userId);
  }
});

const refineProfile = Effect.gen(function* (userId) {
  const currentProfile = yield* getProfile(userId);
  const newMessages = yield* getMessagesSince(currentProfile.lastUpdated);

  if (newMessages.length > 50) {
    // Re-run extraction on ALL messages (including new ones)
    const updatedProfile = yield* buildFullProfile(userId);

    // Log evolution
    yield* db.insertEvolution({
      userId,
      previousProfile: currentProfile,
      newProfile: updatedProfile,
      trigger: 'new_data_threshold',
      messageCount: newMessages.length
    });
  }
});
```

---

## 📊 **Database Schema**

```sql
-- Perspective profiles table
CREATE TABLE perspective_profiles (
  user_id TEXT PRIMARY KEY,

  -- Metadata
  confidence REAL NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  message_count INTEGER NOT NULL, -- How many messages analyzed

  -- Layer 2: Attributes (stored as JSON)
  values JSONB NOT NULL,
  traits JSONB NOT NULL,
  preferences JSONB NOT NULL,

  -- Layer 1: Signals (stored as JSON)
  communication_signals JSONB NOT NULL,
  activity_signals JSONB NOT NULL,
  emotional_signals JSONB NOT NULL,
  relational_signals JSONB NOT NULL,

  -- Layer 3: Worldview
  worldview_narrative TEXT,
  core_principles JSONB, -- Array of strings
  driving_motivations JSONB,
  relationship_goals JSONB,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Evidence table (links profile claims to messages)
CREATE TABLE profile_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  attribute_path TEXT NOT NULL, -- e.g., "values.family"
  message_ids JSONB NOT NULL, -- Array of message IDs
  confidence REAL NOT NULL,
  last_observed TIMESTAMP NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Evolution history
CREATE TABLE profile_evolution (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  changed_attributes JSONB NOT NULL, -- Array of attribute paths
  trigger TEXT NOT NULL, -- "new_data_threshold", "life_event", etc.
  previous_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for fast queries
CREATE INDEX idx_profiles_user ON perspective_profiles(user_id);
CREATE INDEX idx_evidence_user ON profile_evidence(user_id);
CREATE INDEX idx_evolution_user ON profile_evolution(user_id);
CREATE INDEX idx_evolution_timestamp ON profile_evolution(timestamp DESC);
```

---

## 🎯 **Using Perspectives for Better Suggestions**

### Example 1: Activity Suggestions

```typescript
const suggestActivity = Effect.gen(function* (chatId: string) {
  // Get both profiles
  const userProfile = yield* getProfile(user.id);
  const partnerProfile = yield* getProfile(partner.id);

  // Find overlap in values
  const sharedValues = findOverlap(userProfile.values, partnerProfile.values);
  // → { adventure: 0.8, nature: 0.7 } (both value these)

  // Find complementary traits
  const complementary = findComplementary(userProfile.traits, partnerProfile.traits);
  // → User is spontaneous (0.8), Partner is planner (0.7)
  // → Suggestion should be: exciting but with some structure

  // Generate activity
  const suggestion = yield* ai.generateText(`
    Suggest an activity that:
    - Aligns with shared values: ${JSON.stringify(sharedValues)}
    - Respects trait balance: ${JSON.stringify(complementary)}

    User profile: ${userProfile.worldview.narrative}
    Partner profile: ${partnerProfile.worldview.narrative}

    The activity should appeal to both while honoring their differences.
  `);

  return suggestion;
});
```

### Example 2: Conflict Prediction

```typescript
const predictConflictRisk = Effect.gen(function* (chatId: string) {
  const userProfile = yield* getProfile(user.id);
  const partnerProfile = yield* getProfile(partner.id);

  // Value conflicts
  if (userProfile.values.freedom > 0.8 && partnerProfile.values.stability > 0.8) {
    return {
      risk: 'high',
      reason: 'Fundamental value tension: freedom vs stability',
      suggestion: 'Discuss long-term plans explicitly'
    };
  }

  // Conflict style mismatch
  if (userProfile.emotional.conflictStyle === 'confront' &&
      partnerProfile.emotional.conflictStyle === 'avoid') {
    return {
      risk: 'medium',
      reason: 'Conflict style mismatch: one confronts, one avoids',
      suggestion: 'Agree on "conflict rules" beforehand'
    };
  }

  return { risk: 'low' };
});
```

---

## 📝 **Summary**

### What the Perspective Engine Does

1. **Extracts** values, traits, preferences from messages
2. **Infers** deep psychological patterns (worldview, motivations)
3. **Refines** continuously as more data arrives
4. **Predicts** what will resonate with each person
5. **Suggests** activities/messages tailored to their perspective

### How It Works

- **Layer 1**: Observable signals (frequency, sentiment, actions)
- **Layer 2**: Inferred attributes (values, traits, preferences)
- **Layer 3**: Synthesized worldview (narrative understanding)

### Enterprise Equivalent

- **B2B Lead Intelligence**: Same concept (understand buyer to predict needs)
- **Customer 360**: Comprehensive profile for personalization
- **Lead Scoring**: Confidence score + next best action

### Implementation Priority

1. ✅ Basic signals (communication style, activity frequency)
2. ✅ Value extraction (what matters to them)
3. ✅ AI-powered full profile (deep analysis)
4. ✅ Continuous refinement (update as they evolve)

---

**This is the intelligence layer that makes LifeOps truly powerful**: Understanding WHO people are, not just WHAT they do.

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
