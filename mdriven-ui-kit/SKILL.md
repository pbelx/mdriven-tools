---
name: mdriven-ui-kit
description: Give MDriven Turnkey pages a consistent look with a reusable stylesheet (cards, card lists, KPI tiles, panels, toolbars, modal form bodies, thumbnails, text clamps) and a colour theme set through Turnkey's CSS variables, installed in the model's tkusercss.css (preferred) or its FastTrackCSS, with text and box styles optionally moved into Designer styles (Styles editor). Use when a page looks plain or "off", when starting the styling of a new model, when the app needs a brand colour, when cards, modals or grids from one model should be reused in another, or when list columns appear in the wrong order.
---

# MDriven UI Kit

A starter stylesheet with generic `ui-` class names, plus a theme block. Install both into the model CSS, then attach classes to columns and containers. Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport, [layout](../mdriven-viewmodel-layout/SKILL.md) for containers, [responsive UI](../mdriven-responsive-ui/SKILL.md) for media queries and [images](../mdriven-images/SKILL.md) for photos.

Files in this folder:

- [`ui-kit.css`](ui-kit.css): the generic kit. Do not put model-specific names in it.
- [`theme-purple.css`](theme-purple.css): an example theme. Copy it and change the values for another colour.

**Status.** The class catalogue was adapted from a working model (mavuno) and installed in a second one (ecommerce) with zero model errors. The Turnkey facts under "How Turnkey applies styles" were read from rendered pages. Seen in the running app: the purple theme (top bar, buttons, focus), titles, toolbar, and the grid photo/URL fallback. KPI tiles were seen running on the ecommerce dashboard. Badge and notice were seen running on ecommerce; panels, titles and section headings were seen as Designer styles on 2026-11-24. Not yet seen running: the card image overlay, form/modal body and status classes. Check those and update this line. Installing through `tkusercss.css` was verified on ecommerce on 2026-11-23: the file was served, it loaded before the model CSS, and the pages measured the same.

## Install

Put theme + kit in **`tkusercss.css`**, a plain file next to the model:

```
<Model>_AssetsTK/Content/tkusercss.css      e.g. ecommerce_AssetsTK/Content/tkusercss.css
```

Why this file and not the model's FastTrackCSS:
- **Load order.** The Designer warns that FastTrackCSS has the highest priority. Turnkey links `/Content/tkusercss.css` before `/Turnkey/StylesInModelCss`, as seen in a rendered page head, so CSS in the file can still be overridden by the model's own styles and by Designer settings.
- **Easier to work with.** It is an ordinary file you can diff, review and copy to the next model.
- **Deployment.** The `_AssetsTK` folder is uploaded with the model. The local prototype unpacks it each time the model loads; `App_Data/ExtractForExpansionInSite.log` shows "Expanded AssetsTK Time".

See <https://wiki.mdriven.net/Documentation%3ATkusercss> and <https://wiki.mdriven.net/Documentation%3AAssetsTK>.

Steps:

1. Prove the file is picked up. Write one visible rule, such as a fixed `body::after { content:"tkusercss loaded" }` label, then save, restart the prototype and look for it. Also check that `http://localhost:<port>/Content/tkusercss.css` returns 200.
2. Back up the current `StylesInModel.allinstances->first.FastTrackCSS` to a file next to the model. Do **not** put the backup inside `_AssetsTK`, which is uploaded.
3. Write theme + kit into `tkusercss.css`. Model-specific rules go after the kit, under their own prefix.
4. Replace FastTrackCSS with a one-line comment that says where the CSS went, so nothing loads twice: `StylesInModel.allinstances->first.FastTrackCSS := '/* moved to <Model>_AssetsTK/Content/tkusercss.css */'`.
5. Save, restart the prototype and hard-refresh (Ctrl+F5). The file URL carries the Turnkey version (`?v=7.2...`), not a content hash, so browsers keep the old copy.
6. Compare the computed styles of a few pages against measurements taken before the move. On ecommerce the product grid measured identically.

Spacing on containers (`gap`, `margin`, `padding`) has no `!important` in the kit, so values set in the Designer win. Layout rules that fight Turnkey defaults keep it: card list wrapping, card and image sizes, clamps, KPI tile sizes, and the grid image swap.

