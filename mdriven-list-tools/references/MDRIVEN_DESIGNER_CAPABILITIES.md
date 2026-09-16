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
