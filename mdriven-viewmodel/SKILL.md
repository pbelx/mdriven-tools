---
name: mdriven-viewmodel
description: Inspect and validate MDriven ViewModels (Spans) via MCP. Lists all ViewModels in a model or prints all SpanVariables, Columns, and expressions for a specific ViewModel.
---

# MDriven ViewModel Inspector

Quickly inspect ViewModel definitions, variables, and columns in an MDriven Designer instance.

## Usage

### List All ViewModels
```powershell
node .agents/skills/mdriven-viewmodel/scripts/viewmodel.mjs -p <port> --list
```

### Inspect a Specific ViewModel
```powershell
node .agents/skills/mdriven-viewmodel/scripts/viewmodel.mjs -p <port> <ViewModelName>
```

### Example
```powershell
node .agents/skills/mdriven-viewmodel/scripts/viewmodel.mjs -p 9999 AllArticles
```