FastTrackCSS is still an option when there is no file access. It is one model string:
- If `StylesInModel.allinstances->size` is 0, create it first: `let s=StylesInModel.Create in (s.EnsureStyleTargets(); 'created')`.
- Write it with `StylesInModel.allinstances->first.FastTrackCSS := '<css>'`. Escape `\` and `'`, keep single quotes out of the CSS, and read the length back.
- It is served at `/Turnkey/StylesInModelCss`.

Every style change, in either place or on a column, shows only after the model is saved **and** the prototype restarted. A browser refresh alone shows the old page.

**Before deleting a class to test something, check that it has a rule.** A class with no rule changes nothing.
- To find leftovers, compare the classes used on columns and containers (`Column.StyleRef`, and the quoted names in `PlacingContainer.StyleExpression`) with the `.ui-` selectors in the CSS.
- `primary`, `flat` and `h3` are Turnkey built-ins, not leftovers.
- A model's copy of the CSS may drop kit classes it does not use. The full kit stays here.

## Theme

Turnkey's own colours are CSS variables on `:root`. Most take an `r, g, b` triple, not a hex value.

| Variable | Controls |
| --- | --- |
| `--primary-color`, `--primary-color-dark`, `--text-on-primary` | Primary buttons (`primary` style), focus rings, selected grid row tint, spinner, login button |
| `--navbar-bg-color`, `--navbar-brand-color`, `--navbar-link-color` | Top bar |
| `--sidebar-bg-color`, `--sidebar-item-text-color` | Left action panel |
| `--danger-color`, `--success-color`, `--warning-color` (+ `-dark`) | Status colours |
| `--btn-border-radius`, `--input-border-radius`, `--select-border-radius`, `--table-border-radius` | Corner radius (px) |
| `--data-table-row-height`, `--data-table-header-height`, `--navbar-height`, `--sidebar-width` | Sizes |

The kit adds its own ordinary-colour variables: `--ui-accent`, `--ui-soft`, `--ui-border`, `--ui-muted`, `--ui-radius`. List the variables of a Turnkey version by searching `/Content/theme-default.css` and `/Content/core.css` for `var(--`.

## Class catalogue

| Class | Put it on | Gives |
| --- | --- | --- |
| `ui-title`, `ui-subtitle` | Static text column | Page heading and muted sub-heading |
| `ui-muted`, `ui-strong`, `ui-accent` | Static text column | Small grey text, semi-bold, accent-coloured value |
| `ui-clamp1`, `ui-clamp2`, `ui-clamp3` | Static text column | Cut text to 1, 2 or 3 lines with an ellipsis |
| `ui-panel` | Container | White card with border, rounded corners, padding |
| `ui-toolbar` | Row container | Filter/button row aligned on the baseline |
| `ui-gap-1`, `ui-gap-2`, `ui-gap-3`, `ui-pad` | Container | Spacing between children, padding |
| `ui-card` | Card container of a list nesting | Fixed-width card, hover lift, full width on phones |
| `ui-card-title`, `ui-card-img` | Columns inside a card | One-line bold title; 160px cover image |
| `ui-notice`, `ui-badge`, `ui-status` | Static text column | Message banner; rounded pill (e.g. cart count); small accent status text in a row or card |
| `ui-kpi-row`, `ui-kpi-card` | Wrapping Row container; small Column container per card inside it | KPI card with accent edge, shadow, two per row on phones. The card styles its content: the value column needs no class of its own. Its text becomes the large bold number, and its label the small uppercase caption with its `Icon` |
| `ui-kpi-good`, `ui-kpi-warn`, `ui-kpi-bad` | Added to the card's style | Green, amber or red edge and tint |
| `ui-section` | Static text column | Section heading above a row of cards |
| `ui-kpi` | Read-only value column in a wrapping row | Plain one-column tile (field label on top); use the card above for dashboards |
| `ui-thumb`, `ui-detail-img` | Image column | 48px thumbnail; large contained image |
| `ui-photo`, `ui-urlimg` | In a card: stored-image column directly followed by the URL-image column, both also `ui-card-img` | Shows the stored image, falls back to the URL image (needs the URL column expression described below) |
| `ui-form-body`, `ui-form-photo`, `ui-form-info` | Row container and its two child containers | Photo left, fields right, stacked on phones |

