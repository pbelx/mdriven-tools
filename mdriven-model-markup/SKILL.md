---
name: mdriven-model-markup
description: Read and search the Markdown export that MDriven Designer writes next to a model (<Model>_ModelAsMarkup), audit UI and styling across all ViewModels, and compare two exports or two .modlr files to see what changed. Use to find where a class, attribute, expression or style is used, to find pages missing mobile classes or consistent styles, to get oriented in an unfamiliar model, to work out what a colleague changed, or when Designer is not running. Read-only; all edits still go through MCP.
---

# MDriven Model Markup

Designer writes a readable copy of the model into `<ModelName>_ModelAsMarkup\` beside the `.modlr` file. Use it to **find and review**. Use the [evaluator skill](../mdriven-eval/SKILL.md) to **change and verify**. Editing a `.md` file changes nothing in the model.

## What is in the folder

One file per model element (verified on a Turnkey project):

| File | Contents |
| --- | --- |
| `Class_<Name>.md` | id, package, attributes with type, tagged values (`Eco.DerivationOCL`, `Eco.AllowNULL`, `Eco.Presentation`, state attribute), associations |
| `ViewModel_<Name>.md` | root class, columns with Expression (in OCL code blocks), StyleRef, PresentationString, IsAction, ActionToExecute, ReadOnly, nestings, placing containers with `StyleExpression` and `PCIndex`, ViewModel-defined actions and tagged values |
| `GlobalAction_<Name>.md` | presentation, sort order, `BringUpViewModel` link |
| `Package_<Name>.md` | package overview |
| `MDrivenModelStatusAndErrors.md` | model error list at export time ("No errors found - all ok") |

Files link to each other: `[Farmer](Class_Farmer.md)`. Every element shows its `id`, which matches the ids in the `.modlr` XML and the MCP `ExternalId`.

**Not in the export (verified):** the model CSS in `StylesInModel.FastTrackCSS`. Read that through MCP. The `<Model>_AssetsTK` folder holds the separate `tkusercss.css`.

## Check freshness first

Designer rewrites the export when the model is saved, but only the files whose element changed get a new timestamp. Before trusting the export:

1. Compare the newest file's time in the folder with the `.modlr` time. If the `.modlr` is newer, the export may be out of date.
2. Unsaved changes made through MCP are never in the export. After an MCP edit, ask the user to save before relying on it.
3. A folder copied from someone else reflects their last save, not the current model.

When it matters, confirm a finding with one MCP query before acting on it.

## Uses

- **Find usages:** grep the folder rather than writing several OCL queries, e.g. every ViewModel that uses `self.FarmerName`, a StyleRef class such as `x-hide-mobile`, or an action name.
- **Get oriented:** read one `Class_` or `ViewModel_` file to see all its attributes, columns and expressions at once before planning an edit.
- **Before a rename or refactor:** list every file that mentions the name, then make the change through MCP or the [refactor skill](../mdriven-refactor/SKILL.md).
- **When Designer is not running:** the export, or the `.modlr` itself, is the only readable source.
- **Version history:** if the project folder is in git, the export makes each save show up as readable changes in commits.

## UI and styling audits

The `ViewModel_` files hold each page's whole layout tree (verified):

- **Containers:** `### InformationHierarchy.PlacingContainer`, then nested `ChildContainers`, each with `Type`, `SelfAlign`, `JustifyContent`, `StyleExpression`, `Level` and the columns it places, with their `PCIndex`.
- **Columns:** `StyleRef`, `IsAction`, `ActionToExecute`, read-only and visible expressions, and tagged values such as `Icon`.

Use this to audit every page at once, then check the suspects in the browser.

| Check | What to look for |
| --- | --- |
| Mobile coverage | List each page's own classes (for example `[regex]::Matches($text, 'prefix-[a-z0-9-]+')`). Pages with none and with Row containers have not been made responsive yet. |
| Header pattern | A title and a button in one Row without the page-head classes. |
| Grids on phones | Grids with many columns and no hide-on-mobile `StyleRef`. |
| Button style | `IsAction: True` without `StyleRef: primary...`, or icon buttons without an `Icon` tag. |
| Layout traps | `MaxSize` on a Column container (it limits height); a container with both `Columns` and `ChildContainers`; widgets left in the root container. |
| Field rules | Reference fields that are not read-only; buttons with both an `Expression` and an `ActionToExecute` (only the action runs). |
| Consistency | The same field styled differently on different pages (`h2` against `h4`, different StyleRefs on the same kind of button). |

Report suspects and check them before fixing:

- Model CSS (`StylesInModel.FastTrackCSS`) is not in the export, so a class with no matching rule looks the same as one that works. Read the CSS through MCP to check that each class has a rule.
- Nothing is rendered. Confirm the layout at phone width in the browser, or with the diagnostic snippet in the [responsive UI skill](../mdriven-responsive-ui/SKILL.md), before claiming it is broken or fixed.
- Make the fixes through MCP, following the [layout](../mdriven-viewmodel-layout/SKILL.md) and responsive skills.

## What changed between two copies

Use this when a colleague sends an edited copy and you need to know what they changed.

1. **Compare the `.modlr` files themselves, not just the exports.** A `.modlr` is a zip archive containing `<guid>.spans` (one ViewModel each), `<guid>.ecopkg` (classes), `Actions.actions`, `.diag` diagrams, `ModlrProject.mproj` and `<Model>_AssetsTK\...` files. Extract both copies to a scratch folder with `[IO.Compression.ZipFile]::ExtractToDirectory`, then compare them file by file with `git diff --no-index`. Files of the same size are often, but not always, identical.
2. To identify a `.spans` file, read its first `Name="..."`.
3. Read each difference in context with `git diff -U12` or more. A changed `idref` on a column's `PlacingContainer` means the column was moved.
4. Check both directions. Report what the other copy adds, and also what it lacks. A copy taken earlier can miss your later work, such as CSS classes in `tkusercss.css` or an action opt-out.
5. If both copies have the export folder, compare the two `_ModelAsMarkup` folders as well for a readable summary. Only trust that if both exports are fresh (see above).

To combine two copies, apply the other copy's changes to the live model through MCP. Do not swap `.modlr` files, because that loses whatever the other copy lacks. Check the result with `modelErrorCount`, then have the user save.

## Limits

- Read-only: never edit the `.md` files to change the model.
- The export does not show computed state: no current model errors beyond the status file, and no evaluated values or rendered layout.
- Element names can repeat across ViewModels (e.g. `Pres`, `Notes`). Use the file name or id to tell them apart.
