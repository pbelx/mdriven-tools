# MDriven Designer MCP Capability Notes

These findings were verified against a local MDriven Designer on port `8888` using Designer revision `7.2.0.17528`. The MCP server identified itself as `MDrivenDesignerMCPServer 7.2.0.0` and negotiated protocol `2024-11-05`.

Revision `17526` introduced `MetaModelMetaInfo`, Wiki search/page lookup, and related improvements. Older builds can expose the same top-level evaluator tools without supporting these embedded functions, so always inspect the running server.

## Top-level tools versus embedded capabilities

`tools/list` reports the MCP tools. Much of the useful Designer API is then reached by sending expressions to:

- `MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel` for read-only queries
- `MCPTool_MDrivenDesigner_EvaluateActionLanguageOnMetaModel` for action expressions that can mutate the model

Use these discovery expressions before assuming an operation exists:

```ocl
MCPServerInfo.GetOverViewOfCapabilitiesForOCL
MCPServerInfo.GetOverViewOfCapabilitiesForActionLanguage
MCPServerInfo.MetaModelMetaInfo('Attribute')
```

`MetaModelMetaInfo(typeName)` returns metadata for a metamodel type, including its properties, associations, and callable operations. It is the best way to discover the exact API supported by the current Designer build.

## MDriven Wiki access

The Designer can search and retrieve MDriven Wiki content through the read-only OCL evaluator:

```ocl
MCPServerInfo.WikiSearch('OpenDocument report')
MCPServerInfo.WikiFetch('Documentation:MCP')
```

Search first when the exact page title is unknown, then fetch the selected title.

## Designer Vibe data

The following read-only expression returns the prompt currently associated with Vibe information:

```ocl
MCPServerInfo.GetVibeInformationPrompt()
```

On the verified build it returned `Please provide information about the Vibe.`

The richer Vibe methods must be invoked through the Action Language evaluator:

```ocl
Diagram.allinstances->first.GetTajsonInformationVibe()
MCPServerInfo.GetPromptToReachUserWishThatIncludesCurrentDiagramModel('Describe the requested change')
```

`GetTajsonInformationVibe()` returns TAJSON describing the current diagram: placed classes, attributes, placed view models, and association information. Association records can appear once in each direction, so consumers should normalize them before counting or displaying associations.

`GetPromptToReachUserWishThatIncludesCurrentDiagramModel(...)` returns instructions, the expected JSON response schema, current-model TAJSON, and the supplied user wish.

Although these calls can be observational, the Action Language evaluator itself is mutation-capable. Inspect `createdobjects`, `modelwideErrors`, and `expressionError` in every result.

## Associations and visible diagram lines

Semantic associations and their visible diagram connections are separate:

- `Association` represents the relationship in the model.
- `AssociationEndConnection` represents its placement/line on a diagram.

If associations exist but their lines are missing, inspect the `Diagram` metadata and run this through the Action Language evaluator with the intended diagram as context:

```ocl
self.RestoreAssociations()
```

`RestoreAssociations()` creates the missing diagram connection objects. It cannot reconstruct semantic associations when `Association.allinstances` is empty.

### Creating associations that survive save and reopen

An `Association` created through Action Language must be owned by the model package. Creating the association and its two ends without package ownership can make a line appear temporarily, but saving reports errors such as:

```text
AssociationEnd InvoiceLine.Invoice not part of association.
Probably due to incorrect or missing UmlElement attribute
```

The relationships then disappear when the model is reopened. The required ownership step is:

```ocl
pkg.OwnedElement.Add(assoc)
```

A complete creation pattern is:

```ocl
let pkg=Package.allinstances->first in
(
  let left=Class.allinstances->select(c|c.Name='Invoice')->first in
  (
    let right=Class.allinstances->select(c|c.Name='InvoiceLine')->first in
    (
      let assoc=Association.Create in
      (
        pkg.OwnedElement.Add(assoc);
        assoc.AssociationEnd.Add(AssociationEnd.Create);
        assoc.AssociationEnd.Add(AssociationEnd.Create);
        assoc.AssociationEnd.at0(0).Participant:=left;
        assoc.AssociationEnd.at0(0).Name:='Invoice';
        assoc.AssociationEnd.at0(0).Multiplicity:='1';
        assoc.AssociationEnd.at0(1).Participant:=right;
        assoc.AssociationEnd.at0(1).Name:='Lines';
        assoc.AssociationEnd.at0(1).Multiplicity:='0..*'
      )
    )
  )
)
```

When repairing a model whose prototype-data `ModelInfo` already references association-end IDs, assign those existing IDs to the recreated ends or update the prototype-data metadata. Otherwise, prototype data can point to obsolete model elements.

Before saving, verify that every association has a package and exactly two ends:

```ocl
Association.allinstances
  ->collect(a|a.Package_.Name.concat('|').concat(a.AssociationEnd->size.asString))
```

Each result should resemble `Package1|2`. Then restore the visual connections:

```ocl
Diagram.allinstances->first.RestoreAssociations()
```

Finally, save with `Ctrl+S`, reopen the model, and verify that `Association.allinstances->size` and `AssociationEndConnection.allinstances->size` still have the expected values. A visible line alone does not prove that the semantic association is persistable.

After an MCP mutation, explicitly save the model in Designer with `Ctrl+S`.

## Evaluator response envelope

Evaluator results are nested JSON. The outer text object contains:

- `OCLOrActionExpression`
- `RawJson`, itself encoded as a JSON string

After parsing `RawJson`, inspect:

- `resultfromexpression`
- `expressionError`
- `createdobjects`
- `modelwideErrors`
- `context`

Do not rely only on the transport-level MCP success response; an expression can fail inside an otherwise successful tool call.
