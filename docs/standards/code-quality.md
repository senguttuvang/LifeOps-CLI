# Code Quality Standards

Enterprise-grade code quality tooling for LifeOps CLI.

## Quick Start

```bash
# Run full quality suite
bun run quality:full

# Individual tools
bun run quality:arch      # Architecture validation (DDD layers)
bun run quality:knip      # Dead code detection
bun run lint:eslint       # ESLint with 10+ plugins
bun run lint              # Biome (fast)
```

## Tool Suite

| Tool | Purpose | Config File |
|------|---------|-------------|
| **ESLint** | Code quality, Effect-TS patterns | `eslint.config.js` |
| **dependency-cruiser** | DDD layer enforcement | `.dependency-cruiser.cjs` |
| **knip** | Unused code/exports detection | `knip.json` |
| **Biome** | Fast linting + formatting | `biome.json` |
| **Qlty** | Meta-linter orchestration | `.qlty/qlty.toml` |
| **SonarQube** | Deep analysis (optional Docker) | `sonar-project.properties` |

## When to Run

### Required (Before Merge)

```bash
bun run check   # typecheck + lint + test
```

### Recommended (Weekly/Sprint)

```bash
bun run quality:full   # Full analysis including architecture
bun run quality:knip   # Find accumulated dead code
```

### On-Demand

```bash
bun run quality:arch:viz   # Generate dependency graph (requires graphviz)
bun run quality:sonar      # SonarQube analysis (requires Docker)
```

## Architecture Rules (DDD)

The `dependency-cruiser` enforces Clean Architecture:

```
CLI/Commands → Infrastructure → Application → Domain (pure)
```

### Layer Boundaries

| Layer | Can Import From | Cannot Import From |
|-------|----------------|-------------------|
| **Domain** | Nothing external | Infrastructure, CLI, DB |
| **Application** | Domain | Infrastructure, CLI |
| **Infrastructure** | Domain, Application | CLI |
| **CLI** | All layers | - |

### Common Violations

```bash
# Check architecture
bun run quality:arch

# Example violation:
# error: domain-must-be-pure: src/domain/sync.service.ts → src/infrastructure/db/client.ts
```

**Fix**: Use Effect-TS service pattern - domain defines interface, infrastructure provides Layer.

## ESLint Plugin Suite

| Plugin | Purpose |
|--------|---------|
| `@effect/eslint-plugin` | Effect-TS specific rules |
| `@typescript-eslint` | TypeScript type-aware linting |
| `eslint-plugin-sonarjs` | Cognitive complexity, code smells |
| `eslint-plugin-unicorn` | Modern JavaScript best practices |
| `eslint-plugin-import-x` | Import ordering, cycle detection |
| `eslint-plugin-promise` | Async/await patterns |
| `eslint-plugin-regexp` | ReDoS prevention |
| `eslint-plugin-n` | Node.js best practices |

### Complexity Thresholds

| Metric | Threshold |
|--------|-----------|
| Cognitive Complexity | 15 per function |
| Cyclomatic Complexity | 10 per function |
| Max Function Lines | 50 |
| Max Parameters | 4 |
| Max Nesting Depth | 4 |

## Dead Code Detection (knip)

```bash
# Full report
bun run quality:knip

# Specific checks
bun run quality:knip:deps     # Unused dependencies only
bun run quality:knip:exports  # Unused exports only
```

### What knip Detects

- Unused files (never imported)
- Unused dependencies in package.json
- Unused exports (dead API surface)
- Unused types and interfaces
- Unresolved imports

## Auto-Fix

```bash
# Fix 215+ ESLint issues automatically
bun run lint:eslint:fix

# Fix Biome issues
bun run lint:fix
```

## CI/CD Integration

### GitHub Actions (Recommended)

Add to `.github/workflows/quality.yml`:

```yaml
name: Code Quality

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
      - run: bun run quality:arch
```

### Pre-commit Hook (Optional)

```bash
# Install husky
bun add -D husky
bunx husky init

# Add pre-commit hook
echo "bun run check" > .husky/pre-commit
```

## SonarQube (Optional)

For deep historical analysis:

```bash
# Start SonarQube container
bun run quality:sonar:start

# Wait for startup, then open http://localhost:9000
# Default credentials: admin/admin
# Create project token, then run:
SONAR_TOKEN=xxx bun run quality:sonar
```

## Thresholds Summary

| Check | Pass Criteria |
|-------|---------------|
| Tests | 100% passing |
| TypeScript | No errors |
| ESLint | No errors (warnings OK) |
| Architecture | No `error` violations |
| Coverage | 80%+ (when enforced) |

## Troubleshooting

### ESLint Not Finding Files

```bash
# Verify eslint.config.js is ES module
head -1 eslint.config.js  # Should show: // @ts-check
```

### dependency-cruiser Slow

```bash
# Use focused check
depcruise src/domain --config .dependency-cruiser.cjs
```

### knip False Positives

Add to `knip.json`:

```json
{
  "ignore": ["**/file-to-ignore.ts"],
  "ignoreDependencies": ["some-dep"]
}
