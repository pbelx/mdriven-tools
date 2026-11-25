---
name: mdriven-access-groups
description: Hide or disable MDriven Turnkey menu actions, menu dropdowns and pages by user role with AccessGroups (VisibleExpression/EnableExpression), and plan which actions go in which group. Use when admin menus show for customers, when menu entries are greyed out instead of hidden, when AutoForms are visible to everyone, or when setting up admin/customer roles, when a customer or visitor can open an admin page by URL, or when Turnkey shows "Error 404 for AccessDenied". Covers what MCP can and cannot do (groups yes, membership no) and which pages ExpressionForAccess really protects.
---

# MDriven Access Groups

An **AccessGroup** decides, for the actions in it, whether they are **visible** and **enabled** for the current user. Use it for role rules such as "admins only". Keep each action's own `EnableExpression` for data-state rules, such as "disabled while the cart is empty". Read the sibling [evaluator skill](../mdriven-eval/SKILL.md) for transport.

Wiki: <https://wiki.mdriven.net/Documentation%3AAccess_groups>, <https://wiki.mdriven.net/Documentation%3ARestricting_data_access>.

## Why an action's own expression is not enough

`GlobalAction.EnableExpression` only **greys out** a menu entry; the entry stays visible. A menu dropdown (`MenuGroup`) disappears only when **every** action in it is hidden, and actions are hidden through access groups. To hide the "Admin" dropdown from customers, every action in that MenuGroup must be in an admin-only group.

## How groups combine

- An action in **no** group is always visible; only its own enable applies.
- If an action is in several groups:
  - **Enabled** = (G1.Enable **or** G2.Enable …) **and** the action's own enable.
  - **Visible** = (G1.Visible **or** G2.Visible …) **and** the action being opted into the context.
- So an action in both "AdminOnly" and "NotAdmin" is visible to **everyone**. Give each action **one** role group.
- An *Interest group* (a flag on a group) only filters visibility, and is evaluated only after the access groups allow the action. Use it to declutter menus, not for security.

## Typical two-role setup

```ocl
-- AdminOnly
VisibleExpression: SysSingleton.oclSingleton.CurrentUser.IsAdmin=true
EnableExpression:  SysSingleton.oclSingleton.CurrentUser.IsAdmin=true
-- NotAdmin (customers and visitors who are not logged in)
VisibleExpression: not (SysSingleton.oclSingleton.CurrentUser.IsAdmin=true)
EnableExpression:  not (SysSingleton.oclSingleton.CurrentUser.IsAdmin=true)
```

Write `IsAdmin=true` and not just `IsAdmin`: for a visitor `CurrentUser` is empty, and the comparison gives a proper Boolean.

Which group each action goes in:

| Actions | Group |
| --- | --- |
| Admin menu pages, Settings menu pages | AdminOnly |
| `AutoForm…` actions (generated seekers/forms) | AdminOnly. Otherwise customers can open and edit any record |
| Shop pages (catalogue, cart, my orders, my details) | NotAdmin, if admins should not see the shop menu |
| File/Edit (Save, Refresh, Exit, Undo, Redo) | none |
| One-time bootstrap actions (e.g. "make first admin", enabled only while no admin exists) | none, or delete once used |

## Protecting pages, not just menus

Hiding the menu entry does **not** protect the page: anyone can type its URL (`/App#/<ViewModel>/$null$`).

