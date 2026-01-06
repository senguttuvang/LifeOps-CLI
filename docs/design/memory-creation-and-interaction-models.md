# Memory Creation & Bot Interaction Models

> **Context**: How users interact with LifeOps AI to create new memories, not just analyze existing ones. Moving from passive understanding to active orchestration.

**Last Updated**: 2026-01-05
**Status**: Design & Architecture

---

## 🎯 Core Shift: Analysis → Creation

### From Passive to Active AI
```
BEFORE (Passive):
├─ Read message history
├─ Analyze patterns
└─ Generate insights report

AFTER (Active):
├─ Read message history
├─ Analyze patterns
├─ SUGGEST new experiences
├─ ORCHESTRATE memory creation
├─ CAPTURE & IMMORTALIZE moments
└─ BUILD shared cultural vocabulary
```

**Key Insight**: AI doesn't just understand your relationship—it actively enriches it.

---

## 📸 Visual Memory & Meme Creation

### 1. **Photo Analysis for Inside Jokes**

#### Capability: Multi-Modal RAG
```typescript
interface PhotoMemory {
  imageUrl: string;
  embedding: number[]; // CLIP embedding for visual similarity
  caption?: string;
  detectedObjects: string[];
  detectedFaces: number;
  location?: { lat: number; lng: number };
  timestamp: Date;
  associatedMessages: Message[]; // Messages sent around same time
  memeTemplateMatch?: string; // "Is this a meme format we know?"
}
```

#### Implementation Flow:
```typescript
const analyzeSharedPhoto = Effect.gen(function* () {
  // 1. Extract photo from WhatsApp message
  const photo = yield* extractMediaFromMessage(messageId);

  // 2. Visual analysis (OpenAI Vision or local CLIP model)
  const analysis = yield* ai.analyzeImage(photo, {
    tasks: ['object_detection', 'scene_classification', 'text_extraction']
  });

  // 3. Context fusion: photo + surrounding messages
  const contextMessages = yield* db.getMessagesAround(messageId, window: 10);
  const conversationContext = contextMessages.map(m => m.content).join('\n');

  // 4. Generate memory caption
  const caption = yield* ai.generateText(`
    Photo shows: ${analysis.objects.join(', ')}
    Context from chat: "${conversationContext}"

    Generate a nostalgic caption that could become an inside joke.
    Format: "[Funny observation] - [Date reference]"
  `);

  // 5. Store as searchable memory
  yield* vectorStore.addDocuments([{
    id: `photo-${messageId}`,
    text: `${caption} | Objects: ${analysis.objects.join(', ')}`,
    vector: analysis.imageEmbedding,
    metadata: {
      type: 'photo_memory',
      timestamp: photo.timestamp,
      associatedMessages: contextMessages.map(m => m.id)
    }
  }]);

  return { caption, memeTemplate: analysis.memeMatch };
});
```

#### Example Outputs:
```
Photo: [Blurry sunset photo]
Context: Messages saying "We stayed too long at the beach lol"
Caption: "The Great Beach Miscalculation of 2025 🌅"
→ Becomes searchable: "Remember that beach sunset?"

Photo: [Partner making weird face while cooking]
Context: Messages joking about "experimental pasta night"
Caption: "Chef's Regret™ - The Pasta Incident"
→ AI later suggests: "Want to do another experimental cooking night?"
```

---

### 2. **Cultural Meme Library (Private Vocabulary)**

#### Concept: Track recurring visual/textual patterns that become "yours"

```typescript
interface PrivateMeme {
  id: string;
  name: string; // "The Look™"
  description: string;
  occurrences: MemeOccurrence[];
  firstSeen: Date;
  category: 'photo' | 'phrase' | 'reaction' | 'situation';
  embeddings: number[]; // For similarity search
  context: string; // When/why you use it
}

interface MemeOccurrence {
  messageId: string;
  timestamp: Date;
  variant?: string; // "Extra dramatic version"
}
```

