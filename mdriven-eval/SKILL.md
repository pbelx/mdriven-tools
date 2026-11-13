---
name: mdriven-eval
description: Evaluate OCL (Object Constraint Language) queries or Action Language expressions against an active MDriven Designer model via its MCP server endpoint. Use for inspecting meta-model elements, querying classes, checking model errors, or running model transformations.
---

# MDriven Model Evaluation & Inspection

Interact with a running MDriven Designer instance via its MCP server (default port or user-specified port like `9999`).

## Usage

### Evaluate OCL Query (Read-only)

```powershell
node .agents/skills/mdriven-eval/scripts/eval.mjs -p <port> "<OCL_Expression>"
```

### Evaluate Action Language (State-modifying)

```powershell
node .agents/skills/mdriven-eval/scripts/eval.mjs -p <port> -a "<Action_Expression>"
```

(Fallback PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/mdriven-eval/scripts/eval_mdriven.ps1 -Port <port> -Expression "<expression>"`)

## Efficient evaluation

Node output is compact JSON: `ok`, `result`, `errors`, `modelErrorCount`, and `createdObjects` when present. `--debug` adds the echoed expression and full `rawInner`; use it only for response troubleshooting. PowerShell uses `-RawResponse` for those details.

For related queries, use `--batch-file <file>` or `--batch-file -` for stdin. Supply a JSON array:

```json
[
  {"expression":"Class.allinstances->collect(c|c.Name)"},
  {"expression":"Span.allinstances->collect(s|s.Name)"}
]
```

Each entry accepts `expression`, optional `action` (boolean), `context` (string), and `returnAggregates` (boolean). Entries inherit CLI options unless overridden. The entire input is validated first; jobs then execute sequentially over one session. Execution stops at the first failure and reports completed results, zero-based `failedIndex`, and `skippedCount`. Batches are not transactions: earlier mutations remain applied. Do not blindly retry a failed mutation batch.

Expression and MCP tool failures exit nonzero. Model errors are returned separately and remain visible on successful evaluations. Filter and project in OCL before returning large collections; keep aggregates off unless needed.
