#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const usage = `MDriven OpenAPI Generator (Node.js)

Usage:
  mdriven-openapi <model-folder> [options]

Options:
  -o, --output <file>  Output file (default: <model-folder>/openapi.json)
      --title <text>   API title (default: MDriven Turnkey REST API)
      --version <text> API version (default: 1.0.0)
      --server <url>   Turnkey base URL (default: /)
  -h, --help           Show help`;

const REST_VERBS = ["Get", "Post", "Put", "Patch", "Delete"];
const WRITE_VERBS = new Set(["Post", "Put", "Patch"]);
const ID_VERBS = new Set(["Put", "Patch", "Delete"]);
const RESPONSE_CONTENT = {
  "text/plain": { schema: null },
  "application/json": { schema: null }
};

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    process.exit(0);
  }

  const modelFolder = resolve(options.modelFolder);
  const output = resolve(options.output ?? resolve(modelFolder, "openapi.json"));
  const files = (await findFiles(modelFolder)).filter((file) => file.endsWith(".spans"));
  const viewModels = [];

  for (const file of files) {
    const xml = await readFile(file, "utf8");
    if (isRestAllowed(xml)) viewModels.push(parseSpan(xml, file));
  }

  viewModels.sort((left, right) => left.name.localeCompare(right.name));
  const spec = buildSpecification(viewModels, options);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  console.log(`Generated ${output} from ${viewModels.length} RestAllowed ViewModel(s).`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error("Run with --help for usage.");
  process.exit(1);
}

function parseArguments(args) {
  if (args.length === 0) throw new Error("A model folder is required.");
  const options = {
    title: "MDriven Turnkey REST API",
    version: "1.0.0",
    server: "/"
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") return { help: true };
    const names = { "-o": "output", "--output": "output", "--title": "title", "--version": "version", "--server": "server" };
    if (names[argument]) {
      if (++index >= args.length) throw new Error(`Option ${argument} requires a value.`);
      options[names[argument]] = args[index];
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (options.modelFolder) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      options.modelFolder = argument;
    }
  }

  if (!options.modelFolder) throw new Error("A model folder is required.");
  return options;
}

async function findFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(folder, entry.name);
    return entry.isDirectory() ? findFiles(path) : [path];
  }));
  return nested.flat();
}

function isRestAllowed(xml) {
  return /<TaggedValue\b[^>]*\bTag=["']Eco\.RestAllowed["'][^>]*\bValue=["']True["'][^>]*\/?\s*>/i.test(xml)
    || /<TaggedValue\b[^>]*\bValue=["']True["'][^>]*\bTag=["']Eco\.RestAllowed["'][^>]*\/?\s*>/i.test(xml);
}

function parseSpan(xml, file) {
  const root = parseXml(xml);
  const span = root.children.find((node) => node.name === "Span");
  if (!span) throw new Error(`Invalid span XML: ${file}`);
  const name = span.attrs.Name;
  if (!name) throw new Error(`Span has no Name: ${file}`);

  const variables = child(span, "SpanVariables")?.children
    .filter((node) => node.name === "SpanVariable")
    .map((node) => ({ name: node.attrs.Name, type: node.attrs.TypeName }))
    .filter((variable) => variable.name) ?? [];

  const nestings = parseNestings(span);
  const columns = parseTopLevelColumns(span, nestings);

  return {
    name,
    requiresRoot: /^true$/i.test(span.attrs.RequiresRootObject ?? ""),
    variables,
    columns,
    schema: schemaFromColumns(columns),
    requestSchemas: requestSchemasFromColumns(columns)
  };
}

function parseTopLevelColumns(span, nestings) {
  return child(span, "OwnedColumns")?.children
    .filter((node) => node.name === "Column")
    .map((column) => {
      const referedNesting = firstDescendant(column, "ReferedNesting")?.children.find((node) => node.name === "Nesting");
      const nesting = referedNesting ? nestings.get(referedNesting.attrs.idref) ?? nestings.get(referedNesting.attrs.Name) : null;
      return {
        name: column.attrs.Name,
        expression: column.attrs.Expression ?? "",
        visible: column.attrs.ExpressionForVisible ?? "",
        readOnly: column.attrs.ExpressionForReadOnly ?? "",
        isAction: /^true$/i.test(column.attrs.IsAction ?? ""),
        nesting
      };
    })
    .filter((column) => column.name) ?? [];
}

function parseNestings(span) {
  const result = new Map();
  const nestingContainer = child(span, "Nesting");
  if (!nestingContainer) return result;

  for (const nesting of nestingContainer.children.filter((node) => node.name === "Nesting")) {
    const columns = child(nesting, "OwnedColumns")?.children
      .filter((node) => node.name === "Column")
      .filter((column) => !/^true$/i.test(column.attrs.IsAction ?? ""))
      .map((column) => ({
        name: column.attrs.Name,
        expression: column.attrs.Expression ?? "",
        readOnly: column.attrs.ExpressionForReadOnly ?? ""
      }))
      .filter((column) => column.name) ?? [];

    const parsed = {
      name: nesting.attrs.Name,
      id: nesting.attrs.id,
      schema: schemaFromScalarColumns(columns)
    };
    if (parsed.id) result.set(parsed.id, parsed);
    if (parsed.name) result.set(parsed.name, parsed);
  }

  return result;
}

function schemaFromColumns(columns) {
  const properties = {};
  for (const column of columns) {
    if (column.isAction) continue;
    properties[column.name] = column.nesting
      ? { type: "array", items: column.nesting.schema }
      : inferSchema(column.name, column.expression);
  }
  return { type: "object", properties, additionalProperties: true };
}

function schemaFromScalarColumns(columns) {
  const properties = {};
  for (const column of columns) {
    properties[column.name] = inferSchema(column.name, column.expression);
  }
  return { type: "object", properties, additionalProperties: true };
}

function requestSchemasFromColumns(columns) {
  const scalarEditable = columns.filter((column) =>
    !column.isAction
    && !column.nesting
    && !isReadOnly(column)
    && !isDiagnosticColumn(column)
  );

  const postFields = scalarEditable.filter((column) => visibleMentions(column, "RestPost") || !isSelfField(column));
  const updateFields = scalarEditable.filter((column) =>
    visibleMentions(column, "RestPatch")
    || visibleMentions(column, "RestPut")
    || isSelfField(column)
  );

  return {
    Post: schemaFromRequestFields(postFields),
    Put: schemaFromRequestFields(updateFields),
    Patch: schemaFromRequestFields(updateFields)
  };
}

function schemaFromRequestFields(fields) {
  const properties = {};
  for (const field of fields) {
    properties[field.name] = inferSchema(field.name, field.expression);
  }
  return {
    type: "object",
    properties,
    additionalProperties: fields.length === 0
  };
}

function inferSchema(name = "", expression = "") {
  const text = `${name} ${expression}`.toLowerCase();
  if (/^selfvm\.displaymode$/i.test(expression.trim()) || /^displaymode$/i.test(name)) {
    return {
      type: "integer",
      format: "int32",
      nullable: true,
      description: "Numeric serialization of selfVM.DisplayMode."
    };
  }
  if (/\b(is|has|can)[a-z0-9_]*\b/.test(name) || /boolean|#true|#false|=true|=false/.test(text)) {
    return { type: "boolean", nullable: true };
  }
  if (/datetime|date\./.test(text)) return { type: "string", format: "date-time", nullable: true };
  if (/guid|uuid/.test(text)) return { type: "string", format: "uuid", nullable: true };
  if (/int64|long/.test(text)) return { type: "integer", format: "int64", nullable: true };
  if (/integer|int32|\bcount\b|\bsize\b/.test(text)) return { type: "integer", format: "int32", nullable: true };
  if (/decimal|double|float|number/.test(text)) return { type: "number", nullable: true };
  return { type: "string", nullable: true };
}

function schemaForType(type = "") {
  const schemas = {
    integer: { type: "integer", format: "int32" }, int32: { type: "integer", format: "int32" },
    int64: { type: "integer", format: "int64" }, decimal: { type: "number", format: "decimal" },
    double: { type: "number", format: "double" }, float: { type: "number", format: "float" },
    boolean: { type: "boolean" }, datetime: { type: "string", format: "date-time" },
    guid: { type: "string", format: "uuid" }, string: { type: "string" }
  };
  return schemas[type.toLowerCase()] ?? { type: "string" };
}

function isReadOnly(column) {
  return /^true$/i.test(column.readOnly.trim());
}

function isDiagnosticColumn(column) {
  return /^selfVM\.DisplayMode$/i.test(column.expression.trim());
}

function visibleMentions(column, mode) {
  return new RegExp(`#${mode}\\b`, "i").test(column.visible);
}