#### Auto-Detection:
```typescript
const detectEmergingMeme = Effect.gen(function* () {
  // Find repeated phrases/reactions
  const phrases = yield* db.query(`
    SELECT content, COUNT(*) as freq
    FROM messages
    WHERE LENGTH(content) < 50  -- Short enough to be meme-able
    GROUP BY content
    HAVING freq > 5  -- Repeated at least 5 times
  `);

  for (const phrase of phrases) {
    // Check if already cataloged
    const existing = yield* vectorStore.search(phrase.content, 1);
    if (existing.length === 0) {
      // New meme detected!
      yield* notifyUser({
        type: 'meme_discovery',
        content: `Detected new inside phrase: "${phrase.content}"`,
        question: 'Want to name this meme and track when you use it?'
      });
    }
  }
});
```

#### Example Memes:
```typescript
const exampleMemes = [
  {
    name: "The Look™",
    description: "When Partner gives disapproving-but-loving face",
    occurrences: [
      { date: '2025-03-12', context: 'User suggested skydiving' },
      { date: '2025-05-08', context: 'User bought another keyboard' },
      { date: '2025-09-01', context: 'User wanted pizza for breakfast' }
    ],
    aiSuggestion: "Noticed 'The Look™' usually happens when you suggest impulsive adventures. Want a game around predicting when it'll happen?"
  },

  {
    name: "Emergency Cheese Protocol",
    description: "When stressed, Partner requests specific cheese + crackers",
    occurrences: [
      { date: '2025-02-14', context: 'Work deadline stress' },
      { date: '2025-04-20', context: 'Family drama' },
      { date: '2025-08-10', context: 'Moving day chaos' }
    ],
    aiSuggestion: "Partner hasn't invoked Emergency Cheese Protocol in 3 months (usually every 6 weeks). Things are going well! 🧀"
  }
];
```

---

### 3. **Photo-Based Activity Suggestions**

#### Concept: Analyze past activity photos → suggest similar new experiences

```typescript
const suggestActivityFromPhotos = Effect.gen(function* () {
  // 1. Cluster photos by activity type
  const photoEmbeddings = yield* vectorStore.search('activity photos', 100);
  const clusters = yield* clusterByVisualSimilarity(photoEmbeddings);

  // Example clusters:
  // - Cluster 1: Hiking photos (mountains, trails, outdoor gear)
  // - Cluster 2: Food photos (restaurants, cooking together)
  // - Cluster 3: Travel photos (airports, landmarks, hotels)

  // 2. For each cluster, identify common elements
  const hikingCluster = clusters.find(c => c.label === 'outdoor_activities');
  const commonElements = extractCommonElements(hikingCluster.photos);
  // → ["mountains", "backpacks", "sunrise", "wide_landscapes"]

  // 3. Find NEW activities with similar elements
  const suggestion = yield* ai.generateText(`
    They've done these hiking activities:
    ${hikingCluster.photos.map(p => p.caption).join('\n')}

    Common elements: ${commonElements.join(', ')}

    Suggest 3 NEW outdoor activities they haven't done but would match their style.
    Format: Activity name + Why it fits + How to start
  `);

  return suggestion;
});
```

#### Example Output:
```
Analyzed 23 hiking photos from past year:
Common patterns:
- Always sunrise/sunset timing (golden hour lovers)
- Prefer moderate trails (3-5 miles)
- Bring elaborate picnic setups
- Avoid crowded popular spots

NEW SUGGESTIONS:
1. "Sunrise kayaking + breakfast on the water"
   Why: Combines sunrise timing + nature + food ritual
   How: Rent kayaks at [Local Lake], launch 6am, pack thermoses

2. "Wildflower meadow picnic photography"
   Why: Scenic beauty + photography + elaborate food setup
   How: [National Park] peak bloom is May 15-30, permits available

3. "Full moon night hike + stargazing"
   Why: Less crowded (night time) + nature immersion + novelty
   How: [Trail Name] allows night hiking, next full moon is [Date]
```

---

## 💬 User Interaction Models (How to Talk to the Bot)

### Model 1: **Special Message Tags** (Explicit Invocation)

#### Syntax: `@lifeops <command> [arguments]`

