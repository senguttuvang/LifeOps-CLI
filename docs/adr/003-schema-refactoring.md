# ADR-003: Database Schema Refactoring

## Metadata
- **Status**: Accepted
- **Date**: 2026-01-11
- **Author**: SenG
- **Tags**: database, refactoring

## Context

The v2 schema works well for WhatsApp sync but has limitations when we want to:
- Model organizations (not just people)
- Track when relationships started/ended
- Allow users to define custom relationship types
- Add tags and custom fields

## Decision

Refactor the schema to be more flexible:

1. **Party abstraction** - People and organizations share a common base
2. **Configurable relationships** - Types defined in a table, not enum
3. **Channel abstraction** - Replace source enums with a channels table
4. **Extensibility** - Tags and custom fields support
5. **Audit logging** - Track changes

## Schema Changes

### Before (v2)

```
contacts (type: person|business|group)
contact_identifiers
relationships (type: partner|family|friend|colleague|acquaintance)
conversations
interactions → messages, calls, meetings
```

### After (v3)

```
parties (type: individual|organization)
├── individuals
└── organizations

relationship_types (configurable)
party_relationships (bidirectional, with effective dates)

channels (configurable)
contact_points

communication_events → messages, calls, meetings

tags, entity_tags
custom_fields, entity_custom_values
audit_log
```

## Migration

Phased approach:
1. Create new tables
2. Migrate data
3. Update services
4. Remove old tables

## Consequences

**Benefits:**
- More flexible relationship modeling
- User-configurable types and tags
- Historical tracking

**Trade-offs:**
- More tables (28 vs 23)
- Migration effort

## References

- Current schema: `src/infrastructure/db/schema.ts`