function isSelfField(column) {
  return /^self\./i.test(column.expression.trim());
}

function buildSpecification(viewModels, options) {
  const paths = {};
  const schemas = {};

  for (const viewModel of viewModels) {
    const responseSchemaName = `${viewModel.name}Response`;
    schemas[responseSchemaName] = viewModel.schema;

    for (const verb of REST_VERBS) {
      const requestSchemaName = `${verb}${viewModel.name}Request`;
      if (viewModel.requestSchemas[verb]) schemas[requestSchemaName] = viewModel.requestSchemas[verb];

      const route = `/Rest/${viewModel.name}/${verb}${ID_VERBS.has(verb) ? "/{externalId}" : ""}`;
      paths[route] = {
        [verb.toLowerCase()]: operationForVerb(viewModel, verb, responseSchemaName, requestSchemaName)
      };

      if (verb === "Get" && viewModel.requiresRoot) {
        paths[`/Rest/${viewModel.name}/${verb}/{externalId}`] = {
          get: operationForVerb(viewModel, verb, responseSchemaName, requestSchemaName, true)
        };
      }
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: options.title,
      version: options.version,
      description: "Generated from MDriven ViewModels tagged Eco.RestAllowed=True."
    },
    servers: [{ url: options.server }],
    paths,
    components: {
      parameters: {
        ExternalId: {
          name: "externalId",
          in: "path",
          required: true,
          description: "MDriven external object identifier returned by the ViewModel, for example 0!2.",
          schema: { type: "string" }
        }
      },
      schemas,
      responses: {
        MDrivenError: {
          description: "MDriven plain text error response.",
          content: { "text/plain": { schema: { type: "string" } } }
        }
      }
    }
  };
}

