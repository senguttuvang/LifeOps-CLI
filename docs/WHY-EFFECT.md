# Why Effect-TS?

> "It's not you, it's Promise.reject()"

## The Problem with Plain TypeScript

Imagine you're building a system to analyze relationship messages. With plain TypeScript:

```typescript
async function analyzeMessage(chatId: string): Promise<Analysis> {
  const db = getDatabase();  // 🤔 Where does this come from?
  const ai = getAIService(); // 💥 Runtime error if not configured

  try {
    const messages = await db.query(chatId);
    const analysis = await ai.analyze(messages);
    return analysis;
  } catch (e) {
    // 🤷 What kind of error? Database? AI? Network? API key?
    throw e; // Caller has NO IDEA what to expect
  }
}
```

This is like trying to decode "I'm fine" without any context. You *might* get the right answer, but you're flying blind.

## Effect-TS: Making the Invisible Visible

```typescript
const analyzeMessage = (chatId: string): Effect.Effect<
  Analysis,
  DatabaseError | AIError | ValidationError,  // 📋 Caller knows ALL error cases
  DatabaseService | AIService                  // 📦 Dependencies explicit in type
> => Effect.gen(function* () {
  const db = yield* DatabaseService;
  const ai = yield* AIService;
  const messages = yield* db.query(chatId);
  const analysis = yield* ai.analyze(messages);
  return analysis;
});
```

Now your IDE tells you:
- ✅ What services are needed (DatabaseService, AIService)
- ✅ What can go wrong (DatabaseError, AIError, ValidationError)
- ✅ What you get on success (Analysis)

## The Relationship Analogy

| Relationship Concept | Plain TypeScript | Effect-TS |
|---------------------|------------------|-----------|
| Communication | "We need to talk" (vague) | "We need to discuss [X] because [Y], expecting [Z]" |
| Error handling | "Something went wrong" | "I forgot our anniversary (3 days late, recovery difficulty: legendary)" |
| Dependencies | Hidden expectations | "I need X, Y, Z to function" |
| Cancellation | Ghost them and hope | Proper interruption with cleanup |

## Why This Matters for LifeOps-Relationship

### 1. Error Types Tell the Story

```typescript
// Plain TS
throw new Error("Anniversary error"); // 😐 Not helpful

// Effect-TS
yield* Effect.fail(new ForgotAnniversaryError({
  date: new Date("2025-03-15"),
  type: "yearly",
  daysLate: 3,
  recoveryDifficulty: "legendary",
  suggestedBudget: 15000,  // Rs. formula: base * 1.5^daysLate * typeMultiplier
}));
```

The error now carries:
- What went wrong (forgot anniversary)
- How bad it is (3 days late)
- What to do about it (spend Rs. 15,000)
- How hard recovery will be (legendary)

### 2. Dependencies Are Explicit

```typescript
// Pure command - no dependencies, works offline
const decodeCommand = (message: string) =>
  Effect.gen(function* () {
    // Just pattern matching, no services needed
    const result = analyzeMessage(message);
    displayFineAnalysis(result);
  });

// Service-dependent command - requires layers
const analyzeRelationshipCommand = (chatId: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService;      // Type error if not provided
    const ai = yield* AIService;            // Type error if not provided
    const analysis = yield* db.analysis(chatId);
    yield* ai.generate(analysis);
  });
```

This is why `decode` and `remember` work without API keys - they're pure commands!

### 3. Composition Without Chaos

```typescript
// Want to analyze 5 relationships in parallel?
const results = yield* Effect.all(
  chatIds.map((id) => analyzeRelationship(id)),
  { concurrency: 5 }
);

// Want to retry AI calls with backoff?
const analysis = yield* Effect.retry(
  ai.analyze(messages),
  Schedule.exponential(Duration.seconds(1))
);

// Want to timeout after 10 seconds?
const analysis = yield* ai.analyze(messages).pipe(
  Effect.timeout(Duration.seconds(10)),
  Effect.catchTag("TimeoutException", () =>
    Effect.succeed(fallbackAnalysis))
);
```

## The Verdict

Plain TypeScript is like sending "k." - technically a response, but leaves everyone confused.

Effect-TS is like sending "I'm not upset, I just need 5 minutes to process. Can we talk after dinner?"

Clear. Explicit. No hidden emotional damage.

---

## When NOT to Use Effect

For pure utility functions that can't fail and have no dependencies:

```typescript
// This is fine as plain TypeScript
function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
  return `${Math.round(ms / 3600000)} hours`;
}

// No need for Effect here - it's pure, can't fail, no dependencies
```

Effect adds power at the cost of some verbosity. Use it where the power is needed.

---

*"Effect-TS: Because 'any' is the emotional unavailability of type systems."*