Turnkey's built-in button styles still apply: `primary` for the main action, `flat` for a text button. Icons come from tagged values (see the [icons skill](../mdriven-icons/SKILL.md)).

Attach a class:

```ocl
c.StyleRefIsExpression := false; c.StyleRef := 'ui-card-title'        -- column
p.StyleExpression := '\'ui-panel ui-form-body\''                       -- container (an expression, so quote the literal)
```

## Recipes

**Card list.** A nesting whose columns sit in a Column container styled `ui-card`, inside a wrapping Row. Image column first (`ui-card-img`), then title (`ui-card-title`), details (`ui-muted`), value (`ui-accent`), buttons (`primary` on the main one).

**Details or edit modal.** One ViewModel for new and edit, opened with `ViewModelIsModal := true` and `ViewModelExecuteExpressionAfterModalOk := 'selfVM.Save'`. Body: `Body (Row, Wrap, 'ui-panel ui-form-body')` holding `PhotoBox ('ui-form-photo')` and `Info ('ui-form-info')`, with the field containers inside `Info`. Do not open a modal from inside a modal.

**KPI cards (dashboard).** Per section: a static heading (`ui-section`), then a wrapping Row container (`'ui-kpi-row'`) whose children are one small Column container per card. Each card holds one static text column with **no style** of its own (the card container styles it): `Expression := '(<number>).asString'`, `PresentationString := 'Awaiting payment'`, tags `Icon` and `IconPosition = after`. Turnkey draws a static text column's label above its text and puts the icon inside that label, so the label is the caption.

Do not use a second static column for the caption. A static column with an `Icon` tag and an empty `PresentationString` shows its column name, split into words, as a label (a column named `DelFailedLabel` displayed "Del Failed Label" above the caption; reported from a running app). Any static text column that carries an icon needs a real `PresentationString`. A plain read-only field styled `ui-kpi` looks like a form input, not a card; that is the "plain" look to avoid.

Colour a card by its own number with the container's style expression, which is evaluated for the page:

```ocl
p.StyleExpression := '\'ui-kpi-card\' + (if (<count>) > 0 then \' ui-kpi-warn\' else \'\' endif)'
```

Group cards by what the reader acts on (orders, deliveries, stock), put the ones needing action first, and follow with a `ui-toolbar` row of icon buttons to the pages behind the numbers. **Unverified** in a running app.

**Filter page header.** `ui-title` and `ui-subtitle`, then a Row styled `ui-toolbar` with the filters and buttons.

**Feedback after a button.** Turnkey has no toast operation on `selfVM` (`ShowToast`, `Toast`, `ShowMessage`, `Notify`, `Alert` are all undefined). Use a String ViewModel variable instead: the button sets it (`vMessage := 'Added ' + self.Name + ' to your cart'`), and a static column with expression `vMessage`, style `ui-notice` and `ExpressionForVisible := 'not vMessage.isNullOrEmpty'` shows it. Add a `ui-badge` count and a per-row `ui-status` text for lasting state. **Unverified** in a running app.

**Customer-facing page.** Hide the left action panel with a tagged value on the ViewModel: `span.SetTaggedValue('HideSidebar','True')`. Only do this where the page saves through its own buttons, because the panel holds Save and Cancel.

## How Turnkey applies styles (read from rendered pages)

