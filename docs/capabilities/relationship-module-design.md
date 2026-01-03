# LifeOps-Relationship Module Design

> Fun meets Function: Developer-friendly relationship management with real capabilities

**Status**: Implementation In Progress
**Author**: Claude (Autonomous Session)
**Date**: 2026-01-08

---

## Session Context

This document captures all assumptions, concerns, and design decisions made during an autonomous implementation session while User was sleeping.

### User Requirements (Confirmed)

1. **Blend of real + fun**: Both refactor existing code AND add new fun commands
2. **Test consolidation**: Single `tests/` folder, use `bun test`
3. **Branch strategy**: Direct commits to `main` (trunk-based)
4. **Naming**: Use "LifeOps-Relationship" in docs/commits
5. **Clean up references**: Remove hardcoded "she" references, make generic
6. **Document everything**: All questions/concerns/assumptions here for review

---

## Assumptions Made

### A1: Existing Architecture Preserved

The existing Effect-TS patterns are excellent and will be preserved:
- `Context.Tag` + `Layer` for DI
- `Data.TaggedError` for typed errors
- Service pattern with `*Live` layer exports

### A2: Fun Layer is Additive

Fun elements are added as a **presentation layer** on top of real functionality:
- Real signal extraction + fun "Fine Decoder" wrapper
- Real memory storage + fun console output
- Existing tests continue to pass

### A3: New Commands Follow Existing Patterns

New commands (`decode`, `remember`, `situation`) will mirror existing:
- Follow `src/cli/commands/*.command.ts` pattern
- Export Effect generators
- Use existing service layers

### A4: Effect-TS Rationale

Effect-TS was chosen for this project because plain TypeScript has fundamental limitations when handling the complexity of relationship management:

**TypeScript Limitations Addressed by Effect:**

| Problem | Plain TS | Effect-TS Solution |
|---------|----------|-------------------|
| Error handling | `try/catch` - errors invisible in types | `Effect<A, E, R>` - errors explicit in signature |
| Async composition | `Promise.all` + error swallowing | `Effect.all` with proper error channels |
| Dependency injection | Runtime DI (InversifyJS) or manual threading | `Context.Tag` + `Layer` - compile-time DI |
| Resource management | `finally` blocks, easy to forget | `Effect.acquireRelease` - automatic cleanup |
| Concurrent operations | Race conditions, unhandled rejections | `Fiber` - structured concurrency |
| Retry logic | Custom wrapper functions | `Effect.retry` with Schedule |
| Cancellation | AbortController threading | Fiber interruption propagates automatically |

**Why This Matters for Relationships:**

```typescript
// Plain TS - errors hidden, dependencies unclear
async function analyzeRelationship(chatId: string): Promise<Analysis> {
  const db = getDatabase();  // Where does this come from?
  const ai = getAIService(); // Runtime error if not configured
  try {
    const messages = await db.query(...);
    const analysis = await ai.analyze(messages);
    return analysis;
  } catch (e) {
    // What kind of error? Database? AI? Network?
    throw e; // Caller has no idea what to expect
  }
}

// Effect-TS - everything explicit
const analyzeRelationship = (chatId: string): Effect.Effect<
  Analysis,
  DatabaseError | AIError | ValidationError,  // Caller knows all error cases
  DatabaseService | AIService                  // Dependencies explicit in type
> => Effect.gen(function* () {
  const db = yield* DatabaseService;
  const ai = yield* AIService;
  const messages = yield* db.query(chatId);
  const analysis = yield* ai.analyze(messages);
  return analysis;
});
```

### A5: TypeScript Over Rust/Go

**From a relationship/humor standpoint:**

> "Relationships, like TypeScript, are about finding the right balance between strict typing and flexible interpretation. Rust would be too unforgiving - one borrow checker error and the relationship panics. Go would be too simple - no generics means no understanding of nuance. TypeScript lets us be strict where it matters (never forget an anniversary) while remaining flexible (interpret 'fine' based on context)."