```
User: @lifeops analyze recent
Bot: Analyzing last 50 messages...
     [Generates relationship state report]

User: @lifeops suggest activity outdoor
Bot: Based on your hiking history, here are 3 new adventures...

User: @lifeops meme "The Look™"
Bot: "The Look™" has occurred 47 times since Jan 2025.
     Most common trigger: Your impulsive ideas 😄
     Last occurrence: 3 days ago when you suggested "midnight beach trip"

User: @lifeops memory beach sunset 2025
Bot: Found 3 beach sunset memories:
     1. "The Great Beach Miscalculation" - May 12
     2. "Perfect Golden Hour" - July 4
     3. "Sunset Proposal Spot" - Aug 20
     [Shows photos + associated messages]

User: @lifeops draft apology
Bot: Based on your communication style...
     "Hey, I realize I was pushy about the [topic] earlier..."
```

#### Implementation:
```typescript
const parseCommand = (message: string) => {
  const tagPattern = /^@lifeops\s+(\w+)(?:\s+(.+))?$/;
  const match = message.match(tagPattern);

  if (!match) return null;

  const [_, command, args] = match;
  return { command, args: args?.trim() };
};

const handleBotCommand = Effect.gen(function* (message: Message) {
  const parsed = parseCommand(message.content);
  if (!parsed) return; // Not a bot command

  const { command, args } = parsed;

  switch (command) {
    case 'analyze':
      return yield* analyzeRelationship(message.chatId, args);

    case 'suggest':
      return yield* suggestActivity(message.chatId, args);

    case 'meme':
      return yield* lookupMeme(args);

    case 'memory':
      return yield* searchMemory(args);

    case 'draft':
      return yield* draftMessage(message.chatId, args);

    case 'create':
      return yield* createMemoryPrompt(message.chatId, args);

    default:
      return "Unknown command. Try: analyze, suggest, meme, memory, draft, create";
  }
});
```

---

### Model 2: **Natural Language (Intent Detection)**

#### User can talk naturally, AI detects intent

```
User: "What should we do this weekend?"
→ AI detects: activity_suggestion_request
Bot: Based on your past adventures (15 hiking trips, 8 food experiences)...
     Here are 3 ideas tailored to you two:
     [Generates suggestions]

User: "What was that funny thing Partner said about pizza?"
→ AI detects: memory_search_request
Bot: Searching for pizza-related memories...
     Found 3 instances:
     1. "Pizza is a vegetable if you believe hard enough" - Feb 14
     2. "Pineapple pizza is the hill I'll die on" - Mar 3
     3. "Emergency pizza protocol activated" - May 12

User: "I want to surprise Partner with something special"
→ AI detects: surprise_planning_request
Bot: Let me analyze what Partner loves...
     [RAG search for: past positive reactions, mentioned desires, bucket list items]

     Based on history:
     - Partner loved the "spontaneous picnic" surprise (May 5)
     - Mentioned wanting to "learn pottery" 3 times
     - Gets excited about "handwritten notes"

     Suggestion: Book a couples' pottery class + write a note explaining why
```

#### Implementation:
```typescript
const detectIntent = Effect.gen(function* (message: string) {
  const intentPrompt = `
    Classify user intent for relationship bot:

    Message: "${message}"

    Possible intents:
    - activity_suggestion_request
    - memory_search_request
    - relationship_analysis_request
    - message_draft_request
    - surprise_planning_request
    - meme_lookup_request
    - conflict_resolution_help
    - appreciation_prompt_request

    Return JSON: { intent: string, confidence: number, extractedEntities: {} }
  `;

  const result = yield* ai.generateStructuredOutput(intentPrompt);
  return result;
});

const handleNaturalLanguage = Effect.gen(function* (message: Message) {
  const intent = yield* detectIntent(message.content);

  if (intent.confidence < 0.6) {
    return "I'm not sure what you're asking. Try: @lifeops help";
  }

  switch (intent.intent) {
    case 'activity_suggestion_request':
      const preferences = intent.extractedEntities.activityType || 'any';
      return yield* suggestActivity(message.chatId, preferences);

    case 'memory_search_request':
      const query = intent.extractedEntities.searchQuery;
      return yield* searchMemory(query);

    // ... handle other intents
  }
});
```