- **A list column has one style for the whole list.** In a grid or card list, `StyleRef`, visibility and enabled state are bound to page-level flags (`VM_Status.<Nesting>_<Column>_Style`, `_Visible`, `_Enabled`). A style *expression* on a nested column is therefore not per row. For per-row differences use CSS that looks at the row's own content, such as `:has()`.
- **The header cell gets the column's class too.** A class that hides content also hides the `th`, shifting every heading one column. Never hide a grid cell through the column's `StyleRef`.
- **Where the class lands.** Page-level column: on the component wrapper `div` and the inner `img`/`p`/`button`. Grid: on the `th` and on most `td` content, but a stored-image cell gets no class. Grid cells always carry `colname="<Column>"`, which CSS can target.
- **Missing stored image.** The `img` loads `./GetExpectedImg/<token>`. In a grid, an image that fails to load switches to `Content/icons/fallback-image.svg`, and the kit's grid rules key on that. In cards and page sections there is no such switch: the `img` stays broken and CSS cannot tell. There the kit lays the URL image over the photo box, and the URL column's expression decides per row: `if self.Photo.Length > 0 then '' else self.ImageUrl endif` (cell values are per row, unlike styles). An image column with an empty value renders no `src` and the kit hides it.
- **A card list's direction may not be a row.** A card given `flex:0 0 240px` was clipped to 240px high because the list's main axis was vertical. The kit forces the list holding `ui-card` to a wrapping row and sizes the card with `width`.
- **Column order is association order.** Columns render in the order of `Nesting.OwnedColumns` (grid) or `PlacingContainer.Columns` (container). `PCIndex` is renumbered from that order, so assigning it does not move a column. To reorder, re-add in the wanted order:

```ocl
let n=<nesting> in ((let c=n.OwnedColumns->select(c|c.Name='Photo')->first in (n.OwnedColumns.Remove(c); n.OwnedColumns.Add(c))); ... one block per column, first to last ...)
let p=<container> in ((let c=p.Columns->select(c|c.Name='Photo')->first in (p.Columns.Remove(c); p.Columns.Add(c))); ...)
```

  A column in a card belongs to both, so reorder both. Afterwards confirm no column was orphaned: `Column.allinstances->select(c|c.SpanNestingBase->isEmpty)->size` must be 0.

## Checking expressions

`Column.ErrorText` stays empty for an invalid expression. The model error list does report it, a moment later: after a change, run one more read and look at the evaluator's `errors` (for example `"<Page>:Invalid expression <Column> ..."`). To test whether an expression type-checks, set it on a throwaway column, read the errors after a short pause, then delete the column.

## Designer styles (Styles editor)

A model can also hold named styles that the Designer edits in its Styles editor. The Designer turns them into CSS served at `/Turnkey/StylesInModelCss`, which loads **after** `tkusercss.css`, so a Designer style wins where both set the same property. A column's `StyleRef` or a container's `StyleExpression` names a Designer style exactly as it names a kit class. Nothing in the ViewModels changes when a class moves from the CSS file into a Designer style.

Verified on ecommerce (`ecommerce-v3-styles-edit`, 2026-11-24): created through MCP, generated CSS read back, pages measured against the CSS-only version while logged in as admin and as a customer.

### What fits and what does not

A style stores per target: padding, margin and border width per side, radius per corner, min/max width and height, alignment, shadow, animation, fill (background), stroke (border) and font colour from the model's colour list, and font family, size, bold, italic and underline. There are scaling factors per screen size (small, medium, large), but no layout changes.

- **Fits:** text styles (`ui-title`, `ui-subtitle`, `ui-muted`, `ui-strong`, `ui-accent`, `ui-status`, `ui-section`), `ui-panel`, and the box look of `ui-badge` and `ui-notice`.
- **Stays in the CSS file:** flex wrap and gap, flex sizing, `:hover`, transitions, `:has()`, descendant rules (`label .mi`), `object-fit`, ellipsis and `white-space`, `text-transform` and `letter-spacing`, `box-sizing`, the grid `colname` rules, and every phone layout change. A border has one colour for all sides, so the KPI tile's grey border with a coloured left stripe stays in CSS.
- On ecommerce, moving everything that fits took 37 of 200 declarations (about 20 %). The kit is mostly layout. Keep the layout in `tkusercss.css` and use Designer styles for text and boxes that people want to edit visually.

### Creating them through MCP

`StylesInModel` owns `StyleDefinitions` (a `Name`), each with `StyleTargets`. A target has a `StyleTargetType`, one of `component`, `componentcontent`, `componentlabel`, `gridcell`, `gridcellcontent`, `gridheader`, `placingcontainer`. Colours are `StyleColorProperties` (`Name`, `R`, `G`, `B`, `A`, `IsThemeColor`) in `StylesInModel.StyleColorProperties`. Fonts are `StyleFontProperties` (`Size`, `Bold`, ...) in `StylesInModel.StyleFontProperties`, linked from a target. Use `MCPServerInfo.MetaModelMetaInfo('StyleTarget')` for the full attribute list.