`Span.ExpressionForAccess` (the ViewModel's AccessExpression) is a **rooted** expression. The wiki says it is evaluated against the page's root object. **Verified (Turnkey 7.2.0.17712 prototype, ecommerce model, 2026-11-26)** by opening pages by URL in headless Edge:

| Page | Logged-in customer | Logged out |
| --- | --- | --- |
| Rooted pages opened on a record (`CustomerView/10`, `CategoryView/2`, `OrderView/100`) with a staff-only `ExpressionForAccess` | Refused, sent to `AccessDenied` | not tested |
| Unrooted pages (`RequiresRootObject=false`, URL ends `$null$`) with the same kind of rule | **Shown, with all data** | **Shown, with all data** |

So `ExpressionForAccess` alone does **not** protect dashboards, seekers and admin lists. For unrooted pages, put the ViewModel in an access group (ticked in the Designer, see below); the wiki says groups control ViewModel access as well as actions. Retest by URL as a customer and as a visitor after the user ticks them; this route is not yet verified. Keep `ExpressionForAccess` on rooted pages, where it works and can check the record (for example `(…IsStaffUser=true) or (self.Customer = SysSingleton.oclSingleton.CurrentUser.Customer)`).

### The AccessDenied page

When a page refuses access, Turnkey navigates by itself to a ViewModel named **`AccessDenied`** (`/mvc/AccessDenied/$null$`). If the model has none, the user sees the model's error page with "Error 404 for AccessDenied". Create it as an unrooted ViewModel with **no** access rule:

```ocl
-- Span: Name 'AccessDenied', Class SysSingleton, RequiresRootObject false, ExpressionForAccess empty
-- Title (static, ui-title):  'Access denied'
-- Message (static):          if SysSingleton.oclSingleton.CurrentUser->isEmpty then 'Please log in to see this page.' else 'Your account does not have access to this page.' endif
-- LogIn button (visible when logged out): selfVM.NavigateUrl('/Account/Login', false)
-- GoShop / GoDashboard buttons, visible by role: selfVM.Navigate(Product.nullValue, Product.ViewModels.Catalogue)
```

The name must be exactly `AccessDenied`.

## What MCP can and cannot do

| Task | Through MCP |
| --- | --- |
| Create a group, set its expressions | Works: `let g=AccessGroup.Create in (g.Name:='AdminOnly'; g.VisibleExpression:='…'; g.EnableExpression:='…'; 'group')` |
| Read membership | Works: `AccessGroup.allinstances->collect(g|g.Name.concat(': ').concat(g.AbstractActions->collect(a|a.Name)->asCommaList))` |
| Add an action to a group | **Fails** in every form tried, see below. Do it in the Designer |
| Add a ViewModel to a group | **Fails** too (`span.AccessGroups.Add(g)`, `g.ViewModels.Add(span)`, and creating the link class `SpanViewModelsAccessGroupAccessGroups`: "Operation set_AsObject failed"). Tick it in the Designer |
| Page access (`Span.ExpressionForAccess`) | Can be set. At runtime it blocks **rooted** pages only (see above) |

Membership attempts that failed:

- `g.AbstractActions.Add(action)`: "Object does not match target type"
- `action.AccessGroups.Add(g)`: "Object does not match target type"
- `g.AbstractActions.Add(action.oclAsType(AbstractAction))`: same error. It reports ok only when the action is **already** a member, because it changes nothing. Do not take that as proof it works
- creating the link class `AccessGroupAccessGroupsAbstractActionAbstractActions` and setting its ends: "Operation set_AsObject failed"

Membership the user ticks in the Designer shows through MCP only after they save (Ctrl+S). Until then the read query returns the old list.

So the agent creates the groups and the page access rules, then gives the user an exact list of actions to tick. Afterwards it checks the result with the read query above.

## Designer steps (for the user)

1. Open the Actions editor and select the action, for example `AdminOrders`.
2. In its properties, click the **…** at the end of the **AccessGroups** row.
3. Tick the group, for example **AdminOnly**, and close the dialog.
4. Repeat for every action in the list. The AccessGroups dialog itself can also add and remove actions.
5. Save (Ctrl+S) and restart the Turnkey prototype. Test as an admin, a customer and a visitor who is not logged in.

## Checklist when adding a new admin page

- [ ] Rooted page: `Span.ExpressionForAccess` set on the ViewModel.
- [ ] Unrooted page: tell the user to tick the **ViewModel** into the admin group too; `ExpressionForAccess` won't stop a direct URL.
- [ ] The model has an `AccessDenied` ViewModel with no access rule.
- [ ] The GlobalAction is in the right MenuGroup.
- [ ] Tell the user to tick the action in **AdminOnly**. Until then it shows, greyed out, to customers.
- [ ] After the user saves, read the membership back to confirm.
- [ ] Open the page by URL as a customer and logged out (headless Edge, see the [actions skill](../mdriven-actions-navigation/SKILL.md)) and confirm it goes to Access denied.
