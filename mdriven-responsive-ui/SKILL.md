---
name: mdriven-responsive-ui
description: Make MDriven Turnkey pages work on phones and tablets through MCP, using media queries in the model's FastTrackCSS, class hooks on placing containers and columns, and screen-size ViewModel variables. Use when a page is not responsive, a side menu squeezes content on mobile, a grid has too many columns for a phone, cards overflow or have uneven sizes, or text needs ellipsis.
---

# MDriven Responsive UI

Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport and the [layout skill](../mdriven-viewmodel-layout/SKILL.md) for container rules. The findings below were verified in a Turnkey (AngularJS) prototype unless marked otherwise.

## What MDriven offers

1. **Placing containers are flexbox.** `Wrap` and `Grow` give basic reflow. The wiki's [PlacingContainer](https://wiki.mdriven.net/Documentation%3APlacingContainer) page recommends CSS media queries for anything beyond that; there are no breakpoint properties on containers.
2. **Media queries in the model's CSS.** Put them in `<Model>_AssetsTK/Content/tkusercss.css` when the model uses it (see the [UI kit install](../mdriven-ui-kit/SKILL.md#install)); otherwise `StylesInModel.allinstances->first.FastTrackCSS` accepts `@media (max-width:768px) { ... }`. This is the main tool.
3. **Screen-size variables.** If a ViewModel declares `vIsMobileDevice`, or `vClientScreenWidth` and `vClientScreenHeight`, Turnkey sets them ([VIsMobileDevice](https://wiki.mdriven.net/Documentation%3AVIsMobileDevice), [VClientScreenWidth](https://wiki.mdriven.net/Documentation%3AVClientScreenWidth)). Use them in visible or style expressions to switch layouts in the model. **Not yet verified:** whether they update on resize or rotation, and whether they are set in a ViewModel mounted inside another.

Prefer CSS for layout changes. They react instantly to rotation and do not touch behaviour. Use the variables when content must differ, for example a card list instead of a table.

## Attaching classes

Never target Turnkey's positional classes such as `pcDasboard_0_1`; they change when containers move. Add your own classes:

| Model element | Property | Where the class lands |
| --- | --- | --- |
| PlacingContainer | `StyleExpression`, an OCL string: `'my-class'` or `selfVM.Styles.Card + ' my-class'` | The container `div` |
| Column | `StyleRef` (plain string, `StyleRefIsExpression = false`) | Both the component wrapper `div` and the inner `p`, `img` or `button` |

- Keep existing styles when adding a class, as in `selfVM.Styles.DasboardLeftCard + ' my-menu'` and `'h4 my-clamp'`.
- Turnkey also adds `<ViewModel>_<Column>` classes, for example `DeliveryFilter_Results` on a grid. These are useful for scoping, but guessing them for nested items failed once. Prefer a `StyleRef` class.
- Use `!important` in the media query. Turnkey's theme and inline flex styles otherwise win.

## Workflow

1. Inspect the ViewModel's container tree with IDs, `StyleExpression`, `MaxSize` and column `StyleRef`. Walk `ChildContainers` and the nesting's own `PlacingContainer` for list items.
2. Back up `FastTrackCSS` and the original style values to a scratch file.
3. Set the class hooks. Append one commented, scoped block to `FastTrackCSS`. Read the value back and compare it with what you sent.
4. Ask the user to save (Ctrl+S) and hard reload (Ctrl+Shift+R). Model CSS is served as a file, so a style-tag search will not find it.
5. Do not guess twice. Give the user a console snippet that prints the computed `width`, `height`, `maxHeight`, `display`, `flex`, `overflow` and `whiteSpace` of the element and its ancestors. Fix the property the numbers point to.

Diagnostic snippet: walk up from a known text and print sizes:

```js
(()=>{let e=[...document.querySelectorAll('p')].find(p=>p.innerText.startsWith('TEXT'));const o=[];for(let i=0;i<7&&e;i++,e=e.parentElement){const s=getComputedStyle(e);o.push(`${i} ${e.tagName}.${(e.className||'').toString().split(' ').slice(0,3).join('.')} w=${s.width} h=${s.height} maxH=${s.maxHeight} disp=${s.display} flex=${s.flex} ovf=${s.overflow} ws=${s.whiteSpace}`)}return o.join('\n')})()
```

## Recipes

### Side tab menu becomes a grid of buttons

The menu card and content panel share a Row. On a phone, stack them and let the tab list wrap:

```css
@media (max-width:768px) {
  .x-dash { flex-direction:column !important; }
  .x-dash-menu { width:100% !important; min-width:0 !important; max-width:none !important; flex:0 0 auto !important; height:auto !important; }
  .x-dash-tabs { flex-direction:row !important; flex-wrap:wrap !important; overflow:visible !important; gap:6px; height:auto !important; }
  .x-dash-tabs > * { flex:1 1 110px !important; min-width:0 !important; margin:0 !important; }
  .x-dash-tabs button { width:100% !important; padding:8px 6px !important; font-size:12px !important; text-align:center !important; justify-content:center !important; }
  .x-dash-tabs * { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; height:auto !important; }
}
```

- A horizontally scrolling strip with a hidden scrollbar looked like "only 3 tabs, the rest missing". Users did not discover the swipe, so wrap instead.
- The ellipsis on tab labels came from a nested element. The universal selector inside the tab list fixed it, but a rule on the button alone did not.

### KPI cards two per row, filters stacked

- KPI columns: `flex:1 1 calc(50% - 10px)`, last card `flex-basis:100%`, and remove any `min-width` on the label or value parts. A 180px minimum forced one per row.
- Filter rows: set the row container to `flex-direction:column` and each field to `flex:1 1 100%; width:100%`.
- Header action button: `flex:1 1 100%` with the button at `width:100%`.

### Grid with fewer columns on mobile

- Set `StyleRef := 'x-hide-mobile'` on the nesting columns to drop, and add `@media (max-width:768px) { .x-hide-mobile { display:none !important; } }`. The class reaches both `th` and `td`.
- The Turnkey grid is `table.tk-data-table__native` with `table-layout:fixed` and a `colgroup` of equal widths for all columns. After hiding columns, the visible ones keep their small share (8 columns at 41px gave 4 columns in 164px). Fix:

```css
@media (max-width:768px) {
  .VM_GridColumn table.tk-data-table__native { width:100% !important; table-layout:auto !important; }
  .VM_GridColumn col { width:auto !important; }
  .VM_GridColumn th { white-space:nowrap !important; }
}
```

Replace `VM_GridColumn` with the `<ViewModel>_<Column>` class of the grid, for example `DeliveryFilter_Results`.

### Fixed-size cards with clamped text

Card list nesting: card Row with `selfVM.Styles.Card`, then an inner Column holding the photo, text and button containers.

- **Width:** set the card to a fixed width (`flex:0 0 260px; width:260px; max-width:100%`) and make the inner column `width:100%` of the card. The Card style adds padding (20px a side), so a fixed inner width larger than the card width minus padding sticks out.
- **Height:** `MaxSize` on the inner Column limits **height**, not width, because a Column's main axis is vertical. With `MaxSize = 200` and a 200px photo, the text was pushed out below the card. Clear it (see the evaluator skill for null assignment) and add `max-height:none; height:auto` to the inner class.
- **Text:** put clamp classes on the columns' `StyleRef` and target the `p`:

```css
p.x-clamp3 { display:-webkit-box !important; -webkit-box-orient:vertical !important; -webkit-line-clamp:3 !important; overflow:hidden !important; white-space:normal !important; overflow-wrap:anywhere; line-height:1.4 !important; height:4.2em !important; max-height:4.2em !important; margin:0 !important; }
p.x-clamp1 { display:block !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
```

  A fixed clamp height makes every card the same height, provided the photos share a size.
- **Mobile:** `@media (max-width:768px) { .x-card { flex:1 1 100% !important; width:100% !important; } }`.
- Show the full text in a details ViewModel opened from the card's arrow (see below).

### Details from a card in a dashboard tab

Lists mounted in a Dashboard tab lose the selected tab if you navigate to a full page, because the tab variable resets. Open details as a modal instead. Use a ClassAction with `BringUpViewModel`, root `self`, `ViewModelIsModal = true` and `ViewModelModalOkEnableExpression = 'true'`. Point the card button's `ActionToExecute` at it. Like any ClassAction, it then appears in the action menus of other ViewModels of that class.

**Do not open a modal from inside a modal.** An Edit button in the details modal linked to another modal action did nothing on desktop or mobile (verified). Put a separate edit button on the card instead: a Row container with a pencil (`Icon=edit`, `IconButton=True`) linked to the edit action, and the arrow linked to the details action. Keep the details modal read-only.

## Verify and report

- Confirm `modelErrorCount` is 0 and no column has `ErrorText`.
- Check at phone width (DevTools device mode, about 390px) and on desktop. Every rule above is scoped to `max-width:768px` unless it fixes a desktop bug too.
- Report rendered results only when the user has confirmed them. Metadata checks do not prove layout.
- Remind the user to save in Designer. CSS and style changes live in the running model until then.
