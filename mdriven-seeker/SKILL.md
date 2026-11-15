---
name: mdriven-seeker
description: Inspect, add, and repair search criteria on MDriven seeker ViewModels via MCP. Use when a seeker does not search a field, new criteria show blue instead of orange in the Designer, or search results need to cover more attributes or linked objects.
---

# MDriven Seeker Criteria

A seeker is a `Span` whose search criteria are `Nesting` objects marked as seeker expressions. Each criterion holds one column, conventionally `Crit1`, whose expression returns the matching objects. The results grid is a separate nesting tagged `IsSeekerResultGrid=true`, referenced by a `Results` column.

## The flag that makes a nesting a criterion

A criterion must have **`UsedForSeekerColumns = true`**. The Designer shows such nestings in **orange** as search expressions. A nesting without the flag is shown in **blue** as an ordinary nesting, and the seeker ignores it. Creating `Nesting.Create` with a `Crit1` column is not enough on its own. Always set the flag and read it back.

## Inspect first

```powershell
node mdriven-seeker/scripts/seeker.mjs -p <port> --list <SeekerViewModel>
```

The list shows each nesting with its flag, `Crit1` expression and highlight tag. Copy the conventions of the existing criteria: naming (`seek<Field>`), ordering, and the `Eco.HiliteGridColumn` tag (`<ResultClass>.<ResultGridColumnName>`).

Seekers commonly have:

| Nesting | Purpose |
| --- | --- |
| `seekcrit` | No-parameter criterion, e.g. `X.allinstances` |
| `seek<Field>` | Criterion using the search box variables |
| Result grid nesting | `IsSeekerResultGrid=true`, referenced by the `Results` column |

## Add a criterion

```powershell
node mdriven-seeker/scripts/seeker.mjs -p <port> --add <SeekerViewModel> --path Farmer.FarmerName
node mdriven-seeker/scripts/seeker.mjs -p <port> --add <SeekerViewModel> --name seekFarmer --path Farmer.FarmerName --path Farmer.FarmerRef
node mdriven-seeker/scripts/seeker.mjs -p <port> --add <SeekerViewModel> --name seekCustom --expr "<full OCL returning the result class>"
```

`--path` is relative to the result class and may traverse single links, such as `MushroomType.Name`. Repeat it to match several fields in one criterion. The generated expression follows the standard pattern:

```ocl
<Class>.allinstances->select(a|a.<path>.sqllikecaseinsensitive(vSeekParamWildcard) or (a.<path>=vSeekParam))->orderby(a|a.<path>)
```

`vSeekParam` and `vSeekParamWildcard` are seeker variables; the Search action sets the wildcard to `'%'+vSeekParam+'%'`. Do not hard-code search values.

The script creates the nesting with the result class, sets `UsedForSeekerColumns := true`, adds `Crit1` and the highlight tag, and then reads everything back. It refuses to overwrite an existing nesting of the same name.

## Repair criteria that show blue

```powershell
node mdriven-seeker/scripts/seeker.mjs -p <port> --repair <SeekerViewModel>
```

This sets the flag on nestings named `seek*` that have a `Crit1` column but are not flagged. It never touches the result grid or other nestings.

## Pitfalls observed

- **Wrong model:** a seeker criterion is not a separate metaclass. Do not search the metamodel for a `SeekerCriteria` type. It is a `Nesting` with a flag.
- **`and` / `or` without parentheses:** OCL needs parentheses around comparisons combined with `and` or `or`, such as `(n.Span.Name='X') and (n.Name='Y')`. Otherwise it reports `String does not conform to Boolean`.
- **Null links:** navigating through an empty link, such as `a.Farmer.FarmerName`, simply does not match. No guard is needed in the criterion.
- **Opening a row:** a seeker opens the class's AutoForm by default. To open a different page, create a `ClassAction` for the target ViewModel with root `self`, opt the AutoForm action out with `OptOutActionInSpan` on the seeker, and optionally add a button column to the result grid with `ActionToExecute` pointing at the new action.
- **Transient errors:** a transient model error such as `Object reference not set to an instance of an object` can appear right after structural edits and clear on the next evaluation. Re-check with `mdriven-doctor` before treating it as real.

## Verify

1. Re-run `--list` and confirm each new criterion has `UsedForSeekerColumns=True`.
2. Run `mdriven-doctor`.
3. In the Designer the criteria should be orange. Save the model, refresh Turnkey, and search for a value that only the new criterion can match.
