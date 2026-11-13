# MDriven MCP Tools Suite

## State machine inspection

The `mdriven-state-machine` skill covers lifecycle modeling, transition and trigger troubleshooting, guards/effects, and generated UI action wiring. Its standalone PowerShell inspector is read-only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File mdriven-state-machine/scripts/inspect_state_machine.ps1 -Port 8888 -ClassName Task
```

Read `mdriven-state-machine/SKILL.md` before creating or repairing state machines.

A collection of fast, lightweight Node.js (Node 18+) & PowerShell tools for interacting with and refactoring MDriven Designer models via MCP.

---

## Directory Structure

```text
mdriven-tools/
├── _common/
│   └── mdriven-client.mjs     # Shared connection & MCP client library
├── mdriven-doctor/            # Model health check & diagnostics
│   ├── SKILL.md
│   └── scripts/diagnose.mjs
├── mdriven-eval/              # OCL & Action Language evaluation
│   ├── SKILL.md
│   ├── scripts/eval.mjs
│   └── scripts/eval_mdriven.ps1
├── mdriven-list-tools/        # Live MCP tool and embedded-capability inspection
│   ├── SKILL.md
│   ├── scripts/list_tools.mjs
│   └── scripts/list_mdriven_tools.ps1
├── mdriven-refactor/          # Batch symbol & element refactoring
│   ├── SKILL.md
│   └── scripts/refactor.mjs
└── mdriven-viewmodel/         # ViewModel structure & expression inspector
    ├── SKILL.md
    └── scripts/viewmodel.mjs
```

---

## Quick Reference (Default Port: 9999)

### 1. Diagnose Model Health
```bash
node mdriven-doctor/scripts/diagnose.mjs -p 9999
```

### 2. Batch Rename / Refactor
```bash
node mdriven-refactor/scripts/refactor.mjs -p 9999 --from OldName --to NewName
```

### 3. Inspect ViewModel Expressions & Variables
```bash
# List all ViewModels
node mdriven-viewmodel/scripts/viewmodel.mjs -p 9999 --list

# Inspect a specific ViewModel
node mdriven-viewmodel/scripts/viewmodel.mjs -p 9999 <ViewModelName>
```

### 4. Evaluate OCL Query
```bash
node mdriven-eval/scripts/eval.mjs -p 9999 "Class.allinstances->collect(c | c.Name)"
```

### 5. Execute Action Language
```bash
node mdriven-eval/scripts/eval.mjs -p 9999 -a "Class.allinstances->select(c | c.Name = 'OldClass')->first.delete"
```

### 6. Inspect MCP Tools and Embedded Capabilities
```bash
node mdriven-list-tools/scripts/list_tools.mjs -p 9999
```

### 7. Diagnose or Restore the Turnkey Theme
```powershell
# Read-only diagnosis of the default local Turnkey installation
powershell -NoProfile -ExecutionPolicy Bypass -File mdriven-theme-restore/scripts/restore_mdriven_theme.ps1 -Port 8183

# Recover the verified default stylesheet from theme-default-old.css
powershell -NoProfile -ExecutionPolicy Bypass -File mdriven-theme-restore/scripts/restore_mdriven_theme.ps1 -Repair -Port 8183
```

## Efficient AI usage

The Node evaluator returns compact JSON without duplicated raw results or echoed expressions. Errors and created-object IDs remain visible. Use `--debug` for the complete nested response; the PowerShell evaluator offers `-RawResponse`.

Execute related expressions over one initialized session:

```bash
node mdriven-eval/scripts/eval.mjs -p 9999 --batch-file queries.json
```

`queries.json` is an array of objects with `expression` and optional `action`, `context`, and `returnAggregates` fields. `--batch-file -` reads the same JSON from stdin. Jobs run in order and stop at the first failure. Completed mutations are not rolled back; inspect the partial-results report before retrying. See [evaluation usage](mdriven-eval/SKILL.md).

Discovery now lists tools only by default. Add `--capabilities` for local evaluator capabilities and `--wiki` for wiki search/fetch probes. Combine both for full inspection. The PowerShell equivalents are `-Capabilities` and `-Wiki`.

Expression and tool errors produce a nonzero exit code, including when called by the refactor and inspection scripts. Existing model validation errors remain in successful evaluator responses for the caller to assess. Doctor uses lightweight count queries instead of fetching capability documentation and variable details.

Run the dependency-free regression suite with Node 18+:

```bash
node --test tests/mcp.test.mjs
```
