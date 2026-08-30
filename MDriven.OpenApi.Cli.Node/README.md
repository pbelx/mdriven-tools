# MDriven OpenAPI CLI — Node.js

Dependency-free Node.js CLI that generates OpenAPI 3.0 JSON from MDriven
`.spans` ViewModels tagged `Eco.RestAllowed=True`.

```bash
node src/cli.js <model-folder>
```

Install it locally as a command:

```bash
npm install
npm link
mdriven-openapi <model-folder>
```

Run `node src/cli.js --help` for all options.

## Generated Contract

For each RestAllowed span, the generator emits Turnkey REST routes:

```text
GET    /Rest/{Span}/Get
POST   /Rest/{Span}/Post
PUT    /Rest/{Span}/Put/{externalId}
PATCH  /Rest/{Span}/Patch/{externalId}
DELETE /Rest/{Span}/Delete/{externalId}
```

If the span has `RequiresRootObject=True`, an additional `GET /Rest/{Span}/Get/{externalId}` route is emitted.

Write operations use `application/x-www-form-urlencoded` request bodies. The body fields are inferred from editable top-level span columns:

- `POST`: editable fields visible for `#RestPost`, plus variable-backed fields such as create inputs.
- `PUT` and `PATCH`: editable fields visible for `#RestPut` or `#RestPatch`, plus `self.*` fields.

Responses include both `text/plain` and `application/json` content entries because Turnkey may return JSON text as `text/plain; charset=utf-8`.

Nested span columns that reference a `<Nesting>` are emitted as arrays of objects, using the nesting's non-action columns as item properties.

## Notes

The CLI reads expanded model folders containing `.spans` files. If Turnkey is loading a `.modlr` archive, extract or use the model's expanded folder before running the CLI.
