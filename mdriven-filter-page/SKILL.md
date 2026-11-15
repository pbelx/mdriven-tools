---
name: mdriven-filter-page
description: Build an MDriven list or dashboard page with dropdown filters, date ranges, KPI cards, a results grid and Material icons, using ViewModel variables and pick-list columns through MCP. Use when a seeker's text search is not enough, when a page needs "ALL / value" dropdown filters, summary cards or icons on buttons, or when designing a main/landing list page.
---

# MDriven Filter Pages, Cards and Icons

A filter page is an ordinary unrooted ViewModel (`Span`), not a seeker. The filters are ViewModel variables, each dropdown is a column bound to its variable, and one result column applies every filter live. No Search button is needed. Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport and [layout skill](../mdriven-viewmodel-layout/SKILL.md) for container rules.

## When to use a filter page instead of seeker criteria

| Need | Use |
| --- | --- |
| Free text across fields | Seeker criteria (see [mdriven-seeker](../mdriven-seeker/SKILL.md)) or a `vSearch` variable |
| Fixed choices (state, grade), linked-object choice (point, type), date ranges, several conditions combined | Filter page |
| Totals that follow the filters (count, kg) | Filter page: reuse the same filter expression |

Do not add dropdowns for long lists that text search already handles well (farmers, agents).

## Inspect a working example first

If another model is available, copy its conventions. Find dropdown-bound variables:

```ocl
Column.allinstances->select(c|c.ColumnForPickList->notEmpty and c.Expression.startsWith('v'))
  ->collect(c|c.Span.Name+'/'+c.Name+' expr=['+c.Expression+'] pick='+c.ColumnForPickList.Name+'=['+c.ColumnForPickList.Expression+']')
SpanVariable.allinstances->select(v|v.Span.Name='<Page>')->collect(v|v.Name+':'+v.TypeName+' init=['+v.InitialValue+']')
```

## Build pattern (verified)

1. **Span:** `Span.Create`, `Name`, `Class` (the main result class), `RequiresRootObject := false`, `UsePlacingHints := true`. Model errors "Must have a class reference" right after creation clear once `Class` is set.
2. **Variables:** `SpanVariable.Create`, `Name`, `TypeName`, `InitialValue`, then `span.SpanVariables.Add(v)`.
   - `TypeName` values seen: `String`, `Boolean`, `Integer`, `DateTime`, `Collection(<Class>)`.
   - `InitialValue` is raw text without quotes, such as `ALL`.
3. **Dropdown:** two columns in the same container:
   - The visible column: `Expression := 'vState'`, `PresentationString := 'State'`, `ColumnForPickList := <list column>`.
   - The list column: `Expression := Sequence{'ALL','Draft','Confirmed'}`, or for object names `Sequence{'ALL'}->union(CollectionPoint.allinstances->orderBy(p|p.Name)->collect(p|p.Name))`.
   - String dropdowns over names are simplest and give an "ALL" entry. Object dropdowns need a pick-values nesting with a presentation column (see the layout skill's dropdown invariants).
4. **Date filters:** a `DateTime` variable bound to a column renders as a date field. Test with `vFrom.isNull or (d.DeliveryDate >= vFrom)`.
5. **Result grid:** a `Nesting` with `Class` and its own columns, plus a span column whose `Expression` returns the filtered collection and whose `ReferedNesting := <nesting>`. Put an action button in the nesting (`IsAction := true`, `ActionToExecute := <ClassAction to the details page>`).
6. **Combined filter:** each condition ignores "ALL" or empty:
   ```ocl
   X.allinstances->select(d|
     (vSearch.isNullOrEmpty or d.Ref.toLower.contains(vSearch.toLower))
     and ((vState='ALL') or vState.isNullOrEmpty or (d.State=vState))
     and ((vPoint='ALL') or vPoint.isNullOrEmpty or (d.CollectionPoint.Name=vPoint))
     and (vFrom.isNull or (d.DeliveryDate >= vFrom)) and (vTo.isNull or (d.DeliveryDate <= vTo)))
   ```
   Reuse the same expression for totals: `->size`, `->collect(d|d.WeightGrams)->sum / 1000.0`.
7. **Clear button:** an action column whose expression resets the variables: `vSearch:=''; vState:='ALL'; vFrom:=DateTime.nullValue`.
8. **Nav entry:** a `GlobalAction` with `BringUpViewModel := <span>` and `Presentation`.
9. **Hide unrelated class actions:** a new page on a class picks up every `ClassAction` of that class in its action menu. Opt out the ones that do not belong with `OptOutActionInSpan.Create`, `o.AbstractAction := a`, `o.Span := span`.

Large data: `allinstances->select` filters in memory. For thousands of rows, wrap the query in `X.PSEval(<query>, <max>, 0, <cache key>)` as in the database-backed example pattern.

## KPI cards

Cards are read-only columns (`ExpressionForReadOnly := 'true'`) with a card style class in `StyleRef`, placed in a wrapping Row (`Type := #Row`, `Wrap := true`). Return strings for formatted values: `(... / 1000.0).asString+' kg'`. Guard percentages: `if g=0 then '0%' else ((a*100) div g).asString+'%' endif`.

## Header with title, subtitle and primary button

Make the header container a Row with two child Columns: text (title, subtitle as `IsStatic := true` columns) and actions (the button). A container holds either columns or child containers, so move the existing title into the new text column first, then set the header's `Type := #Row`.

## Icons

Use the `Icon` and `IconPosition` tagged values (built-in Material Icons), for example `Icon=add` and `IconPosition=before` on the primary button. See the [icons skill](../mdriven-icons/SKILL.md) for names, patterns and pitfalls.

## Pitfalls observed

- `sortedBy(n|n)` is rejected ("may not define a loop variable"). Order objects before collecting: `->orderBy(p|p.Name)->collect(p|p.Name)`.
- `and`/`or` comparisons need parentheses.
- Column metamodel names: the label is `PresentationString`, the style class is `StyleRef` (a String), and the container type is read through `TypePresentation`. Containers use `Parent`/`ChildContainers`, not `ParentContainer`.
- `Index` is the required default page. Do not replace or rename it unless asked. Make a main page by giving it a nav entry, and only auto-navigate from Index (a Period action) when the user wants that.
- Global actions that only run an expression are not listed in the nav bar. Only actions that bring up a ViewModel appear. Put one-off maintenance as a button on a page instead.

## Verify

Read back the container tree (`ChildContainers` and their `Columns`), variables, pick-list links, `ReferedNesting` and tags, and confirm `modelErrorCount` is 0. Then save the model, refresh Turnkey and check each dropdown, the date fields, totals following the filters, icons, and the Open button. State anything not seen in the running app as unverified.