---

### Model 3: **Proactive Suggestions** (Bot Initiates)

#### Bot notices opportunities and suggests without being asked

```
[Bot detects: Partner mentioned "stressful week" 3x, User hasn't sent support]
Bot → User (private): "Partner seems stressed this week. Want to send a care package idea?"
        [Suggests: favorite snacks + handwritten note + funny meme]

[Bot detects: Both mentioned "missing nature" in past week]
Bot → Group: "You both seem to crave nature lately! Want to plan a micro-adventure this weekend?"
        [Links to 3 nearby hiking trails you haven't tried]

[Bot detects: Anniversary coming up in 2 weeks]
Bot → User (private): "2-week anniversary reminder! Want help planning something special?"
        Options:
        A) Recreate your first date (I found details from May 2024 messages)
        B) New experience based on your shared interests
        C) Just send me gift ideas
        D) Ignore (not celebrating this one)

[Bot detects: Photo shared with elements from past fun memories]
Bot → Group: "This photo reminds me of your 'Sunset Picnic Era' from summer 2025! Want to recreate it?"
```

#### Implementation:
```typescript
const proactiveMonitor = Effect.gen(function* () {
  // Run every 6 hours
  const recentMessages = yield* db.getRecentMessages(chatId, hours: 6);

  // Check triggers
  const triggers = yield* detectProactiveTriggers(recentMessages);

  for (const trigger of triggers) {
    switch (trigger.type) {
      case 'stress_support_needed':
        yield* sendPrivateSuggestion({
          to: trigger.supporterUserId,
          message: `${trigger.partnerName} seems stressed. Send support?`,
          suggestions: yield* generateSupportIdeas(trigger.context)
        });
        break;

      case 'shared_desire_detected':
        yield* sendGroupSuggestion({
          message: `You both want ${trigger.desire}! Plan it together?`,
          suggestions: yield* generateActionPlan(trigger.desire)
        });
        break;

      case 'upcoming_occasion':
        yield* sendPrivateReminder({
          to: trigger.reminderRecipient,
          message: `${trigger.occasion} in ${trigger.daysAway} days!`,
          helpOptions: ['plan_surprise', 'gift_ideas', 'recreate_memory', 'ignore']
        });
        break;

      case 'memory_recreation_opportunity':
        yield* sendGroupSuggestion({
          message: `This reminds me of ${trigger.pastMemory.name}! Recreate?`,
          context: trigger.pastMemory.photos
        });
        break;
    }
  }
});

const detectProactiveTriggers = (messages: Message[]) => {
  const triggers = [];

  // Pattern: Stress mentions without support response
  const stressMentions = messages.filter(m =>
    m.sentiment === 'stressed' || m.content.match(/stressed|overwhelming|tough week/i)
  );
  if (stressMentions.length >= 3) {
    const supportMessages = messages.filter(m =>
      m.sentiment === 'supportive' && m.sender !== stressMentions[0].sender
    );
    if (supportMessages.length === 0) {
      triggers.push({ type: 'stress_support_needed', ... });
    }
  }

  // Pattern: Both mention same desire
  const desires = extractDesires(messages);
  const sharedDesires = desires.filter(d => d.mentionedBy.size > 1);
  if (sharedDesires.length > 0) {
    triggers.push({ type: 'shared_desire_detected', desire: sharedDesires[0] });
  }

  // Pattern: Upcoming occasion (from calendar or known dates)
  const occasions = checkUpcomingOccasions();
  if (occasions.length > 0 && occasions[0].daysAway <= 14) {
    triggers.push({ type: 'upcoming_occasion', occasion: occasions[0] });
  }

  return triggers;
};
```

---

### Model 4: **Slash Commands** (WhatsApp Business API)

#### Quick commands via WhatsApp menu

