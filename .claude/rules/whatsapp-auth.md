# WhatsApp Authentication Rule

## NEVER Run Auth from Claude Session

**The `whatsmeow-cli auth` command renders QR codes that display terribly in Claude's terminal.**

When authentication is needed:
1. **Prompt the user** to run auth in a separate terminal
2. Provide the exact command to run
3. Wait for user confirmation before proceeding

```bash
# User should run this in a separate terminal:
cd "/Users/SenG/Projects/Digital/LifeOps CLI" && ./bin/whatsmeow-cli auth
```

## Why This Matters

- QR codes require proper terminal rendering
- Claude's output doesn't handle block characters well
- User experience is much better in a real terminal
