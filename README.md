# MDriven MCP Tools Suite

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
