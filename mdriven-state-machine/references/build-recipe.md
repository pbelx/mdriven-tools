# Building a state machine and its diagram through MCP

Used twice on MDriven Designer (an `Order` and a `Delivery` lifecycle) ending with zero model errors. The Order machine was also exercised in a running Turnkey prototype. Discover metadata on the running version first (`MCPServerInfo.MetaModelMetaInfo('<Type>')`) and adapt.

Run each step as its own evaluation and read the result before the next. A batch stops at the first failure and is not rolled back, so never re-run a creation batch: inspect what exists and continue from there.

## 1. Semantic elements

Scope every lookup by owner. A second machine in the model makes `Region.allinstances->first` or a vertex looked up by name alone pick the wrong element (two machines can both have a `Delivered` state).

```ocl
-- state attribute: a String attribute, tagged
let c=<class> in (let a=Attribute.Create in (c.Feature.Add(a); a.Name:='State'; a.AttributeType:='String'; a.SetTaggedValue('Eco.IsStateAttribute','True')))

-- machine, region, initial node
let c=<class> in (let sm=StateMachine.Create in (c.StateMachine.Add(sm); sm.Name:='DeliveryStateMachine';
  let r=Region.Create in (sm.Region.Add(r); r.Name:='Region1';
    r.StateAttribute:=c.Feature->select(f|f.Name='State')->first.oclAsType(Attribute);
    let i=PseudoState.Create in (r.Vertex.Add(i); i.Name:='Initial'))))

-- region and vertex lookups used below
<reg>   = Region.allinstances->select(r|r.StateMachine.Name='DeliveryStateMachine')->first
<vx X>  = <reg>.Vertex->select(v|v.Name='X')->first

-- states
let s=State.Create in (<reg>.Vertex.Add(s); s.Name:='Pending')

-- trigger methods, tagged
let m=Method.Create in (<class>.Feature.Add(m); m.Name:='Assign'; m.SetTaggedValue('Eco.IsTrigger','True'))

-- transition, with optional trigger and effect
let t=Transition.Create in (<reg>.Transition.Add(t); t.Source:=<vx Pending>; t.Target:=<vx Assigned>;
  (let mt=MethodTrigger.Create in (t.Trigger:=mt; mt.Method:=Method.allinstances->select(m|(m.Name='Assign') and (m.Owner.Name='Delivery'))->first));
  (let a=Activity.Create in (t.Effect:=a; a.Body:='self.AssignedAt := DateTime.Now')))
```

The initial transition (`Initial` to the first state) has no trigger.

### Errors seen, and their fixes

| Model error | Fix |
| --- | --- |
| `<Class>.State does not have the IsStateAttribute tagged value set` | `SetTaggedValue('Eco.IsStateAttribute','True')` on the attribute |
| `Method ... is used as trigger, but IsTrigger is not true` | `SetTaggedValue('Eco.IsTrigger','True')` on the method. `IsTrigger` is not a member of `Method` |
| `state transition effect ...: System.String and System.DateTime does not conform` | The attribute type name was not recognised (`DateTime?` became a string). Copy `AttributeType` from an existing attribute of the wanted type |

**Guards were not settable.** `t.Guard := '<ocl>'` fails (`Eco.ModelLayer.Expression and System.String`), and `t.Guard.Body := '<ocl>'` fails ("Left hand side must be a property"). Every transition already has a Guard object with an empty `Body`. Until a working way is found, enforce the condition where the trigger is called (button expression and its read-only expression) and tell the user the machine itself is unguarded, or add the guard in the Designer UI.

Model errors lag: after the last step, wait a few seconds and run one more read before trusting an empty error list.

## 2. The state diagram

Semantic elements are not drawn automatically. One diagram per state attribute:

```ocl
<dia> = AttributeStateDiagram.allinstances->select(d|d.Attribute.Owner.Name='Delivery')->first

let d=AttributeStateDiagram.Create in (d.StateMachine:=<the machine>; d.Attribute:=<the state attribute>)

-- one box per vertex, including Initial
let p=PlacedState.Create in (p.ClassStateDiagram:=<dia>; p.Vertex:=<vx Pending>; p.LastKnownName:='Pending'; p.x:=200; p.y:=96)

-- one line per transition: a source point chained to a target point
<reg>.Transition->forEach(t| let s=TransitionSource.Create in (let g=TransitionTarget.Create in (
  s.Transition:=t; s.PlacedState:=<dia>.PlacedState->select(p|p.Vertex=t.Source)->first; s.ViaPointsStartsHere:=true; s.SideToUse:=1;
  g.Transition:=t; g.PlacedState:=<dia>.PlacedState->select(p|p.Vertex=t.Target)->first; g.SideToUse:=3; s.next:=g)))
```

`SideToUse` values seen on working diagrams: `0` top, `1` right, `2` bottom, `3` left. A left-to-right flow uses 1 on the source and 3 on the target; a branch going down uses 2 and 0.

## 3. Make it readable: size and colour (do this every time)

A `PlacedState` created through MCP gets `Size = 0` and `Color = 0`: tiny text (about 40 x 21 px) and no fill. That is hard to read and does not match diagrams drawn in the Designer. Always finish a new diagram with these, and apply the same to a diagram that looks small or plain:

```ocl
let p=<dia>.PlacedState->select(p|p.Vertex.Name='Pending')->first in (p.Size:=2; p.Color:=-922779648; p.x:=200; p.y:=96)
<dia>.ZoomScaleFactor:=1.157625
```

- **Size.** `2` is the larger text used on the reference diagram (boxes about 42 px high, 55 to 115 px wide depending on the name). Leave the `Initial` node at `0`.
- **Colour.** A signed 32-bit ARGB integer. With alpha `0xC8`: `Color = -939524096 + 0xRRGGBB`. `0` means no fill.
- **Spacing.** Size 2 roughly doubles the boxes. Use about 220 px between columns and 220 px between rows, and more after a long name (`OutForDelivery` needed 280).
- **Match what is there.** If the model already has a state diagram, read its values first and reuse them, so all lifecycles look alike:

```ocl
PlacedState.allinstances->collect(p|p.ClassStateDiagram.Attribute.Owner.Name+' '+p.Vertex.Name+' color='+p.Color.asString+' size='+p.Size.asString+' @'+p.x.asString+','+p.y.asString)
AttributeStateDiagram.allinstances->collect(d|d.Attribute.Owner.Name+' zoom='+d.ZoomScaleFactor.asString)
```

A palette by meaning, taken from a diagram styled in the Designer (alpha `0xC8`):

| Meaning | RGB | `Color` value |
| --- | --- | --- |
| Waiting / new | `FF8000` | `-922779648` |
| In progress | `C04000` | `-926924800` |
| Under way / shipped | `C00000` | `-926941184` |
| Done | `00A050` | `-939483056` |
| Cancelled / failed | `C0C000` | `-926892032` |

`RenderedWidth` and `RenderedHeight` are written by the Designer when it draws; do not set them. The values above were set through MCP and read back; the drawn result was **not** looked at by the agent, so ask the user to open the diagram (close and reopen the tab if it was already open) and report overlapping arrows or labels.

## 4. Verify

Read back transitions with trigger and effect, the region's state attribute, every `PlacedState` (size, colour, position) and the model error list after a pause. Then save, restart the prototype and test: a new object starts in the first state, each trigger moves it, and a trigger called from the wrong state does nothing. Report structural checks and runtime checks separately.
