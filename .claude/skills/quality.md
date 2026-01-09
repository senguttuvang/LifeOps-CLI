# Quality Analysis Skill

Run comprehensive code quality analysis and generate a concise report.

## Invocation

```
/quality
/quality full    # Include all checks
/quality quick   # Just typecheck + test
```

## Execution Steps

### Step 1: Run Tools (Capture Output)

```bash
cd "/Users/SenG/Projects/Digital/LifeOps CLI"

# Core checks
bun run typecheck 2>&1
bun run test 2>&1

# Linting (capture summary only)
bun run lint 2>&1 | tail -10
bun run lint:eslint 2>&1 | grep -E "problem|error|warning" | tail -3

# Architecture (full output - it's concise)
bun run quality:arch 2>&1

# Dead code (first 40 lines)
bun run quality:knip 2>&1 | head -40
```

### Step 2: Generate Report (Use This Template)

```markdown
## Quality Report - LifeOps CLI

| Check | Status | Issues |
|-------|--------|--------|
| TypeScript | ✅/❌ | X errors |
| Tests | ✅/❌ | X/Y passed |
| Biome | ⚠️ | X errors, Y warnings |
| ESLint | ⚠️ | X errors, Y warnings |
| Architecture | ❌ | X DDD violations |
| Dead Code | ⚠️ | X unused files, Y unused exports |

### Critical Issues
- [List any test failures or type errors]
- [List DDD violations count]
- [Note if architecture check failed]

### Recommended Actions
1. [Most important action]
2. [Second action]
3. [Third action if needed]
```

### Step 3: Offer Next Steps

After presenting the report, ask:
- "Would you like me to auto-fix ESLint issues? (`bun run lint:eslint:fix`)"
- "Would you like details on the DDD violations?"
- "Should I help clean up unused code?"

## Key Rules

1. **Be concise** - Don't dump raw output, summarize counts
2. **Highlight critical** - Test failures and DDD violations are most important
3. **Actionable** - Always provide clear next steps
4. **Fast** - Use `tail`/`head` to limit output, don't wait for full analysis

## Exit Codes Reference

| Tool | Exit 0 | Non-zero |
|------|--------|----------|
| typecheck | No errors | Has type errors |
| test | All pass | Test failures |
| lint | Clean | Has violations |
| lint:eslint | Clean | Has violations |
| quality:arch | Clean | DDD violations (exit = error count) |
| quality:knip | Clean | Unused code found |
