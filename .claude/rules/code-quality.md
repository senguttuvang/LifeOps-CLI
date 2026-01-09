# Code Quality Rules (MANDATORY)

## Quick Quality Report (Use This Format)

When asked to run code quality analysis, follow this pattern:

```bash
# Run these in sequence
bun run typecheck
bun run test
bun run lint
bun run lint:eslint 2>&1 | tail -5   # Just summary line
bun run quality:arch
bun run quality:knip 2>&1 | head -40  # First 40 lines sufficient
```

**Then present results in this format:**

```markdown
## Quality Report - [Project Name]

| Check | Status | Issues |
|-------|--------|--------|
| TypeScript | ✅/❌ | [count] errors |
| Tests | ✅/❌ | [passed]/[total] |
| Biome | ✅/⚠️ | [errors] errors, [warnings] warnings |
| ESLint | ✅/⚠️ | [errors] errors, [warnings] warnings |
| Architecture | ✅/❌ | [count] DDD violations |
| Dead Code | ⚠️ | [count] unused files/exports |

### Key Findings
- [1-3 bullet points of most important issues]

### Recommended Actions
- [1-3 actionable next steps]
```

**Do NOT:**
- Dump full tool output
- Analyze every single warning
- Spend time on verbose explanations

**DO:**
- Summarize counts quickly
- Highlight critical issues (DDD violations, test failures)
- Provide actionable next steps

---

## Run Quality Checks After Significant Changes

**When to run `bun run quality:full`:**
- After adding new modules or services
- After refactoring domain or infrastructure layers
- Before creating PRs with architectural changes
- Weekly maintenance (find accumulated dead code)

```bash
# Quick check (always before commit)
bun run check   # typecheck + lint + test

# Full analysis (after significant changes)
bun run quality:full
```

## Architecture Enforcement (DDD)

**CRITICAL**: Domain layer must be pure. Run architecture check after modifying domain code:

```bash
bun run quality:arch
```

### Forbidden Patterns

```typescript
// ❌ FORBIDDEN - Domain importing infrastructure
// src/domain/whatsapp/sync.service.ts
import { db } from "../../infrastructure/db/client";

// ✅ CORRECT - Domain defines interface, uses Effect dependency
// src/domain/whatsapp/sync.service.ts
import { Effect, Context } from "effect";

interface DatabaseService {
  query: <T>(sql: string) => Effect.Effect<T, DatabaseError>;
}
const DatabaseService = Context.Tag<DatabaseService>();

// Infrastructure provides the implementation as a Layer
```

### Layer Rules

| From | Can Import | Cannot Import |
|------|------------|---------------|
| `src/domain/` | Effect, own types | `src/infrastructure/`, `src/cli/`, `src/db/` |
| `src/infrastructure/` | Domain types | `src/cli/` |
| `src/cli/` | All | - |

## Dead Code Hygiene

Run monthly or after major refactors:

```bash
bun run quality:knip
```

### Action Required When knip Reports:

| Finding | Action |
|---------|--------|
| Unused files | Delete or add to entry points |
| Unused dependencies | `bun remove <dep>` |
| Unused exports | Remove export or mark as public API |

## ESLint Auto-Fix

After writing new code, run auto-fix:

```bash
bun run lint:eslint:fix   # Fixes ~215 issues automatically
bun run lint:fix          # Biome auto-fix
```

## Quality Scripts Reference

```bash
# Core checks
bun run check              # typecheck + lint + test (CI minimum)
bun run quality            # typecheck + all linters
bun run quality:full       # quality + arch + knip (comprehensive)

# Individual tools
bun run quality:arch       # DDD layer validation
bun run quality:knip       # Dead code detection
bun run lint:eslint        # ESLint with Effect-TS rules

# Auto-fix
bun run lint:fix           # Biome auto-fix
bun run lint:eslint:fix    # ESLint auto-fix

# Reports
bun run quality:arch:report  # HTML dependency report
bun run quality:arch:viz     # SVG dependency graph
```

## When Claude Should Run Quality Checks

1. **After implementing new features**: Run `bun run check`
2. **After modifying domain layer**: Run `bun run quality:arch`
3. **After large refactors**: Run `bun run quality:full`
4. **When cleaning up code**: Run `bun run quality:knip`

## Complexity Limits (Enforced by ESLint)

| Metric | Limit | Fix |
|--------|-------|-----|
| Cognitive complexity | 15 | Extract helper functions |
| Cyclomatic complexity | 10 | Reduce branching |
| Function lines | 50 | Split into smaller functions |
| Parameters | 4 | Use options object |
| Nesting depth | 4 | Early returns, extract functions |

## Documentation

Full documentation: `docs/standards/code-quality.md`
