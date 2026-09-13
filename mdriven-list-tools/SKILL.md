---
name: mdriven-list-tools
description: Discover the MCP tools currently exposed by a local MDriven Designer server when given its port. Use for requests to check, refresh, or list MDriven MCP tools on a specific port.
---

# MDriven List Tools

Query the server live; do not answer from a previous tool listing.

## Usage

```powershell
node .agents/skills/mdriven-list-tools/scripts/list_tools.mjs -p <port>
```

(Fallback PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/mdriven-list-tools/scripts/list_mdriven_tools.ps1 -Port <port>`)