**Practical reasons:**
- Effect-TS only exists in TypeScript ecosystem
- Bun provides excellent performance without Rust complexity
- Go's lack of generics makes Effect-style composition impossible
- TypeScript enables progressive adoption (start loose, get stricter)

### A6: Empty test/ Folder Removal

The `test/` folder contains only empty subdirectories:
- `test/domain/` (empty)
- `test/infrastructure/` (empty)
- `test/integration/` (empty)

**Decision**: Remove `test/` folder, keep only `tests/` with actual test files.

---

## Concerns & Mitigations

### C1: Breaking Existing Tests

**Concern**: Adding fun layer might break existing 51 tests.

**Mitigation**:
- Run `bun test` after every change
- Fun layer is additive (new files/commands)
- Existing service layers unchanged
- Only modify presentation/console output

### C2: Hardcoded "she" References

**Concern**: README contains personal references ("that's what she uses").

**Mitigation**: Clean up in README.md, make messaging generic:
- "that's what she uses" → "optimized for WhatsApp"
- "She risked her entire life" → Remove this FAQ entirely or reframe

### C3: Over-Engineering Fun Layer

**Concern**: Adding too much "fun" complexity that becomes maintenance burden.

**Mitigation**:
- Fun types compile to regular TypeScript
- Fun console output is optional presentation layer
- Core functionality unchanged
- Humor in docs/comments, not architecture

### C4: Package.json Name Mismatch

**Concern**: Folder is `LifeOps-Relationship` but package.json says `lifeops3`.

**Decision**: Keep package.json as `lifeops3` (internal), use `LifeOps-Relationship` for external references (docs, commits, repo name).

---

## Implementation Plan

### Phase 1: Cleanup & Foundation

1. [x] Run baseline tests (51 passing)
2. [x] Remove empty `test/` folder
3. [x] Clean up README.md "she" references
4. [ ] Update package.json with fun metadata

### Phase 2: Fun Type System

5. [x] Create `src/domain/relationship/types/responses.ts` - FineResponse, DecodedMeaning
6. [x] Create `src/domain/relationship/types/errors.ts` - Fun error types
7. [ ] Add patience utility `src/utils/patience.ts` (deferred - not critical)

### Phase 3: Fun Console Output

8. [x] Create `src/cli/output/relationship-output.ts` - Fun console formatting
9. [ ] Integrate with existing commands where appropriate (deferred)

### Phase 4: New Commands

10. [x] Create `decode` command - Fine Decoder with pattern matching
11. [x] Create `remember` command - Memory capture with auto-categorization
12. [ ] Create `situation` command - Context lookup (future work)

### Phase 5: Documentation

13. [x] Add Effect-TS rationale to `docs/WHY-EFFECT.md`
14. [x] Add TypeScript choice to `docs/WHY-TYPESCRIPT.md`
15. [ ] Update README with new commands

---

## New Domain Model

### Fun Types (Compile to Normal TypeScript)

```typescript
// src/domain/relationship/types/responses.ts

export type FineResponse = {
  literal: "fine" | "okay" | "nothing" | "whatever";
  decoded: DecodedMeaning;
  confidence: number;
  responseWindowMs: number;
  doNotDo: readonly string[];
};

export type DecodedMeaning =
  | "ACTUALLY_FINE"           // Rare
  | "NOT_FINE_INVESTIGATE"    // Common
  | "FINAL_WARNING"           // Danger
  | "SHOULD_ALREADY_KNOW"     // Historical context needed
  | "TEST_IN_PROGRESS"        // Your response matters
  ;
```

### Fun Errors (Real Effect TaggedErrors)

