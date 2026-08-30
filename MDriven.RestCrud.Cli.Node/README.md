# MDriven REST CRUD CLI — Node.js

Dependency-free Node.js CLI that adds a REST CRUD pattern to MDriven `.spans` ViewModels.

The tool works on expanded model folders that contain `.spans` and `.ecopkg` files.

## Usage

```bash
node src/cli.js <model-folder> [options]
```

List candidate spans:

```bash
node src/cli.js /path/to/model-folder --list
```

Patch one ViewModel:

```bash
node src/cli.js /path/to/model-folder --viewmodel TestView
```

Patch all spans with a root class:

```bash
node src/cli.js /path/to/model-folder --all
```

Preview changes without writing:

```bash
node src/cli.js /path/to/model-folder --viewmodel TestView --dry-run
```

Choose the primary editable attribute:

```bash
node src/cli.js /path/to/model-folder --viewmodel CustomerRest --attribute CustomerName
```

## What It Generates

For each selected span, the tool:

- Adds `Eco.RestAllowed=True` if missing.
- Infers the root class from the span.
- If the span has no explicit root class, infers one from `self.{Attribute}` expressions when the match is unambiguous, then writes the missing root `<Class>` block.
- Reads class attributes from `.ecopkg`.
- Chooses `Name` as the primary CRUD field when available, otherwise the first class attribute.
- Adds a `DisplayMode` diagnostic column.
- Adds an editable update column bound to `self.{Attribute}` for `#RestPatch` and `#RestPut`.
- Adds a create input column named `New{Attribute}` bound to `v{Attribute}` for `#RestPost`.
- Adds an `ApplyRest` action that branches on `selfVM.DisplayMode`.
- Adds an `All{Class}` result nesting with `ExternalId` and class attributes.

Generated action pattern:

```ocl
(selfVM.DisplayMode=#RestPost)->whentrue(
  let created=ClassName.Create in
  (
    created.Attribute:=vAttribute
  )
);
(selfVM.DisplayMode=#RestDelete)->whentrue(
  self.Delete
)
```

## Action Ordering

The generated `ApplyRest` action is placed after the create input column. This is intentional: Turnkey applies posted form values before action columns that appear after non-action columns. If the action is placed before the input column, create can run before `vAttribute` is bound.

## Archive Updates

By default, the tool looks for a matching `.modlr` archive next to the model folder and updates changed `.spans` entries with `zip -u`.

Disable archive update:

```bash
node src/cli.js /path/to/model-folder --viewmodel TestView --no-archive
```

Use a specific archive:

```bash
node src/cli.js /path/to/model-folder --viewmodel TestView --archive /path/to/model.modlr
```

Before writing a changed span, the tool creates a `.bak` backup next to the original `.spans` file.

## REST Endpoints After Generation

The generated span is meant to support:

```text
GET    /Rest/{Span}/Get
POST   /Rest/{Span}/Post
PUT    /Rest/{Span}/Put/{externalId}
PATCH  /Rest/{Span}/Patch/{externalId}
DELETE /Rest/{Span}/Delete/{externalId}
```

Write request bodies should use:

```text
Content-Type: application/x-www-form-urlencoded
```
