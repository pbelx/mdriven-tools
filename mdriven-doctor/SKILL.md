---
name: mdriven-doctor
description: Run instant health checks and diagnostics on an active MDriven Designer model via MCP. Detects model-wide errors, broken ViewModel column expressions, unresolvable variable types, and suspicious unused classes.
---

# MDriven Doctor

Run a full model diagnostic and health check against an MDriven Designer instance on a specified port (default `9999`).

## Usage

```powershell
node .agents/skills/mdriven-doctor/scripts/diagnose.mjs -p <port>
```

### Output Summary
- Overall status: `HEALTHY` or `ERRORS_FOUND`
- Active classes and count
- Active ViewModels and count
- Suspicious default classes (e.g., `Class1`, `NewClass`)
- Full formatted list of `modelwideErrors`