```
/analyze → Relationship state report
/suggest → Activity ideas
/memory <query> → Search memories
/meme <name> → Lookup inside joke
/draft <intent> → Draft message
/create → Start memory creation flow
/remind <what> <when> → Set reminder
/appreciate → Appreciation prompt
/game → Start random relationship game
```

#### Implementation via WhatsApp Business API:
```typescript
const whatsappCommands = {
  '/analyze': analyzeRelationship,
  '/suggest': suggestActivity,
  '/memory': searchMemory,
  '/meme': lookupMeme,
  '/draft': draftMessage,
  '/create': startMemoryCreation,
  '/remind': setReminder,
  '/appreciate': appreciationPrompt,
  '/game': startRandomGame
};

const handleSlashCommand = Effect.gen(function* (message: Message) {
  const [command, ...args] = message.content.split(' ');
  const handler = whatsappCommands[command];

  if (!handler) {
    return `Unknown command: ${command}. Try /help`;
  }

  return yield* handler(message.chatId, args.join(' '));
});
```

---

## 🎨 Memory Creation Flows

### Flow 1: **Guided Memory Capture**

```
User: @lifeops create memory

Bot: Great! Let's capture a memory. What type?
     A) Photo memory (upload photo + story)
     B) Text memory (describe a moment)
     C) Activity recap (what did you do together?)
     D) Inside joke (name + origin story)

User: [Selects C - Activity recap]

Bot: What activity did you do?
User: "We tried pottery class"

Bot: Nice! When was this?
User: "Last Saturday"

Bot: How did it go? (Rate 1-5 ⭐)
User: "4"

Bot: What made it special?
User: "We were terrible but laughed the whole time. Partner made a bowl that looked like a hat"

Bot: 😄 Want to add photos? (optional)
User: [Uploads 3 photos]

Bot: Analyzing photos...
     [Detects: pottery wheels, misshapen bowls, laughter expressions]

Bot: Perfect! I've created "The Pottery Disaster of 2026" memory:
     ⭐⭐⭐⭐ | Last Saturday | Pottery Class
     Highlights: "Partner's hat-bowl, lots of laughter"

     Memory saved! Want me to suggest similar activities?
     (Detected you both love: hands-on, creative, low-stakes fun)

User: Yes

Bot: Based on "creative + playful + low-pressure"...
     1. Paint & sip night
     2. Beginner salsa class
     3. Escape room (comedy theme)
```

---

### Flow 2: **Photo Memory Enhancement**

```
[Partner shares photo in chat]

Bot: Love this photo! Want to save it as a memory?
User: Sure

Bot: What should we call this moment?
User: "Beach sunset where we decided to move in together"

Bot: Beautiful! I'll remember this as a significant memory.
     [Analyzing photo for details...]

     Detected:
     - Location: Santa Monica Beach
     - Time: ~7:30pm (based on sunset angle)
     - Mood: Peaceful, intimate

     I've also found your conversation from that evening (May 15, 2025).
     Want me to link the messages to this photo memory?

User: Yes

Bot: Memory created! 🌅
     "Beach Sunset Decision" - May 15, 2025
     Location: Santa Monica Beach
     Significance: Moving in together discussion
     Linked messages: 23 messages from that evening

     Future suggestion: Want a reminder to revisit this spot on your 1-year anniversary?

User: Good idea

Bot: Reminder set for May 15, 2026:
     "One year ago today, you two decided to move in together at this beach.
      Want to visit again and reflect on the year?"
```

---

### Flow 3: **Activity Suggestion → Execution → Memory**