function operationForVerb(viewModel, verb, responseSchemaName, requestSchemaName, forceId = false) {
  const lower = verb.toLowerCase();
  const operation = {
    operationId: `${lower}${viewModel.name}${forceId ? "ById" : ""}`,
    summary: `${verb} ${viewModel.name}`,
    tags: [viewModel.name],
    parameters: parametersFor(viewModel, verb, forceId),
    "x-mdriven-viewmodel": viewModel.name,
    "x-mdriven-verb": verb,
    "x-mdriven-display-mode": `Rest${verb}`,
    responses: {
      200: {
        description: "MDriven ViewModel result.",
        content: responseContent(responseSchemaName)
      },
      default: { $ref: "#/components/responses/MDrivenError" }
    }
  };

  if (WRITE_VERBS.has(verb)) {
    operation.requestBody = {
      required: false,
      content: {
        "application/x-www-form-urlencoded": {
          schema: { $ref: `#/components/schemas/${requestSchemaName}` }
        }
      }
    };
  }

  return operation;
}

function parametersFor(viewModel, verb, forceId) {
  const parameters = [];
  if (ID_VERBS.has(verb) || forceId) parameters.push({ $ref: "#/components/parameters/ExternalId" });

  if (verb === "Get") {
    parameters.push(...viewModel.variables.map((variable) => ({
      name: variable.name,
      in: "query",
      required: false,
      schema: schemaForType(variable.type)
    })));
  }

  return parameters;
}

function responseContent(schemaName) {
  return Object.fromEntries(Object.keys(RESPONSE_CONTENT).map((contentType) => [
    contentType,
    { schema: { $ref: `#/components/schemas/${schemaName}` } }
  ]));
}

function parseXml(xml) {
  const root = { name: "#document", attrs: {}, children: [] };
  const stack = [root];
  const tokenPattern = /<([^!?][^>]*)>/g;
  let match;

  while ((match = tokenPattern.exec(xml.replace(/^\uFEFF/, ""))) !== null) {
    let token = match[1].trim();
    if (!token || token.startsWith("?") || token.startsWith("!--")) continue;
    if (token.startsWith("/")) {
      const closingName = token.slice(1).trim().split(/\s+/)[0];
      while (stack.length > 1 && stack.at(-1).name !== closingName) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = token.endsWith("/");
    if (selfClosing) token = token.slice(0, -1).trim();
    const name = token.split(/\s+/, 1)[0];
    const node = { name, attrs: parseAttributes(token.slice(name.length)), children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root;
}

function parseAttributes(input) {
  const attrs = {};
  const attrPattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrPattern.exec(input)) !== null) {
    attrs[match[1]] = decodeXml(match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function decodeXml(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
    .replaceAll("&#xD;", "\r").replaceAll("&#xA;", "\n").replaceAll("&#x9;", "\t");
}

function child(node, name) {
  return node.children.find((candidate) => candidate.name === name);
}

function firstDescendant(node, name) {
  for (const candidate of node.children) {
    if (candidate.name === name) return candidate;
    const nested = firstDescendant(candidate, name);
    if (nested) return nested;
  }
  return null;
}
