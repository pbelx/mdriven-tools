---
name: mdriven-ui-kit
description: Give MDriven Turnkey pages a consistent look with a reusable stylesheet (cards, card lists, KPI tiles, panels, toolbars, modal form bodies, thumbnails, text clamps) and a colour theme set through Turnkey's CSS variables, installed into the model CSS via MCP. Use when a page looks plain or "off", when starting the styling of a new model, when the app needs a brand colour, when cards, modals or grids from one model should be reused in another, or when list columns appear in the wrong order.
---

# MDriven UI Kit

A starter stylesheet with generic `ui-` class names, plus a theme block. Install both into the model CSS, then attach classes to columns and containers. Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport, [layout](../mdriven-viewmodel-layout/SKILL.md) for containers, [responsive UI](../mdriven-responsive-ui/SKILL.md) for media queries and [images](../mdriven-images/SKILL.md) for photos.

Files in this folder:

- [`ui-kit.css`](ui-kit.css): the generic kit. Do not put model-specific names in it.
- [`theme-purple.css`](theme-purple.css): an example theme. Copy it and change the values for another colour.

**Status.** The class catalogue was adapted from a working model (mavuno) and installed in a second one (ecommerce) with zero model errors. The Turnkey facts under "How Turnkey applies styles" were read from rendered pages. Seen in the running app: the purple theme (top bar, buttons, focus), titles, toolbar, and the grid photo/URL fallback. Not yet seen running: the card image overlay, KPI tiles, form/modal body, notice, badge and status classes. Check those and update this line.

## Install

The model CSS is one string, `StylesInModel.allinstances->first.FastTrackCSS`. Back it up, then write theme + kit as the whole value.

```ocl
StylesInModel.allinstances->size                      -- 0: create it first
let s=StylesInModel.Create in (s.EnsureStyleTargets(); 'created')
StylesInModel.allinstances->first.FastTrackCSS        -- read and save to a file as backup
StylesInModel.allinstances->first.FastTrackCSS := '<theme css>\n<kit css>'
```

Build the string in a script: escape `\` and `'`, turn line breaks into `\n`, and keep single quotes out of the CSS (use double quotes in selectors). Read the length back. Model-specific rules go after the kit, under their own prefix.

Turnkey serves the result at `/Turnkey/StylesInModelCss`. It changes only after the model is saved and the prototype restarted.

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
| `ui-kpi` | Read-only value column in a wrapping row | KPI tile with large accent value |
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

**KPI row.** A wrapping Row (`ui-gap-2`) of read-only columns styled `ui-kpi`.

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

## Named styles in the model

A model can also hold named style definitions (border, radius, padding, fill, max size) used as `selfVM.Styles.<Name>` with `StyleRefIsExpression := true`, or in a container `StyleExpression` such as `selfVM.Styles.Card + ' my-class'`. They were read from a working model's file; creating them through MCP has **not** been worked out. Prefer the kit classes, which are plain text and copy between models.

## Verify

Read back the CSS length, the classes on columns and containers, the column order, and the model error list. Then save, restart Turnkey and look at each page at desktop and phone width: theme colour on buttons and top bar, cards the same size, images sized and falling back correctly, headings aligned with grid columns, modal body side by side. Use headless Edge for a screenshot when no browser is at hand (see the [actions skill](../mdriven-actions-navigation/SKILL.md)). Report anything not seen in the running app as unverified.
