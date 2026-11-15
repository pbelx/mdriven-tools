---
name: mdriven-actions-navigation
description: Wire MDriven buttons, ClassActions and GlobalActions for save, cancel and navigation in Turnkey via MCP, and fix "you have unsaved changes" popups, empty records being saved, and actions that navigate to the wrong page. Use for entry/review/confirm flows, Cancel buttons, auto-numbering, and one-time data fixes from the UI.
---

# MDriven Actions, Saving and Navigation

Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport and [state machine skill](../mdriven-state-machine/SKILL.md) for lifecycle triggers. Findings below come from Turnkey prototype testing. Where the cause is inferred rather than documented, it is marked as observed.

## Button column options

A button is a `Column` with `IsAction := true`. It can run:

- **An expression:** action language in `Expression`, with `selfVM` available. Disable it with `ExpressionForReadOnly`.
- **A linked action:** `ActionToExecute := <ClassAction or GlobalAction>`.

**Observed:** when `ActionToExecute` is set, the column `Expression` did not run. Do not split one job between the two. Use either a self-contained expression or an action.

Useful `selfVM` operations include `Save`, `Navigate`, `ExecuteAction`, `CanExecuteAction`, `Refresh` and `DirtyList`. There is no `selfVM.Cancel`. The framework Cancel is a GlobalAction with `ExecuteFrameworkRuntimeAction := #Cancel`.

## Actions

- An `AbstractAction` either brings up a ViewModel (`BringUpViewModel`, `ViewModelRootObjectExpression`) or runs `ExecuteExpression`, not both.
- `ViewModelRootObjectExpression` is action language: `self.Confirm; self` works. **Observed:** with `SaveBeforeNavigate`, the save happened before the root expression, so its changes were left unsaved, causing popups later. Make changes before saving, in a button expression.
- A `ClassAction` (owner: `ClassToPerformActionOn`) has no `selfVM`.
- A root expression on an action whose target ViewModel has `RequiresRootObject = false` gives a Designer warning ("does not require a root object"). Do not use the root expression for side effects there.
- A new `ClassAction` appears in the action menu of every ViewModel of that class. Opt it out where it does not belong (`OptOutActionInSpan`), or the user sees duplicate Review/Confirm entries. Generated trigger actions (`<Class>_Trigger_<Method>`) behave the same.
- Only GlobalActions that bring up a ViewModel appear in the nav bar. Give them a `MenuGroup` to group them.

## Reliable patterns

| Goal | Button expression |
| --- | --- |
| Change, save, go on | `self.Confirm; selfVM.Save; selfVM.Navigate(self, Class.ViewModels.Details)` |
| Discard a new draft and leave | `self.IsNew.whentrue(self.delete); selfVM.Save; selfVM.Navigate(Class.nullValue, Class.ViewModels.List)` |
| Navigate to an unrooted page | `selfVM.Navigate(Class.nullValue, Class.ViewModels.Page)` |

- **Navigating to a just-created object:** **observed:** `selfVM.Save; selfVM.Navigate(self, ...)` on a brand-new object stayed on the current page, possibly because of the pre-save object id. For the first save of a new object, use a linked ClassAction with root `self` and `SaveBeforeNavigate := true`. Navigating to an already-saved object from an expression works.
- **The extra `selfVM.Save` in Discard:** deleting a new object leaves nothing to save, but the Save makes the server report a clean state before navigating. Without it the client still showed the unsaved-changes popup from earlier typing.

## Unsaved-changes popup

The popup's Cancel means "stay on this page". It does not discard. The popup appears when anything in the session is unsaved:

- **A new object counts as unsaved.** A GlobalAction with root `X.create` makes the page dirty immediately. Clean up abandoned empty ones before creating the next one:
  `X.allLoadedObjects->select(d|d.IsNew and <all user fields empty>)->forEach(d|d.delete); X.create`
- **`OnCreate` side effects dirty other objects.** Assigning a reference number in `OnCreate` also changes the Settings counter. Assign numbers at confirm time instead, guarded so they are assigned once: `self.Ref.isNullOrEmpty.whentrue(...)`.
- **Changes after a save** (see the root-expression note above) leave the session dirty for the next page.
- **`AutoSave` on a create action** saves empty records. Keep it false for entry pages.
- The sidebar Save/Cancel enabled state can lag one round trip. It may be off on first load even though a new object exists.

## Auto-numbering references

Store references (`String`), never derive them: a derived ref changes when the counter or prefix in Settings changes, and is slow to search. Assign once from a Settings counter:

```ocl
self.Ref.isNullOrEmpty.whentrue(let s = Settings.SO in (self.Ref := s.Prefix+'-'+s.Next.toString.pad(s.Size,'0'); s.Next := s.Next + 1))
```

An attribute has no read-only setting; `AttributeMode` is only stored, transient or derived. Make refs read-only on every page column (`ExpressionForReadOnly := 'true'`), including AutoForms, which may be overwritten when AutoForms are regenerated.

## One-time data fixes

Prefer an in-app fix over editing prototype XML while the app runs, because the app overwrites hand edits on its next save. Add an action button on a page with the fix expression plus `selfVM.Save`, and a read-only expression that disables it when nothing is left to fix. Remove the button afterwards. If editing the XML, back it up, check for references to removed objects, and restart the prototype before saving in the app.

## Verify

After each change, read back the column expression, `ActionToExecute`, read-only expression and action save flags, and confirm `modelErrorCount` is 0. In the app, test these paths: open and leave without typing; type and Cancel; Review then Back; Confirm, then open a new entry (the popup must not appear); and check the saved data file for records without refs or empty records.
