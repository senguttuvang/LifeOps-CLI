# Git Hooks - Code Quality Gates

This repository uses **strict git hooks** to enforce code quality standards. Poor quality code **cannot** be committed or pushed.

## Overview

We use [Lefthook](https://github.com/evilmartians/lefthook) to manage git hooks with automatic enforcement at three stages:

1. **Pre-Commit**: Code quality, formatting, and type safety
2. **Commit-Msg**: Conventional commit message format
3. **Pre-Push**: Tests, compilation, and security

## Quick Start

### Installation (Already Done)

Hooks are automatically active for all developers who clone this repository:

```bash
# Hooks are installed via lefthook.yml
# Just ensure lefthook is available:
brew install lefthook  # macOS
```

### Daily Workflow

**Normal flow** - hooks run automatically:
```bash
git add src/my-changes.ts
git commit -m "feat: add new feature"  # ✅ Hooks run automatically
git push origin main                   # ✅ Tests + security scan
```

**Emergency bypass** (STRONGLY DISCOURAGED):
```bash
git commit --no-verify   # ⚠️  Skips all pre-commit hooks
git push --no-verify     # ⚠️  Skips pre-push hooks
```

> **Note**: Only bypass in emergencies (production incidents, critical hotfixes).
> Document why you bypassed hooks in your commit message.

---

## Pre-Commit Hooks

**Runs BEFORE commit is created**. All checks must pass to commit.

### 1. TypeScript Type Checking ✅

**What**: Ensures zero TypeScript compilation errors (strict mode).

**Command**: `bunx tsc --noEmit`

**Why**: Type safety is non-negotiable. Catches bugs at compile time.

**Failure Example**:
```
❌ TypeScript compilation failed!

src/file.ts:42:10 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

**Fix**:
```bash
# See errors
bunx tsc --noEmit

# Fix type errors in your code
# Then try committing again
```

---

### 2. Biome Linting (Strict) ✅

**What**: Lint checks for code quality, best practices, and potential bugs.

**Command**: `bunx @biomejs/biome check --error-on-warnings`

**Why**: Maintains consistent code quality. Prevents common mistakes.

**Failure Example**:
```
❌ Biome linting failed!

src/file.ts:10:5 - Unexpected any. Specify a different type.
src/file.ts:15:20 - Prefer using nullish coalescing operator (??) instead of logical or (||)
```

**Fix**:
```bash
# Auto-fix most issues
bunx @biomejs/biome check --write src/

# Review remaining issues
bunx @biomejs/biome check src/

# Fix manually, then re-stage
git add src/file.ts
```

---

### 3. Qlty Multi-Tool Check ✅

**What**: Comprehensive quality checks from 4 enterprise tools:
- Biome (linting + formatting)
- RadarLint-JS (SonarJS rules for TypeScript)
- Ripgrep (code pattern detection)
- TruffleHog (secret scanning)

**Command**: `~/.qlty/bin/qlty check --all`

**Why**: Catches issues that individual tools might miss.

**Failure Example**:
```
❌ Qlty quality checks failed!

src/file.ts:63:63 - Refactor this code to not nest functions more than 4 levels deep
src/file.ts:85:20 - Prefer using nullish coalescing operator (??)
```

**Fix**:
```bash
# Auto-format
~/.qlty/bin/qlty fmt --all

# Auto-fix safe issues
~/.qlty/bin/qlty check --all --fix

# View detailed report
~/.qlty/bin/qlty check --all --verbose

# Fix remaining issues manually
```

---

### 4. Code Formatting ✅

**What**: Ensures all staged files follow consistent formatting.

**Command**: `bunx @biomejs/biome format --error-on-warnings`

**Why**: Prevents formatting debates. Automated consistency.

**Failure Example**:
```
❌ Code formatting failed!

test-quality-violation.ts format ━━━━━━━━━━━━━━━━━━━━━
  ✖ Formatter would have printed the following content:
  ... (shows expected formatting)
```

**Fix**:
```bash
# Auto-format staged files
bunx @biomejs/biome format --write {staged_files}

# Re-stage
git add src/file.ts
```

---

## Commit-Msg Hook

**Runs AFTER commit is created**. Validates commit message format.

### Conventional Commits ✅

**Format**: `<type>(<scope>): <description>`

**Valid Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, white-space
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Dependency updates, misc

**Examples**:
```bash
✅ git commit -m "feat(auth): add OAuth2 authentication"
✅ git commit -m "fix(api): resolve null pointer in user endpoint"
✅ git commit -m "docs: update README with installation steps"
❌ git commit -m "updated stuff"
❌ git commit -m "WIP"
```

**Failure Example**:
```
❌ Commit message does not follow Conventional Commits format!

Format: <type>(<scope>): <description>

Your message:
  updated stuff
```

**Fix**:
```bash
# Amend commit with proper message
git commit --amend -m "feat(core): add new feature"
```

---

## Pre-Push Hooks

**Runs BEFORE push to remote**. Final integration checks.

### 1. Full Test Suite ✅

**What**: All tests must pass before pushing.

**Command**: `bun test`

**Why**: Prevents broken code on main branch. Protects team.

**Failure Example**:
```
❌ Tests failed!

✖ VectorStore › should handle metadata types
  Expected: "string"
  Received: undefined
```

**Fix**:
```bash
# Run tests locally
bun test

# Fix failing tests
# Commit fixes
git add tests/
git commit -m "fix(tests): resolve vector store test"

# Try pushing again
```

---

### 2. TypeScript Compilation (Double-Check) ✅

**What**: Ensures no type errors before push (redundant safety check).

**Command**: `bunx tsc --noEmit`

**Why**: Catches issues that might have been bypassed in pre-commit.

**Fix**: Same as pre-commit TypeScript check.

---

### 3. Security Scan (Secrets Detection) ✅

**What**: Scans for leaked credentials, API keys, tokens.

**Command**: `gitleaks detect --no-git --source .`

**Why**: Prevents accidental credential exposure.

**Failure Example**:
```
❌ Security scan failed - Potential credentials detected!

Finding: Generic API Key
Secret: sk-1234567890abcdef
File: src/config.ts
Line: 42
```

**Fix**:
```bash
# Remove secrets from code
# Use environment variables instead
# Never commit .env files

# Example fix:
# ❌ const apiKey = "sk-1234567890abcdef"
# ✅ const apiKey = process.env.API_KEY
```

---

## Troubleshooting

### Hook doesn't run

```bash
# Verify lefthook is installed
lefthook version

# Reinstall hooks
lefthook install

# Check git hooks path
git config --local core.hooksPath
# Should show: .githooks
```

---

### Hook fails but code seems fine

```bash
# View detailed failure output
git commit -v

# Check specific tool
bunx tsc --noEmit
bunx @biomejs/biome check src/
~/.qlty/bin/qlty check --all --verbose
bun test
```

---

### Need to bypass for emergency

```bash
# Emergency hotfix scenario
git commit --no-verify -m "fix: critical production bug"
git push --no-verify

# ⚠️  MUST follow up:
# 1. Create issue to fix quality violations
# 2. Submit follow-up PR to resolve issues
# 3. Document why bypass was necessary
```

---

## Hook Configuration

**File**: `lefthook.yml` (in repository root)

**Customization**: Edit `lefthook.yml` to modify hook behavior.

**Reinstall after changes**:
```bash
lefthook install
```

---

## Benefits

### Developer Experience
- ✅ **Catch errors early**: Before code review, before CI/CD
- ✅ **Fast feedback**: Immediate local validation
- ✅ **Consistent standards**: Automated enforcement
- ✅ **Less bike-shedding**: Tools decide formatting

### Team Benefits
- ✅ **Higher code quality**: No poor code merges
- ✅ **Faster reviews**: Reviewers focus on logic, not style
- ✅ **Fewer bugs**: Type safety + linting catches issues
- ✅ **Secure codebase**: Prevents credential leaks

### CI/CD Benefits
- ✅ **Fewer CI failures**: Issues caught locally first
- ✅ **Faster pipelines**: Less time debugging quality issues
- ✅ **Lower costs**: Reduced CI/CD resource usage

---

## Philosophy

> **No poor code can be committed or pushed.**

This is a deliberate constraint that:
1. **Raises the bar** for code quality
2. **Saves time** by catching issues early
3. **Protects the team** from broken code
4. **Builds habits** of quality-first development

The hooks are **strict by design**. If you find yourself frequently bypassing hooks, that's a signal to:
- Review the hook rules (are they too strict?)
- Improve your local workflow (automated formatting on save?)
- Invest in fixing root causes (architecture issues, tech debt)

---

## Resources

- **Lefthook Documentation**: https://github.com/evilmartians/lefthook
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Biome**: https://biomejs.dev/
- **Qlty**: https://qlty.sh/
- **Repository Hook Config**: `lefthook.yml`

---

## FAQ

**Q: Can I configure hooks per-developer?**
A: No. Hooks are part of the repository contract. Everyone follows the same standards.

**Q: What if a hook has a bug?**
A: Report it! Temporarily bypass with `--no-verify` and document in commit message. Fix the hook configuration ASAP.

**Q: Do hooks run in CI/CD?**
A: Not automatically. But CI should run the same checks (tests, linting, etc.) to catch any bypassed hooks.

**Q: Can I add custom hooks?**
A: Yes! Edit `lefthook.yml` and run `lefthook install`. Propose additions via PR.

**Q: Hook is slow. Can I make it faster?**
A: Some options:
- Only run on staged files (already configured)
- Run checks in parallel (already configured where possible)
- Skip expensive checks in pre-commit, move to pre-push
- Optimize the underlying tool (e.g., use Biome cache)

---

**Last Updated**: 2026-01-05
**Maintained By**: LifeOps Team
