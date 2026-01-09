# Architecture Boundary - Repository Scope

**Last Updated**: 2026-01-10

## Repository Purpose

**LifeOps CLI** is the OPEN SOURCE repository containing ALL CLI functionality:
- CLI commands and entry points
- Domain services (relationship, signals, forecast, whatsapp)
- Infrastructure (database, LLM, RAG, adapters)
- Effect-TS service layers

## This is the Canonical Location for CLI

All CLI features MUST be implemented here, not in other LifeOps repositories.

### What Belongs Here
- CLI commands (`src/cli/commands/`)
- Domain services (`src/domain/`)
- Infrastructure (`src/infrastructure/`)
- Tests (`tests/`)

### What Does NOT Belong Here
- Website code (goes to `LifeOps-Relationship/packages/web/`)
- Private roadmap docs (goes to `LifeOps-Relationship/docs/`)

## Related Repositories

| Repository | Purpose | CLI Features |
|------------|---------|--------------|
| **LifeOps CLI** (this repo) | Open source CLI tool | YES - all features |
| **LifeOps-Relationship** | Private: roadmap, website | NO - docs only |

## Paths

- This repo: `/Users/SenG/Projects/Digital/LifeOps CLI`
- Private repo: `/Users/SenG/Projects/Digital/LifeOps-Relationship`

## When Adding New Features

1. ALL new CLI features go in this repo
2. Domain logic goes in `src/domain/<bounded-context>/`
3. Infrastructure goes in `src/infrastructure/<concern>/`
4. Commands go in `src/cli/commands/`
5. Update layers in `src/cli/main.ts`
