---
name: mdriven-viewmodel-layout
description: Edit MDriven ViewModel placing containers to arrange fields into rows and columns, control widths and vertical spacing, and preserve dropdown bindings. Use for layout changes in an existing Designer model through MCP.
---

# MDriven ViewModel Layout

Use the local Designer MCP evaluator to change an existing ViewModel's layout. A ViewModel is a `Span`; a widget is a `Column`; a vertical layout is a `PlacingContainer` with `Type := #Column`. Do not confuse the last two.

## Scope and connection

- Use the user's port and ViewModel name. Query the live model rather than relying on a previous session's names or IDs.
- Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport. The sibling [inspector skill](../mdriven-viewmodel/SKILL.md) covers inspection.
- A request to move or resize fields authorizes layout changes, not colors, card styling, data-model changes, or action changes. Preserve existing expressions and behaviour unless the user asks to change them.
- Clarify ambiguous left/right wording when necessary; otherwise state the intended order before editing.

## Inspect before editing

Export a before-state of the Span, its columns, nestings, and relevant placing containers. Preserve actual IDs, order, bindings, size settings, and existing styles so a rollback can restore them without guessing.

Inspect these properties with the read-only evaluator:

```ocl
Span.allinstances->select(s|s.Name='TargetView')->first.OwnedColumns
Span.allinstances->select(s|s.Name='TargetView')->first.Nesting
Span.allinstances->select(s|s.Name='TargetView')->first.PlacingContainer
MCPServerInfo.MetaModelMetaInfo('PlacingContainer')
MCPServerInfo.MetaModelMetaInfo('Column')
```

Include column `Expression`, `ColumnForPickList`, `ReferedNesting`, `PCIndex`, `PlacingContainer`, size/margin properties, and `ErrorText`. Walk the root's `ChildContainers` to establish the actual render order. Do not dump the whole model when a filtered query is sufficient.

## Build rows without losing fields

- Keep an outer Column containing ordered child containers: title, first row, second row, and remaining content.
- A container should contain either widgets in `Columns` or child containers in `ChildContainers`, without mixing them.
- Assign unique, task-specific names to new containers. Re-query by immutable ID or unique name when moving widgets. Do not keep a binding such as `let parent=field.PlacingContainer` across moves and assume it still identifies the original container; paths can change as associations change.
- Move existing widgets with `destination.Columns.Add(existingColumn)`. Do not recreate widgets just to move them.
- Set the row's `Type := #Row` after assigning its members, then read back `TypePresentation` to confirm it remains a Row.
- Set widget `PCIndex` explicitly for left-to-right order. Inspect `ChildContainers` order separately for top-to-bottom order.
- To insert new rows before an existing final container, remove that final container from the root's collection, append the new rows, then add the final container back. This is a reparenting operation, not deletion.
- Preserve every existing field, including photos and helper columns. Do not delete an apparently unused container until its contents and role are known.

### Dropdown invariants

A dropdown field generally needs all of:

1. Its object expression, such as `self.Farmer`.
2. `ColumnForPickList` referencing a source column in the same ViewModel.
3. A source expression returning the relevant objects, such as `Farmer.allinstances->orderBy(x|x.FarmerName)`.
4. The source's `ReferedNesting` and its presentation column, such as `Pres` with `self.FarmerName`.

Keep source columns and presentation nestings when rearranging fields. Source columns can be required to have a placing container even though they supply options rather than independent controls. Preserve the original arrangement or place the source alongside its associated field, then validate.

The high-level layout application API can drop omitted columns, including pick-list sources and nesting presentation columns. **Do not apply an incomplete tree.** A message listing dropped columns is a warning that the operation may remove bindings; do not assume transport success means the dropdowns survived. Prefer direct reparenting for a small row edit.

## Size by container direction

`PCMinSize` / `PCMaxSize` act along the parent container's primary axis. `PCMinSizeSecondary` / `PCMaxSizeSecondary` act across it:

| Parent | Primary size | Secondary size |
|---|---|---|
| Row | Width | Height |
| Column | Height | Width |

- In a Row, equal width settings, `PCGrow`, and margins give consistent paired fields. For example, a user-approved 320px width uses primary min/max 320 and a 16px right margin on the left field.
- In a Column, use secondary min/max for that same width. Remove fixed primary sizes when natural control heights are intended. Setting primary min/max to 320 here produces tall controls and large apparent gaps.
- When moving a widget from Column to Row or vice versa, migrate or clear axis-dependent constraints. Review both axes; changing the container direction alone is insufficient.
- Use `PCGrow := 0` for natural-height widgets in vertical content, `JustifyContent := #Start`, and modest explicit margins for compact stacking. Preserve useful textarea/photo height.
- A container can remain wide even when its fields are narrow. Inspect its own cross-axis alignment and parent stretch behaviour. Use native sizing/alignment first. Add scoped layout-only CSS only if necessary; do not add a visual theme to solve a width problem.
- Preserve wrapping when requested. Fixed widths can wrap but may still overflow very narrow screens; do not claim full responsiveness without checking it.

To clear a nullable size through Action Language, copy a verified null value from a known unchanged property of the same type if the evaluator does not accept an untyped null literal. Never copy from an arbitrary property without checking its current value.

## Verify and save

After mutation, inspect `expressionError`, `createdobjects`, and `modelwideErrors` in the nested evaluator response. Validation can lag behind a mutation; perform a fresh read after Designer has recalculated before deciding whether an error remains.

Verify meaningful invariants:

- Requested root row order and each row's `TypePresentation`.
- Each row's widgets ordered by `PCIndex`.
- Every original field still belongs to the ViewModel and the intended rendered container.
- Dropdown source references, collection expressions, presentation nestings, and labels remain intact.
- Correct width axis, natural heights, margins, and no new model errors.

When app access is available, inspect the rendered form and check spacing and dropdown options without submitting a delivery or deleting data. Metadata validation alone does not prove visual correctness or that runtime reference data exists. State any unverified appearance or runtime behaviour explicitly.

Save the model in Designer with Ctrl+S when UI access is available. If saving is unavailable, report that changes are in the active model and ask the user to save. Do not claim they were persisted.