```typescript
// src/domain/relationship/types/errors.ts

import { Data } from "effect";

export class ForgotAnniversaryError extends Data.TaggedError("ForgotAnniversaryError")<{
  readonly date: Date;
  readonly type: "dating" | "first-kiss" | "monthly" | "yearly";
  readonly daysLate: number;
  readonly recoveryDifficulty: "high" | "extreme" | "legendary";
}> {}

export class SaidCalmDownError extends Data.TaggedError("SaidCalmDownError")<{
  readonly context: string;
  readonly timestamp: Date;
}> {
  readonly recoverable = false as const;
}
```

---

## New CLI Commands

### `decode` Command

```bash
bun run cli decode "I'm fine"

# Output:
# ┌──────────────────────────────────────────────────┐
# │ Fine Decoder(tm) Analysis                         │
# ├──────────────────────────────────────────────────┤
# │ Literal: "I'm fine"                               │
# │ Decoded: NOT_FINE_INVESTIGATE (73% confidence)   │
# │ Response Window: 5 minutes                        │
# │                                                   │
# │ DO NOT:                                           │
# │  x Say 'calm down'                               │
# │  x Accept at face value                          │
# │  x Change the subject                            │
# └──────────────────────────────────────────────────┘
```

### `remember` Command

```bash
bun run cli remember "mentioned wanting the new book by Colleen Hoover"

# Output:
# ✓ Remembered: "mentioned wanting the new book by Colleen Hoover"
# Category: gift (auto-detected)
# This will appear in gift suggestions later.
```

### `situation` Command

```bash
bun run cli situation "money talk"

# Output (pulls from message history):
# ┌──────────────────────────────────────────────────┐
# │ Context: Money/Budget Discussions                 │
# ├──────────────────────────────────────────────────┤
# │ Previous occurrences: 4 in last 6 months         │
# │                                                   │
# │ Oct 15: Discussed joint expenses                 │
# │   - Tension point: Different saving priorities   │
# │   - Resolution: Monthly budget review agreed     │
# │                                                   │
# │ Patterns:                                        │
# │ * Better outcomes in morning vs evening          │
# │ * Partner needs time to process                  │
# └──────────────────────────────────────────────────┘
```

---

## Database Schema Additions

### Memory Table

```typescript
// Will add to src/infrastructure/db/schema.ts

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  category: text("category", {
    enum: ["gift", "preference", "date", "boundary", "context"]
  }).notNull(),
  mentionedAt: integer("mentioned_at", { mode: "timestamp" }),
  source: text("source", { enum: ["manual", "extracted", "whatsapp"] }).notNull(),
  relationshipId: text("relationship_id").references(() => relationships.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
```

---

## Questions for Review

1. **Memory table**: Should memories be per-relationship or global?
   - Assumption: Per-relationship (linked via `relationshipId`)

2. **Decode command**: Should it analyze actual WhatsApp message history or just the input string?
   - Assumption: Both - use context from history to improve accuracy

3. **Console output styling**: Should we add `boxen` or similar dependency for fancy output?
   - Assumption: Yes, add minimal dependencies for better UX

4. **Indian GF module**: Should this be a separate feature flag or always included?
   - Assumption: Include as part of cultural context, not a separate module

---

## Commit Strategy

Small, frequent commits with fun messages:

```
chore: remove empty test folder (it was as empty as my emotional intelligence)
feat: add FineDecoder types (97% accuracy, 3% margin of "you should know")
feat: add remember command (because your memory is a single point of failure)
feat: add decode command (now with 100% more relationship anxiety)
docs: add Effect-TS rationale (it's not you, it's Promise.reject)
docs: add TypeScript choice (Rust's borrow checker can't handle emotional baggage)
```

---

## Post-Session Review Checklist

For User to review when awake:

- [ ] All 51 tests still pass
- [ ] New commands work as expected
- [ ] Fun layer doesn't interfere with existing functionality
- [ ] Documentation is clear and helpful
- [ ] Commit messages are appropriately amusing
- [ ] No breaking changes to existing commands

---

**Last Updated**: 2026-01-08 (Autonomous Session)
