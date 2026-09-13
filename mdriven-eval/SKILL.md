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
