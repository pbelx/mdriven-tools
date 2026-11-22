---
name: mdriven-access-groups
description: Hide or disable MDriven Turnkey menu actions, menu dropdowns and pages by user role with AccessGroups (VisibleExpression/EnableExpression), and plan which actions go in which group. Use when admin menus show for customers, when menu entries are greyed out instead of hidden, when AutoForms are visible to everyone, or when setting up admin/customer roles. Covers what MCP can and cannot do (groups yes, membership no).
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

Hiding the menu entry does **not** protect the page. Also set `Span.ExpressionForAccess` on each admin ViewModel, for example `SysSingleton.oclSingleton.CurrentUser.IsAdmin=true`. This blocks a direct URL or a `selfVM.Navigate` from a customer page.

## What MCP can and cannot do

| Task | Through MCP |
| --- | --- |
| Create a group, set its expressions | Works: `let g=AccessGroup.Create in (g.Name:='AdminOnly'; g.VisibleExpression:='…'; g.EnableExpression:='…'; 'group')` |
| Read membership | Works: `AccessGroup.allinstances->collect(g|g.Name.concat(': ').concat(g.AbstractActions->collect(a|a.Name)->asCommaList))` |
| Add an action to a group | **Fails** in every form tried, see below. Do it in the Designer |
| Page access (`Span.ExpressionForAccess`) | Works |

Membership attempts that failed:

- `g.AbstractActions.Add(action)`: "Object does not match target type"
- `action.AccessGroups.Add(g)`: "Object does not match target type"
- creating the link class `AccessGroupAccessGroupsAbstractActionAbstractActions` and setting its ends: "Operation set_AsObject failed"

So the agent creates the groups and the page access rules, then gives the user an exact list of actions to tick. Afterwards it checks the result with the read query above.

## Designer steps (for the user)

1. Open the Actions editor and select the action, for example `AdminOrders`.
2. In its properties, click the **…** at the end of the **AccessGroups** row.
3. Tick the group, for example **AdminOnly**, and close the dialog.
4. Repeat for every action in the list. The AccessGroups dialog itself can also add and remove actions.
5. Save (Ctrl+S) and restart the Turnkey prototype. Test as an admin, a customer and a visitor who is not logged in.

## Checklist when adding a new admin page

- [ ] `Span.ExpressionForAccess` set on the ViewModel.
- [ ] The GlobalAction is in the right MenuGroup.
- [ ] Tell the user to tick it in **AdminOnly**. Until then it shows, greyed out, to customers.
- [ ] After the user saves, read the membership back to confirm.