```
User: @lifeops suggest something new

Bot: Analyzing your past activities...
     [RAG search: hiking photos, food adventures, spontaneous trips]

     You two love: Outdoors + food + spontaneity
     Haven't done: Water activities

     NEW SUGGESTION: "Sunrise paddleboard + beach breakfast"
     Why: Combines nature, food ritual, novelty, golden hour timing
     Where: [Local Beach] - rentals available
     When: Next Saturday (weather forecast: perfect ☀️)

     Want me to build a full plan?

User: Yes

Bot: Great! Here's your plan:

     📅 SATURDAY, JAN 11, 2026

     5:45am - Meet at [Beach Name]
     6:00am - Paddleboard rental ($30 total)
     6:15am - Paddle out for sunrise (6:47am)
     7:30am - Return boards, set up beach breakfast
     8:00am - Breakfast setup:
       - Thermoses of coffee (prepare night before)
       - Pastries from [Bakery] (pick up Friday)
       - Fresh fruit + cheese
     9:00am - Pack up, head home

     Want me to:
     A) Add to calendar (both of you)
     B) Set packing reminders
     C) Send weather updates day-of
     D) All of the above

User: D

Bot: Done! ✅
     - Calendar invites sent
     - Packing reminder: Friday 8pm
     - Weather check: Saturday 5am

     I'll also prompt you to capture memories during the activity.
     Have a great adventure! 🏄‍♀️🌅

[DURING THE ACTIVITY - Saturday morning]

Bot: Hope you're having fun! 📸
     Want to capture this as a memory? Reply with:
     - Photo (I'll analyze + save)
     - Quick voice note (I'll transcribe + save)
     - Text description

[AFTER THE ACTIVITY - Saturday afternoon]

Bot: How was sunrise paddleboard? (Rate 1-5 ⭐)
User: 5 stars!

Bot: Amazing! 🎉 Want to create a memory entry?
User: Yes

Bot: Perfect! I'll create "Sunrise Paddleboard Adventure - Jan 11, 2026"

     [Auto-populated from context]:
     - Rating: ⭐⭐⭐⭐⭐
     - Activity type: Water sports + breakfast
     - Weather: Perfect sunny
     - Cost: ~$50 total
     - Photos: 8 uploaded

     Add any notes?

User: "We fell in the water twice but didn't care. Best morning ever."

Bot: 😄 Memory saved!

     Based on this success, want similar water activities?
     (I can suggest: kayaking, snorkeling, sunset sailing...)

User: Later

Bot: No problem! I'll remember you loved this.
     Updating your profile: Water activities = HIGH INTEREST
```

---

## 🧠 Intelligent Activity Suggestion Engine

### Recommendation Algorithm

