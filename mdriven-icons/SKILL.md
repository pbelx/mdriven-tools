---
name: mdriven-icons
description: Add, inspect and fix icons on MDriven Turnkey buttons, tabs, titles and KPI cards using the built-in Material Icons through Icon/IconPosition tagged values via MCP. Use when a button or card needs an icon, when copying icons from a mockup or another model, or when icons are missing or doubled.
---

# MDriven Icons

Turnkey has a built-in icon set, **Material Icons**. Put an icon on a column (button, label, title or value) with tagged values. No CSS, icon font or external library is needed. Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport.

## Tagged values

| Tag | Value | Notes |
| --- | --- | --- |
| `Icon` | A Material Icons name in snake_case, such as `add` or `local_shipping` | Required |
| `IconPosition` | `before` or `after` | Optional; observed in use on buttons (`before`) and title columns (`after`) |

```ocl
let c=Span.allinstances->select(s|s.Name='<Page>')->first.OwnedColumns->select(c|c.Name='<Column>')->first in
  (let tv=TaggedValue.Create in (tv.Tag:='Icon'; tv.Value:='add'; c.TaggedValue.Add(tv));
   let tp=TaggedValue.Create in (tp.Tag:='IconPosition'; tp.Value:='before'; c.TaggedValue.Add(tp)); 'ok')
```

Check for an existing `Icon` tag before adding, so a column does not get two. To change an icon, update the existing tag's `Value`.

## Find how a model already uses icons

```ocl
Column.allinstances->select(c|c.TaggedValue->exists(t|t.Tag='Icon'))
  ->collect(c|c.Span.Name+'/'+c.Name+' style=['+c.StyleRef+'] '+c.TaggedValue->collect(t|t.Tag+'='+t.Value)->asCommaList)
```

Copy the conventions you find there: which column kinds carry icons, positions, and button style classes such as `GreenButton` or `flat` in `StyleRef`.

## Patterns seen in working models

| Use | Setup |
| --- | --- |
| Primary "Add" button | Action column, `Icon=add`, `IconPosition=before`, a button style in `StyleRef` |
| Tab buttons | Action column setting a tab variable (`vTab:='Products'`). `Icon` plus a `StyleRef` expression that switches the style: `(vTab = 'Products').casetruefalse(selfVM.Styles.TabActive, selfVM.Styles.Tab)` |
| KPI card | A separate title column (`Expression ''`, `Icon=attach_money`, `IconPosition=after`) above the value column. Putting the icon on the value column also works, but may render inside the value box |

## Mapping mockup icons to Material Icons

Mockups often use Lucide or Heroicons. Use the nearest Material Icons name:

| Mockup (Lucide) | Material Icons |
| --- | --- |
| plus | `add` |
| truck | `local_shipping` |
| scale | `scale` |
| award | `workspace_premium` |
| clipboard-list | `assignment` |
| package-check | `inventory` |
| users / user-plus | `group` / `person_add` |
| map-pin | `place` |
| layers | `layers` |
| search | `search` |
| eye | `visibility` |
| edit | `edit` |
| image / camera | `image` / `photo_camera` |
| chart | `insert_chart` |
| money | `attach_money` |

Verify an unfamiliar name in the Material Icons catalogue rather than guessing. An unknown name usually renders as the literal text or nothing.

## Pitfalls

- Do not draw icons with CSS `::before` content when the `Icon` tag is available. Remove such CSS when switching to the tag, or the button shows two icons.
- Icons are tagged values, not a column property. They do not appear in `Column` attributes.
- A Material name with spaces or capitals fails. Use snake_case.

## Verify

Read the tags back with the query above and confirm `modelErrorCount` is 0. Save the model, refresh Turnkey and check that each icon renders, sits on the intended side, and is not duplicated. Report any icon not seen in the running app as unverified.