```ocl
let s=StylesInModel.allinstances->first in (
  let c=StyleColorProperties.Create in (c.Name:='UiBorder'; c.R:=229; c.G:=231; c.B:=235; c.A:=255; s.StyleColorProperties.Add(c));
  'colour')

let s=StylesInModel.allinstances->first in (
  let d=StyleDefinition.Create in (d.Name:='ui-panel'; s.StyleDefinitions.Add(d);
    let t=StyleTarget.Create in (
      t.StyleTargetType:=StyleTargetType.allinstances->select(x|x.Name='placingcontainer')->first;
      t.PaddingTop:=20; t.PaddingRight:=20; t.PaddingBottom:=20; t.PaddingLeft:=20;
      t.BorderTop:=1; t.BorderRight:=1; t.BorderBottom:=1; t.BorderLeft:=1;
      t.BorderTopLeftRadius:=16; t.BorderTopRightRadius:=16; t.BorderBottomLeftRadius:=16; t.BorderBottomRightRadius:=16;
      t.StyleColorPropertiesFill:=StyleColorProperties.allinstances->select(c|c.Name='UiWhite')->first;
      t.StyleColorPropertiesStroke:=StyleColorProperties.allinstances->select(c|c.Name='UiBorder')->first;
      d.StyleTargets.Add(t)));
  'style')
```

For a text style use target type `componentcontent` and attach a font: `let f=StyleFontProperties.Create in (f.Size:=16; f.Bold:=true; s.StyleFontProperties.Add(f); t.StyleFontProperties:=f)`. A style for a field box (badge, notice) gets two targets: `component` for the box, `componentcontent` for the text.

The new style shows in the Styles editor at once. The page shows it after save and restart. A normal refresh is then enough, because the URL carries a fresh `?unique=` number. Changes to `tkusercss.css` still need Ctrl+F5.

### What the generated CSS looks like

- `placingcontainer` → `.tk-placingcontainer.<name> { ... }`.
- `component` → `.tk-component.<name>:not(.isgridrowdiv *):not(:has(img)) { ... }`, plus a copy for `img.<name>`.
- `componentcontent` → one rule each for `input.<name>`, `.tk-select__native.<name>`, `.tk-button__native.<name>` and `.tk-static-text__native.<name>`, all inside `.tk-component.<name>:not(.isgridrowdiv *)`. Grid cells are excluded, and the field label is not styled.
- Values are written in px and rounded: 25.6 became 26px.

### Pitfalls

- **Always set a font size on a text target.** A target with font properties but no size is written as `font-size: 0px`, and the text disappears.
- **Weight is bold on or off.** `FontWeight` text (`Bold`, `SemiBold`) is ignored and written as `font-weight: normal`. Set `Bold := true`. There is no 600 weight.
- **A text target also writes** `text-align: left; vertical-align: text-top; font-style: normal`. A centred or right-aligned field turns left-aligned.
- **A theme colour needs `--` in its name.** `IsThemeColor := true` writes the colour into `:root` as `<Name>: r, g, b;`. Named `primary-color` it was ignored by the browser. Named `--primary-color` it sets Turnkey's variable.
- **A style setting does not beat an `!important` in the CSS file.** Remove the rule from `tkusercss.css` when a class moves to the Designer, keeping only what the Designer cannot express (for example `box-sizing`). Back up the file outside `_AssetsTK` first.
- **Screen-size scaling is empty by default** and the tablet and desktop blocks in the generated CSS stay empty. Phone layout belongs in the CSS file (see [responsive UI](../mdriven-responsive-ui/SKILL.md)).
- **Checking a style.** Fetch `/Turnkey/StylesInModelCss` and read the rule. Then measure the page's computed styles, logged in where the page needs it, against the version before the move.

## Verify

Read back the CSS length, the classes on columns and containers, the column order, and the model error list. Then save, restart Turnkey and look at each page at desktop and phone width: theme colour on buttons and top bar, cards the same size, images sized and falling back correctly, headings aligned with grid columns, modal body side by side. Use headless Edge for a screenshot when no browser is at hand (see the [actions skill](../mdriven-actions-navigation/SKILL.md)). Report anything not seen in the running app as unverified.
