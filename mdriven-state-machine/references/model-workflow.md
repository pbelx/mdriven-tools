# State machine model inspection and editing

## Known read-only queries

These were used against MDrivenDesignerMCPServer 7.2.0.0. Discover metadata on the running version before extending them.

```ocl
StateMachine.allinstances
Region.allinstances
State.allinstances
PseudoState.allinstances
Transition.allinstances
MethodTrigger.allinstances
Method.allinstances
Activity.allinstances
Attribute.allinstances
Span.allinstances->collect(s|s.Name)
AbstractAction.allinstances->collect(a|
  a.Name.concat(' | ').concat(a.ExecuteExpression)
  .concat(' | enabled: ').concat(a.EnableExpression))
```

`Span` is the metamodel's ViewModel type; `ViewModel` was not recognized. State.allinstances also returned FinalState objects, so inspect each object's Type.

Important links observed:

| Element | Links / properties |
| --- | --- |
| StateMachine | Owner (class), Region |
| Region | StateMachine, StateAttribute, Vertex, Transition |
| Attribute | Owner, AttributeType, StateAttributeFor |
| Transition | Region, Source, Target, Trigger, Guard, Effect |
| MethodTrigger | Transition, Method |
| Method | Owner, Trigger, Body, Precondition |
| Activity | Body, Transition, EntryOf, ExitOf |
| AbstractAction | Name, ExecuteExpression, EnableExpression |

The evaluator serializes some associations as ID/name strings rather than nested objects. Do not infer linkage from display names alone. Blank Guard values can appear as `OCL: `.

## Discovery before mutation

```ocl
MCPServerInfo.GetOverViewOfCapabilitiesForActionLanguage
MCPServerInfo.MetaModelMetaInfo('StateMachine')
MCPServerInfo.MetaModelMetaInfo('Region')
MCPServerInfo.MetaModelMetaInfo('Transition')
MCPServerInfo.MetaModelMetaInfo('MethodTrigger')
```

Use metadata and capability documentation to determine the supported creation path and ownership. This skill deliberately does not provide an untested construction recipe. Designer's state-machine attribute workflow is a valid UI fallback when MCP does not expose a verified equivalent.

Action Language uses `:=` for assignment, `let` bindings for local names, and semicolons between statements, without a trailing semicolon. Verify every response before dependent changes. If a partial edit fails, inspect the current structure before attempting repair; do not retry a creation batch that could duplicate elements.

## To-do troubleshooting example

A machine had initial → Pending, Pending --Trigger1→ Active, and Active → Complete with no trigger or guard. The graph explained why requesting the first transition appeared to skip Active. After new methods StartTask and CompleteTask were connected, an old generated UI action still called disconnected Trigger1. Both the graph and the UI wiring needed inspection.

An ordinary Complete state can have outgoing transitions later if the user requests reopening. A final node has different completion semantics. Do not change one into the other based on its label alone.

## Documentation

Search live:

```ocl
MCPServerInfo.WikiSearch('state machine')
MCPServerInfo.WikiFetch('Documentation:State_machine_transitions,_triggers,_and_guards')
```

- https://wiki.mdriven.net/Training:UML_%E2%80%93_State_machines
- https://wiki.mdriven.net/Documentation:State_machine_transitions,_triggers,_and_guards
- https://wiki.mdriven.net/MDrivenStart:MDrivenStart_StateMachines

The training title contains an en dash. Preserve Unicode in UTF-8 requests; a shell argument may normalize it to a hyphen and cause missingtitle. Prefer a JSON request body or retrieve the exact linked page through the web tool if needed.
