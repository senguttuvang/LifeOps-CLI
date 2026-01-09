# AI Context Management

This project uses a `.ai/` directory containing structured JSON files that help Claude understand the codebase. These files are loaded via `CLAUDE.local.md` at session start.

## When to Regenerate Context

Regenerate the `.ai/` context when:
- **Major architectural changes**: New layers, modules, or significant restructuring
- **New capabilities added**: Commands, services, or features
- **Database schema changes**: New tables, relationships, or major field changes
- **Pattern changes**: New conventions or idioms introduced
- **After significant PRs merged**: Especially those touching core infrastructure

## How to Regenerate

Use CodeCompass to regenerate the AI context:

```bash
# Navigate to CodeCompass
cd /Users/SenG/Projects/CodeCompass/Codecompass2

# Re-index LifeOps-CLI if code changed significantly
bun run cli index run LifeOps-CLI

# Generate fresh AI context (when command available)
bun run cli context ai-export LifeOps --output "/Users/SenG/Projects/Digital/LifeOps CLI/.ai"
```

## Manual Regeneration (Current)

Until the CodeCompass `ai-export` command is implemented, manually update:

| File | Update When |
|------|-------------|
| `architecture.json` | Layer structure, module boundaries change |
| `capabilities.json` | New CLI commands, features added |
| `domains.json` | Database schema, DDD contexts change |
| `patterns.json` | New patterns, conventions introduced |
| `navigation.json` | Key files change, new entry points |
| `data-flows.json` | Data pipelines change |

## Context Files Location

```
.ai/
├── manifest.json       # Version, metadata
├── architecture.json   # Module structure, layers
├── capabilities.json   # Business → code mapping
├── domains.json        # DDD bounded contexts
├── patterns.json       # Coding conventions
├── navigation.json     # Quick lookup
└── data-flows.json     # Data pipelines
```

## Staleness Indicators

The context may be stale if:
- You see references to files that don't exist
- Capability descriptions don't match current behavior
- Database tables referenced don't match `src/infrastructure/db/schema.ts`
- Pattern examples use outdated code

When in doubt, check `manifest.json.lastUpdated` and compare with recent commits.
