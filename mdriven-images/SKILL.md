---
name: mdriven-images
description: Store, upload and display images in MDriven Turnkey through MCP, using a Blob attribute tagged as an image or a text attribute holding an image URL, with one as fallback for the other. Use when a class needs a photo, when a page should show a picture from an upload or a link, when adding thumbnails to a list, or when laying out a photo beside fields in a form or modal.
---

# MDriven Images

Two ways to give an object a picture: store the image in the database, or store a link to it. Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport and the [layout skill](../mdriven-viewmodel-layout/SKILL.md) for containers.

**Status of the findings.** The model setup below was read from a working model (mavuno: `MushroomType.MushroomPhoto`) and applied to another (ecommerce: `Product.Photo`), where upload and display were seen working in the running app. Items marked **unverified** were not yet seen in a running app when this was written. Confirm them and remove the mark.

## Two ways to model an image

| | Stored image | Image URL |
| --- | --- | --- |
| Attribute | `Blob`, tagged `Eco.BlobType = Image` | `String` |
| Column | Plain column on the attribute | Column on the attribute, tagged `DataIsImageUrl = True` |
| Editing | The column is an upload control | Edit the text in a second, untagged column |
| Cost | Grows the database; many on one page load slowly | Light, but the link can break or change |

```ocl
-- stored image
let c=Class.allinstances->select(c|c.Name='Product')->first in
  (let a=Attribute.Create in (c.Feature.Add(a); a.Name:='Photo'; a.AttributeType:='Blob'; a.SetTaggedValue('Eco.BlobType','Image')); 'ok')

-- URL shown as a picture (on a column, not the attribute)
c.SetTaggedValue('DataIsImageUrl','True')
```

Find how a model already does it:

```ocl
Attribute.allinstances->select(a|a.TaggedValue->exists(t|t.Tag='Eco.BlobType'))->collect(a|a.Owner.Name+'.'+a.Name)
Column.allinstances->select(c|c.TaggedValue->exists(t|t.Tag='DataIsImageUrl'))->collect(c|c.SpanNestingBase.Name+'.'+c.Name+' style=['+c.StyleRef+']')
```

## Columns

- **Upload (entry form):** a column with `Expression := 'self.Photo'`, not read-only.
- **Display only:** the same expression with `IsStatic := true` (the working model does this for photos on list cards and detail pages). `ExpressionForReadOnly := 'true'` can be set as well.
- **Size:** always give an image column a style class and size it in CSS. Without one, a large picture pushes the layout apart.

```css
img.shop-thumb, .shop-thumb img { width:48px !important; height:48px !important; object-fit:cover; display:block; }
img.shop-card-img, .shop-card-img img { width:100% !important; height:160px !important; object-fit:cover; display:block; }
```

The class can land on the `img` or on a wrapper, so write each rule for both, as above.

## Upload first, URL as fallback

Keep both attributes. Show the stored image when there is one, otherwise the URL image. This needs two columns in the same place, because one column cannot switch between a blob and a URL.

**On a page-level (single record) section** use visibility:

| Column | `ExpressionForVisible` |
| --- | --- |
| Stored image | `self.Photo.Length > 0` |
| URL image | `self.Photo.Length = 0` |

Do not test a non-nullable `Blob` with `->isEmpty` / `->notEmpty`: an object with no upload holds an empty value, not null, so `->notEmpty` is true for every object (seen in a running app: the URL image never showed). `.Length` type-checks in the Designer; its runtime result is **unverified**. The CSS switch below needs no expression and works here too.

**Inside a nesting (grid or cards)** neither `ExpressionForVisible` nor a style expression works per row. Both are bound to one page-level flag for the whole list (`VM_Status.<Nesting>_<Column>_Visible` / `_Style`), and the grid header cell gets the class too, so a "hide" class removes the heading and shifts the others. This was tried and failed (seen in the rendered page): every row showed the same choice and the headings moved one column left.

Do the switch in CSS instead, from what each row actually rendered. Turnkey swaps a missing stored image for `Content/icons/fallback-image.svg`, which CSS can detect with `:has()`. The rules are in the [UI kit](../mdriven-ui-kit/ui-kit.css):

