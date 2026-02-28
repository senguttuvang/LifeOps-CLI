# LifeOps CLI Agent Guide

Relationship memory assistant for developers.

## Location
`/Users/SenG/Projects/Digital/LifeOps CLI`

## Data Storage

- **Database**: `/Users/SenG/Projects/Digital/LifeOps/data/db/lifeops.db`
- **WhatsApp Cache**: `~/.whatsmeow-cli/`
- **Config**: `.env` in project root

## Backup and Recovery

The LifeOps SQLite database is continuously replicated to **Cloudflare R2** via Litestream.

- **Status**: ✅ Protected (Continuous Replication)
- **RPO**: < 1 second
- **Retention**: 168 hours (7 days)
- **Config**: `/Users/SenG/Projects/Digital/macOS-Maintenance/Config/backup/litestream.yml`

### Quick Recovery

```bash
# Stop any processes using the DB
litestream restore -config ~/.litestream.yml 
  -o "/Users/SenG/Projects/Digital/LifeOps/data/db/lifeops.db" 
  "/Users/SenG/Projects/Digital/LifeOps/data/db/lifeops.db"
```

## Quick Commands

```bash
bun run cli sync --all             # Sync WhatsApp messages
bun run cli search "query"         # Search memory
bun run cli decode "message"       # AI message analysis
bun run cli doctor                 # System diagnostics
```

## Architecture
- **Runtime**: Bun
- **Framework**: NestJS + nest-commander
- **Database**: SQLite (Drizzle ORM)
- **WhatsApp Bridge**: Go (whatsmeow)
