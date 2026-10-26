---
name: mdriven-state-machine
description: Inspect, create, edit, and troubleshoot UML state machines in a running MDriven Designer through MCP, including initial states, transitions, method triggers, guards, effects, and generated UI actions. Use for lifecycle behavior; keep unrelated OCL calculations outside this skill.
---

# MDriven State Machines

Use the user's Designer port. The tools suite commonly uses 9999; 8888 was used in the to-do exercise. Discover the live model rather than assuming either port or a particular task lifecycle.

## Inspect first

Run the bundled read-only inspector (Windows PowerShell; no Node dependency):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/inspect_state_machine.ps1 -Port 8888 -ClassName Task
```

Resolve the script relative to this skill directory. It initializes MCP, discovers tools, then queries model metadata and structure. The optional class filter selects machines, regions, vertices, transitions, methods, and state attributes for that class. UI actions remain model-wide so cross-class references can be investigated. An expression failure is reported separately from connection success. Use `-OutputPath` to preserve the JSON report.

Trace the actual graph: initial node → first state → outgoing transitions → trigger method → target state. Compare IDs as well as names. The state attribute is a String connected through `Region.StateAttribute`; a similarly named lookup association is a separate member. A `FinalState` and an ordinary state named Complete are different concepts.

Interpret findings in context:

- An untriggered, unguarded outgoing transition can explain immediate progression through an intermediate state. Do not add triggers to every transition: initial and deliberately automatic transitions are valid.
- A trigger method with no transition may be an obsolete leftover, but inspect callers before removing it.
- UI actions can still call an old method even after a transition is reconnected. Compare execute and enable expressions with the current MethodTrigger mapping. In this environment generated actions used `self.StartTask` and `self.StartTask?` respectively.
- A transition's target defines the destination. A literal such as `#Complete` in its effect does not assign the state and is unnecessary for a simple transition. Preserve intentional effects.
- Empty returned model-wide error lists do not establish runtime correctness or replace Designer validation.

For query examples and API discovery, read [references/model-workflow.md](references/model-workflow.md).

## Create or repair within the requested scope

For an inspection request, report findings without changing the model. For an authorized creation or fix, discover the current metamodel APIs before writing. Reuse a native MCP connector when available; the sibling mdriven-eval scripts are another option when working inside the tools suite.

Use read-only `MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel` for discovery. Use `MCPTool_MDrivenDesigner_EvaluateActionLanguageOnMetaModel` for authorized changes. Query `MCPServerInfo.MetaModelMetaInfo('StateMachine')`, then relevant Region, Attribute, State, PseudoState, Transition, MethodTrigger, Method, and diagram types. Query the Action Language capability overview before unfamiliar operations. Do not invent constructors, enum values, ownership links, or diagram placement methods.

Define the requested initial state and transition table. Preserve existing element IDs and data where possible. Do not recreate the whole state machine for a narrow wiring repair. Preserve ownership, state-attribute links, trigger-method links, and diagram representation using the discovered API. Semantic elements and their diagram placements are separate.

The to-do example is optional: initial → Pending; Pending --StartTask→ OnGoing; OnGoing --CompleteTask→ Complete. Do not impose these names or prohibit reopening in unrelated workflows.

After changing methods or triggers, inspect generated actions. Refresh AutoForms when appropriate, then verify its actual output; regeneration alone does not prove obsolete actions were removed. Avoid replacing custom UI without considering its existing configuration.

Do not assign lifecycle strings directly to bypass transitions. Existing records require an explicit mapping and a verified migration mechanism; deleting a lookup class does not perform that migration.

## Verify and report

Requery the relevant structure and inspect nested evaluator fields: `expressionError`, `modelwideErrors`, and `createdobjects`. Run Designer validation through an available supported operation. Save authorized changes through a verified Designer operation; if saving cannot be performed, report that limitation. Reopen only when safe for the user's current work, and verify persistence when performed.

When runtime access is available, test a new object's initial state, each requested trigger, unavailable transitions, guard outcomes, and intentional effects. The metamodel evaluator inspects Designer model definitions; it is not automatically a task-instance runtime evaluator. Report structural verification and application testing separately. Do not fire business transitions merely to inspect a live task unless that testing is authorized.

Use live wiki documentation when API behavior is uncertain. Search before fetching unfamiliar titles, through the available wiki MCP or Designer `WikiSearch`/`WikiFetch`. Links to useful pages are in the reference. If a query fails, inspect its error and adapt; do not repeat the same failed expression indefinitely.
