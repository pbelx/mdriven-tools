---
name: mdriven-list-tools
description: Inspect the MCP tools and evaluator-hosted capabilities exposed by a local MDriven Designer server on a specified port. Use for requests to check, refresh, or list MDriven MCP tools, MetaModelMetaInfo, MDriven Wiki access, or Designer Vibe capabilities.
---

# MDriven MCP Capability Inspection

Query the server live; do not answer from a previous tool listing.

## Usage

```powershell
node .agents/skills/mdriven-list-tools/scripts/list_tools.mjs -p <port>
```

(Fallback PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/mdriven-list-tools/scripts/list_mdriven_tools.ps1 -Port <port>`)

Both scripts list the top-level MCP tools and use the read-only OCL evaluator to probe:

- OCL and Action Language capability overviews
- `MetaModelMetaInfo`
- MDriven Wiki search and page retrieval

Older Designer builds may expose the evaluator tools while lacking some embedded functions. Report an unavailable probe without treating it as a connection failure.

For the verified capability notes, response format, Designer Vibe calls, and the distinction between semantic associations and visible diagram lines, read [references/MDRIVEN_DESIGNER_CAPABILITIES.md](references/MDRIVEN_DESIGNER_CAPABILITIES.md).
