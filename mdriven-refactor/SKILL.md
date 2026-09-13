---
name: mdriven-refactor
description: Perform safe, fast batch refactoring and symbol renaming across an entire MDriven Designer model. Updates Class names, ViewModel SpanVariables, Column expressions, and validates post-refactor health in a single operation.
---

# MDriven Refactor

Safely rename classes, types, and references across all ViewModels, variables, and columns in one quick pass.

## Usage

```powershell
node .agents/skills/mdriven-refactor/scripts/refactor.mjs -p <port> --from <OldName> --to <NewName>
```

### Example
Rename `Articles1` to `Article` everywhere in the model:
```powershell
node .agents/skills/mdriven-refactor/scripts/refactor.mjs -p 9999 --from Articles1 --to Article
```