- **Grid:** name the columns `Photo` and `Image` and keep them adjacent. One cell shows per row and only one heading. Seen working in a running app.
- **Cards:** the fallback marker does not exist outside grids, so CSS cannot detect a missing photo there (tried: the empty photo box hid the URL picture). Put the stored-image column (`ui-card-img ui-photo`) directly before the URL-image column (`ui-card-img ui-urlimg`); the kit lays the URL image over the photo box. Make the URL column return nothing when a photo exists, which hides it: `if self.Photo.Length > 0 then '' else self.ImageUrl endif`. Cell values are per row even though styles are not.

**Unverified:** the card variant in a running app. On an admin list it is simpler to show both previews side by side with no switching.

## Photo beside fields in a form or modal

Pattern from the working model's details modal: a Row container with a fixed-width photo column and a flexible fields column, stacking on phones.

```
Body (Row, Wrap)          StyleExpression 'shop-panel shop-edit-body'
  PhotoBox (Column)       StyleExpression 'shop-edit-photo'     -> image columns
  Info (Column)           StyleExpression 'shop-edit-info'      -> field containers
```

```css
.shop-panel { background:#fff; border:1px solid #e0e0e0; border-radius:16px; padding:20px; box-sizing:border-box; }
.shop-edit-body { gap:24px; align-items:flex-start; }
.shop-edit-photo { flex:0 0 240px !important; max-width:100% !important; }
.shop-edit-photo img { width:100% !important; height:auto !important; border-radius:12px; object-fit:cover; }
.shop-edit-info { flex:1 1 280px !important; min-width:0 !important; gap:16px; }
@media (max-width:768px) { .shop-edit-photo { flex:1 1 100% !important; } }
```

`PlacingContainer.StyleExpression` is an expression, so a literal class name needs quotes inside the string: `p.StyleExpression := '\'shop-panel\''`. A container holds either columns or child containers, so put existing field containers inside `Info` with `ChildContainers.Add`, and move a column with `PlacingContainer.Columns.Add(c)` plus a new `PCIndex`.

A named style from the model (`selfVM.Styles.<Name>` with `StyleRefIsExpression`) works on image columns too: the working model limits its photos with a `ProfilePhoto` style (max width and height 200, rounded top corners).

## One form for new and edit

The working model opens the same ViewModel as a modal for both. The edit action has root `self`, `ViewModelIsModal := true`, `ViewModelModalOkEnableExpression := 'true'` and `ViewModelExecuteExpressionAfterModalOk := 'selfVM.save'`. Existing records get their photo through that Edit button; add one wherever only a "new" form has the upload.

## Pitfalls

- A stored image is saved with the object. Keep photos small (a few hundred KB) and prefer URL images or thumbnails on pages that list many records.
- Adding a `Blob` attribute changes the data schema; a prototype may ask to update its data on restart.
- An empty image column with a fixed-height style still takes its space. Hide it (visibility or the hide class) instead of leaving it empty.
- `->isEmpty` / `->notEmpty` on a non-nullable `Blob` do not tell whether a picture was uploaded (see above).
- A new column is appended to the end of its list or container; setting `PCIndex` does not move it. Reorder by re-adding (see the UI kit skill, "Column order").
- **Copying a column's style:** copy `StyleRefIsExpression` together with `StyleRef`. A new column created with `StyleRef := 'selfVM.Styles.ProfilePhoto'` but the flag left false rendered the literal class `selfVM.Styles.ProfilePhoto`, so the style never applied (seen in the DOM, ecommerce v8, 2026-11-27). Also set `PresentationString := ''` on an image column, or Turnkey shows its name as a label above the picture.
- **Adding a URL fallback to someone else's card:** Turnkey gives every component a class `<Nesting>_<Column>` (for example `AllProducts_Image`, `AllProducts_ImageLink`). Without changing their column styles, CSS can show one image per card: hide `.X_ImageLink:has(img:not([src]))`, and hide the photo with `.tk-placingcontainer:has(> .X_ImageLink img[src]:not([src=""])) > .X_Image`. Not yet seen in the running app.

## Verify

Read back the attribute tags, the image columns (expression, style, tags, visibility) and confirm `modelErrorCount` is 0. Then save, restart Turnkey and check: the upload control accepts a file and shows it after save; the list and detail pages show the picture at the intended size; with both a photo and a URL only the photo shows; with only a URL the URL image shows; with neither there is no broken image or gap. Report anything not seen in the running app as unverified.