```typescript
interface ActivityProfile {
  userId: string;
  preferences: {
    categories: { [key: string]: number }; // "outdoor": 0.9, "food": 0.8
    timePreferences: { morning: 0.7, afternoon: 0.5, evening: 0.8 };
    budgetComfort: { low: 0.3, medium: 0.8, high: 0.2 };
    physicalIntensity: { low: 0.3, moderate: 0.9, high: 0.4 };
    noveltySeeker: number; // 0-1 scale
    planningStyle: 'spontaneous' | 'structured';
  };
  pastActivities: Activity[];
  wishlist: string[]; // Extracted from "want to try..." messages
}

const suggestNewActivity = Effect.gen(function* (chatId: string) {
  // 1. Build activity profile from history
  const profile = yield* buildActivityProfile(chatId);

  // 2. Find activity gaps (what haven't they done?)
  const allCategories = ['outdoor', 'food', 'arts', 'sports', 'cultural', 'relaxation'];
  const experiencedCategories = Object.keys(profile.preferences.categories);
  const gaps = allCategories.filter(c => !experiencedCategories.includes(c));

  // 3. RAG search for wishlist items
  const wishlistItems = yield* vectorStore.search('want to try bucket list', 10);
  const extractedWishes = wishlistItems.map(doc =>
    extractDesireFromMessage(doc.text)
  );

  // 4. Generate suggestions
  const suggestions = yield* ai.generateText(`
    Activity profile:
    - Loves: ${JSON.stringify(profile.preferences.categories)}
    - Time preference: ${profile.preferences.timePreferences}
    - Novelty seeking: ${profile.noveltySeeker}

    Unexplored categories: ${gaps.join(', ')}
    Mentioned wanting to try: ${extractedWishes.join(', ')}

    Past activities (for reference, don't repeat):
    ${profile.pastActivities.map(a => a.name).join(', ')}

    Suggest 3 NEW activities that:
    1. Match their preferences (70% similarity)
    2. Introduce novelty (30% new)
    3. Are feasible in their area
    4. Include one from their wishlist if possible

    Format each as:
    NAME | CATEGORY | WHY IT FITS | LOGISTICS | ESTIMATED COST
  `);

  return suggestions;
});
```

---

## 🎮 Interactive Memory Games

### Game 1: "Time Capsule Challenge"

```
Bot: 🎮 Want to play Time Capsule?

     How it works:
     1. Each of you answers 5 questions RIGHT NOW
     2. I lock them in a time capsule
     3. I reveal your answers 1 year from today

     Questions will be about: current feelings, predictions, hopes

     Ready?

Both: Yes

Bot: Great! First question (answer privately, I'll compile later):

     @User: "What's one thing you hope is different about your life in 1 year?"
     @Partner: [Same question sent privately]

     [After both respond privately]

Bot: Q2: "What's your biggest fear about the future right now?"
     [Continue through 5 questions]

     [After all responses collected]

Bot: ✅ Time capsule sealed!
     Set to open: January 5, 2027

     I'll send you both a notification on that date with:
     - Your original answers
     - Reflection prompt: "How did reality compare?"
     - Option to create a new capsule

     Want to set a reminder to revisit this spot when it opens?
```

### Game 2: "Memory Match"

```
Bot: 🎮 Memory Match Game!

     I'll describe a memory from your history.
     Both of you guess: When did this happen? (month + year)
     Closest guess wins a point!

     Ready?

Both: Go

Bot: ROUND 1:
     Memory: "You both went hiking and saw a double rainbow. Partner said 'It's a sign!'"

     @User: When was this?
     @Partner: When was this?

     [After both answer]

Bot: Actual date: May 2025
     @User guessed: April 2025 (1 month off)
     @Partner guessed: May 2025 (exact!)

     Point to @Partner! 🎯

     ROUND 2:
     Memory: "Emergency Cheese Protocol activated. Partner stress-ate an entire brie."
     When was this?

     [Game continues for 10 rounds]

Bot: Final Score:
     @User: 6 points
     @Partner: 8 points

     @Partner wins! 🎉

     Bonus insight: You both remember "emotional" memories better than "logistical" ones.
     The double rainbow (emotional): both close
     The IKEA trip (logistical): both way off 😄
```

---

## 🔔 Smart Notification Strategy

### When to Notify vs Stay Silent

```typescript
interface NotificationStrategy {
  proactivePrompts: {
    maxPerDay: 2;
    preferredTimes: string[]; // ["09:00", "20:00"]
    cooldownPeriod: number; // 6 hours between prompts
    respectDoNotDisturb: boolean;
  };

  responseModes: {
    immediate: string[]; // Commands that need instant response
    batched: string[]; // Insights that can wait for daily digest
    silent: string[]; // Just log, don't notify
  };

  contextAwareness: {
    skipIfDeepConvo: boolean; // Don't interrupt ongoing deep discussion
    skipIfConflict: boolean; // Don't suggest games during argument
    skipIfBusy: boolean; // Detect "in meeting" or travel signals
  };
}

const shouldNotify = Effect.gen(function* (suggestion: Suggestion) {
  // Check notification budget
  const todayCount = yield* db.getNotificationCount(date: today());
  if (todayCount >= 2) return false;

  // Check cooldown
  const lastNotification = yield* db.getLastNotification();
  if (hoursSince(lastNotification) < 6) return false;

  // Check context
  const recentMessages = yield* db.getRecentMessages(limit: 10);

  if (isDeepConversation(recentMessages)) return false;
  if (isConflict(recentMessages)) return false;
  if (isBusy(recentMessages)) return false;

  // Check optimal timing
  const currentHour = new Date().getHours();
  const preferredHours = [9, 20]; // 9am, 8pm
  if (!preferredHours.includes(currentHour)) {
    // Schedule for next preferred time
    yield* scheduleNotification(suggestion, nextPreferredTime());
    return false;
  }

  return true;
});
```

---

## 📊 Privacy & Control

### User Controls
```typescript
interface UserPreferences {
  botBehavior: {
    proactiveMode: boolean; // Bot can initiate suggestions
    responseMode: 'natural' | 'commands-only'; // Intent detection vs explicit
    notificationFrequency: 'high' | 'medium' | 'low';
    personalityStyle: 'playful' | 'professional' | 'minimal';
  };

  dataSharing: {
    analyzePhotos: boolean;
    trackLocations: boolean;
    readCalendar: boolean;
    crossReferenceEmail: boolean;
  };

  memoryCreation: {
    autoCapture: boolean; // Auto-suggest memory creation after activities
    requireConfirmation: boolean; // Always ask before saving
    privateMemoriesEnabled: boolean; // Some memories just for you, not partner
  };

  boundaries: {
    doNotDisturb: { start: '23:00', end: '08:00' };
    excludedTopics: string[]; // Topics to never analyze/suggest
    sensitiveKeywords: string[]; // Alert user if bot encounters these
  };
}
```

---

## 🏗️ Implementation Architecture

### WhatsApp Integration Points

```typescript
// 1. Incoming message webhook
app.post('/webhook/whatsapp', async (req, res) => {
  const message = req.body;

  // Check if directed at bot
  if (message.content.startsWith('@lifeops') || message.content.startsWith('/')) {
    const response = await handleBotCommand(message);
    await sendWhatsAppMessage(message.chatId, response);
  }

  // Natural language detection (if enabled)
  else if (userPreferences.responseMode === 'natural') {
    const intent = await detectIntent(message.content);
    if (intent.confidence > 0.8) {
      const response = await handleNaturalLanguage(message);
      await sendWhatsAppMessage(message.chatId, response);
    }
  }

  // Always: passive analysis for future insights
  await analyzeAndStore(message);

  res.sendStatus(200);
});

// 2. Proactive monitoring (cron job)
cron.schedule('0 */6 * * *', async () => {
  // Every 6 hours, check for proactive opportunities
  const triggers = await detectProactiveTriggers();

  for (const trigger of triggers) {
    if (await shouldNotify(trigger)) {
      await sendProactiveSuggestion(trigger);
    }
  }
});

// 3. Scheduled memories (cron job)
cron.schedule('0 9 * * *', async () => {
  // Every morning at 9am, check for time-based memories
  const todayMemories = await getMemoriesForDate(today());

  for (const memory of todayMemories) {
    await sendMemoryNotification(memory);
  }
});
```

---

## 🎯 Summary: From Passive to Active AI

| Mode | What It Does | Example |
|------|-------------|---------|
| **Passive Analysis** | Read, understand, report | "Your relationship depth score is 7.2/10" |
| **Reactive Assistance** | Respond when asked | `@lifeops suggest activity` → suggestions |
| **Proactive Suggestion** | Notice opportunity, offer help | "Partner stressed. Send support?" |
| **Active Orchestration** | Plan, execute, capture memories | Full activity plan → execution → memory creation |
| **Cultural Vocabulary Builder** | Track memes, inside jokes, recurring patterns | "The Look™ has occurred 47 times" |
| **Memory Immortalization** | Photos + context → searchable, timeless memories | "Beach Sunset Decision" linked to messages |

**The Evolution**:
```
User asks question → Bot answers (REACTIVE)
                ↓
Bot notices pattern → Bot suggests (PROACTIVE)
                ↓
Bot plans experience → Guides execution → Captures memory (ACTIVE ORCHESTRATION)
                ↓
Memory becomes part of RAG → Future suggestions reference it (SELF-IMPROVING LOOP)
```

---

**Next Implementation Steps**:
1. WhatsApp Business API setup (webhook + send message)
2. Command parser (support `@lifeops` tags + slash commands)
3. Intent detection model (natural language mode)
4. Photo analysis pipeline (OpenAI Vision integration)
5. Activity suggestion engine (RAG + preference learning)
6. Memory creation flow (guided capture + auto-enhancement)

**Contributors**: LifeOps Team
**Last Updated**: 2026-01-05
