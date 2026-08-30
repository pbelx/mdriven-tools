#!/usr/bin/env node

import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";

const usage = `MDriven REST CRUD Generator (Node.js)

Usage:
  mdriven-rest-crud <model-folder> [options]

Options:
      --viewmodel <name>   Patch only the named span/ViewModel.
      --all                Patch all spans with a root Class.
      --attribute <name>   Primary editable attribute (default: Name, then first class attribute).
      --list               List candidate spans and exit.
      --dry-run            Show what would change without writing files.
      --archive <file>     Update a .modlr archive after writing span files.
      --no-archive         Do not update any .modlr archive.
  -h, --help               Show help`;

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    process.exit(0);
  }

  const modelFolder = resolve(options.modelFolder);
  const files = await findFiles(modelFolder);
  const spanFiles = files.filter((file) => file.endsWith(".spans"));
  const packages = parsePackages(await readPackageFiles(files));
  const candidates = [];

  for (const file of spanFiles) {
    const xml = await readFile(file, "utf8");
    const span = parseSpanSummary(xml, file);
    if (!span?.className) continue;
    const attributes = packages.get(span.classId) ?? packages.get(span.className) ?? [];
    candidates.push({ file, xml, span, attributes });
  }

  candidates.sort((left, right) => left.span.name.localeCompare(right.span.name));

  if (options.list) {
    for (const candidate of candidates) {
      console.log(`${candidate.span.name}\t${candidate.span.className}\t${candidate.file}`);
    }
    process.exit(0);
  }

  const selected = selectCandidates(candidates, options);
  if (selected.length === 0) throw new Error("No matching span/ViewModel candidates found.");

  const changedFiles = [];
  for (const candidate of selected) {
    const primaryAttribute = choosePrimaryAttribute(candidate.attributes, options.attribute);
    if (!primaryAttribute) {
      console.log(`Skipping ${candidate.span.name}: no class attributes found for ${candidate.span.className}.`);
      continue;
    }

    const next = generateCrudSpan(candidate.xml, candidate.span, candidate.attributes, primaryAttribute);
    if (equivalentSpanXml(next, candidate.xml)) {
      console.log(`No changes needed: ${candidate.span.name}`);
      continue;
    }

    console.log(`${options.dryRun ? "Would update" : "Updated"} ${candidate.span.name} (${candidate.span.className}.${primaryAttribute})`);
    changedFiles.push(candidate.file);

    if (!options.dryRun) {
      await copyFile(candidate.file, `${candidate.file}.bak`);
      await writeFile(candidate.file, next, "utf8");
    }
  }

  if (!options.dryRun && changedFiles.length > 0 && !options.noArchive) {
    const archive = options.archive ? resolve(options.archive) : await findDefaultArchive(modelFolder);
    if (archive) updateArchive(archive, modelFolder, changedFiles);
  }

  console.log(`${options.dryRun ? "Dry run complete" : "Done"}: ${changedFiles.length} span file(s) ${options.dryRun ? "would be changed" : "changed"}.`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error("Run with --help for usage.");
  process.exit(1);
}

function parseArguments(args) {
  if (args.length === 0) throw new Error("A model folder is required.");
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") return { help: true };
    if (argument === "--all") {
      options.all = true;
    } else if (argument === "--list") {
      options.list = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--no-archive") {
      options.noArchive = true;
    } else if (argument === "--viewmodel" || argument === "--attribute" || argument === "--archive") {
      if (++index >= args.length) throw new Error(`Option ${argument} requires a value.`);
      options[argument.slice(2)] = args[index];
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

async function readPackageFiles(files) {
  const packages = [];
  for (const file of files.filter((path) => path.endsWith(".ecopkg"))) {
    packages.push(await readFile(file, "utf8"));
  }
  return packages;
}

function parsePackages(packageXmls) {
  const result = new Map();
  for (const xml of packageXmls) {
    for (const classMatch of xml.matchAll(/<Class\b([^>]*)>([\s\S]*?)<\/Class>/gi)) {
      const attrs = parseAttributes(classMatch[1]);
      const attributes = [...classMatch[2].matchAll(/<Attribute\b([^>]*)>/gi)]
        .map((match) => parseAttributes(match[1]).Name)
        .filter(Boolean);
      if (attrs.id) result.set(attrs.id, attributes);
      if (attrs.Name) result.set(attrs.Name, attributes);
    }
  }
  return result;
}

function parseSpanSummary(xml, file) {
  const spanTag = xml.match(/<Span\b([^>]*)>/i)?.[1];
  if (!spanTag) return null;
  const attrs = parseAttributes(spanTag);
  const beforeOwnedColumns = xml.split(/<OwnedColumns>/i)[0];
  const classTag = beforeOwnedColumns.match(/<Class>\s*<Class\b([^>]*)\/?>/i)?.[1];
  const classAttrs = classTag ? parseAttributes(classTag) : {};
  return {
    file,
    name: attrs.Name,
    id: attrs.id,
    className: classAttrs.Name,
    classId: classAttrs.idref,
    restAllowed: isRestAllowed(xml)
  };
}

function selectCandidates(candidates, options) {
  if (options.viewmodel) {
    return candidates.filter((candidate) => candidate.span.name === options.viewmodel);
  }

  if (options.all) return candidates;

  const restAllowed = candidates.filter((candidate) => candidate.span.restAllowed);
  if (restAllowed.length > 0) return restAllowed;
  if (candidates.length === 1) return candidates;

  throw new Error("Multiple candidate spans found. Use --viewmodel <name>, --all, or --list.");
}

function choosePrimaryAttribute(attributes, requested) {
  if (requested) {
    if (!attributes.includes(requested)) throw new Error(`Attribute ${requested} was not found on the target class.`);
    return requested;
  }
  return attributes.find((name) => name.toLowerCase() === "name") ?? attributes[0];
}

function generateCrudSpan(xml, span, attributes, primaryAttribute) {
  const clean = xml.replace(/^\uFEFF/, "");
  const nestingName = `All${span.className}`;
  const nestingId = stableExistingId(clean, "Nesting", nestingName) ?? randomUUID();
  const listColumnId = stableExistingTopLevelColumnId(clean, nestingName) ?? randomUUID();
  const displayColumnId = stableExistingTopLevelColumnId(clean, "DisplayMode") ?? randomUUID();
  const primaryColumnId = stableExistingTopLevelColumnId(clean, primaryAttribute) ?? randomUUID();
  const createColumnName = `New${primaryAttribute}`;
  const createColumnId = stableExistingTopLevelColumnId(clean, createColumnName) ?? randomUUID();
  const actionColumnId = stableExistingTopLevelColumnId(clean, "ApplyRest") ?? randomUUID();
  const variableName = `v${primaryAttribute}`;
  const nestingColumnIds = new Map([
    ["ExternalId", stableExistingColumnIdInNesting(clean, nestingName, "ExternalId") ?? randomUUID()],
    ...attributes.map((attribute) => [
      attribute,
      stableExistingColumnIdInNesting(clean, nestingName, attribute) ?? randomUUID()
    ])
  ]);

  let next = removeGeneratedCrudBlocks(clean, { nestingName, primaryAttribute, createColumnName });
  next = ensureRestAllowed(next);
  next = ensureSpanVariable(next, variableName, "String");

  const nestingXml = buildNestingXml({
    nestingName,
    nestingId,
    listColumnId,
    className: span.className,
    classId: span.classId,
    attributes,
    nestingColumnIds
  });

  const columnsXml = buildCrudColumnsXml({
    nestingName,
    nestingId,
    listColumnId,
    displayColumnId,
    primaryColumnId,
    createColumnName,
    createColumnId,
    actionColumnId,
    primaryAttribute,
    variableName,
    className: span.className
  });

  next = insertColumnsIntoTopLevelOwnedColumns(next, columnsXml);
  next = insertNesting(next, nestingXml);
  return next.startsWith("\uFEFF") ? next : `\uFEFF${next}`;
}

function buildNestingXml({ nestingName, nestingId, listColumnId, className, classId, attributes, nestingColumnIds }) {
  const columns = [
    columnXml({ name: "ExternalId", expression: "self.ExternalId", readOnly: "true", id: nestingColumnIds.get("ExternalId"), x: 0, y: 0 }),
    ...attributes.map((attribute, index) => columnXml({
      name: attribute,
      expression: `self.${attribute}`,
      readOnly: "true",
      id: nestingColumnIds.get(attribute),
      x: index + 1,
      y: 0,
      gridSpan: 2
    }))
  ].join("");

  return `    <Nesting
      Name="${escapeXml(nestingName)}"
      ExpressionActAsForActions=""
      id="${nestingId}">
      <Class>
        <Class
          Name="${escapeXml(className)}"
          idref="${classId}" />
      </Class>
      <OwnedColumns>
${columns}      </OwnedColumns>
      <ReferedByColumn>
        <Column
          Name="${escapeXml(nestingName)}"
          idref="${listColumnId}" />
      </ReferedByColumn>
      <TaggedValue>
        <TaggedValue
          Tag="MDriven.RestCrud.Generated"
          Value="True" />
      </TaggedValue>
    </Nesting>`;
}

function buildCrudColumnsXml({
  nestingName,
  nestingId,
  listColumnId,
  displayColumnId,
  primaryColumnId,
  createColumnName,
  createColumnId,
  actionColumnId,
  primaryAttribute,
  variableName,
  className
}) {
  const listVisible = "(selfVM.DisplayMode=#RestGet) or (selfVM.DisplayMode=#RestPost) or (selfVM.DisplayMode=#RestPatch) or (selfVM.DisplayMode=#RestPut) or (selfVM.DisplayMode=#RestDelete)";
  const actionExpression = `(selfVM.DisplayMode=#RestPost)->whentrue(\r\n  let created=${className}.Create in\r\n  (\r\n    created.${primaryAttribute}:=${variableName}\r\n  )\r\n);\r\n(selfVM.DisplayMode=#RestDelete)->whentrue(\r\n  self.Delete\r\n)`;

  return [
    columnXml({ name: "DisplayMode", expression: "selfVM.DisplayMode", readOnly: "true", id: displayColumnId, x: 1, y: 0 }),
    columnXml({ name: primaryAttribute, expression: `self.${primaryAttribute}`, visible: "(selfVM.DisplayMode=#RestPatch) or (selfVM.DisplayMode=#RestPut)", id: primaryColumnId, x: 1, y: 1, span: 3 }),
    columnXml({ name: createColumnName, expression: variableName, visible: "selfVM.DisplayMode=#RestPost", id: createColumnId, x: 1, y: 2, span: 3 }),
    columnXml({ name: "ApplyRest", expression: actionExpression, isAction: true, id: actionColumnId, x: 5, y: 3 }),
    `    <Column
      Name="${escapeXml(nestingName)}"
      ActionPeriodicityMillisec="-1"
      ColSpan="11"
      ColSpanWhenInGrid="1"
      Expression="${escapeXml(`${className}.allinstances->orderby(x|x.${primaryAttribute})`)}"
      ExpressionForReadOnly=""
      ExpressionForVisible="${escapeXml(listVisible)}"
      IsAction="False"
      IsStatic="False"
      NullRowMode="None"
      NullRowRepresentation=""
      PresentationString="&lt;Name&gt;"
      PresentationStringColSpan="1"
      RowSpan="8"
      StyleRef=""
      XPos="0"
      YPos="4"
      id="${listColumnId}">
      <ReferedNesting>
        <Nesting
          Name="${escapeXml(nestingName)}"
          idref="${nestingId}" />
      </ReferedNesting>
    </Column>
`
  ].join("");
}

function columnXml({ name, expression, readOnly = "", visible = "", isAction = false, id = randomUUID(), x = 1, y = 0, span = 1, gridSpan = 1 }) {
  return `    <Column
      Name="${escapeXml(name)}"
      ActionPeriodicityMillisec="-1"
      ColSpan="${span}"
      ColSpanWhenInGrid="${gridSpan}"
      Expression="${escapeXml(expression)}"
      ExpressionForReadOnly="${escapeXml(readOnly)}"
      ExpressionForVisible="${escapeXml(visible)}"
      IsAction="${isAction ? "True" : "False"}"
      IsStatic="False"
      NullRowMode="None"
      NullRowRepresentation=""
      PresentationString="&lt;Name&gt;"
      PresentationStringColSpan="1"
      RowSpan="1"
      StyleRef=""
      XPos="${x}"
      YPos="${y}"
      id="${id}" />
`;
}

function removeGeneratedCrudBlocks(xml, { nestingName, primaryAttribute, createColumnName }) {
  let next = xml;
  next = removeGeneratedNestingBlocks(next, nestingName);
  next = next.replace(/\s*<Nesting>\s*<\/Nesting>/gi, "");
  next = removeColumnByName(next, "DisplayMode");
  next = removeColumnByName(next, "ApplyRest");
  next = removeColumnByName(next, createColumnName);
  next = removeColumnByName(next, nestingName);
  next = removeColumnByNameWhen(next, primaryAttribute, (column) =>
    /#RestPatch/i.test(column) || /#RestPut/i.test(column)
  );
  return next;
}

function removeGeneratedNestingBlocks(xml, nestingName) {
  const marker = /<TaggedValue\s+Tag="MDriven\.RestCrud\.Generated"\s+Value="True"\s*\/>/i;
  const ranges = [];
  for (const block of findElementBlocks(xml, "Nesting")) {
    const body = xml.slice(block.start, block.end);
    const attrs = parseAttributes(body.match(/<Nesting\b([^>]*)/i)?.[1] ?? "");
    if (attrs.Name === nestingName || (attrs.Name && marker.test(body))) {
      ranges.push(block);
    }
  }

  const innermost = ranges
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))
    .filter((range, index, all) => !all.some((other, otherIndex) =>
      otherIndex < index && range.start >= other.start && range.end <= other.end
    ))
    .sort((left, right) => right.start - left.start);

  let next = xml;
  for (const range of innermost) {
    const whitespaceStart = findWhitespaceStart(next, range.start);
    next = `${next.slice(0, whitespaceStart)}${next.slice(range.end)}`;
  }
  return next;
}

function findWhitespaceStart(text, index) {
  let cursor = index;
  while (cursor > 0 && /[ \t]/.test(text[cursor - 1])) cursor -= 1;
  if (cursor > 0 && text[cursor - 1] === "\n") cursor -= 1;
  return cursor;
}

function insertNesting(xml, nestingXml) {
  const ownedColumnsIndex = findTopLevelOwnedColumnsIndex(xml);
  if (ownedColumnsIndex < 0) throw new Error("Could not find top-level <OwnedColumns> insertion point.");

  const beforeOwnedColumns = xml.slice(0, ownedColumnsIndex);
  const after = xml.slice(ownedColumnsIndex);
  const nestingCloseIndex = beforeOwnedColumns.lastIndexOf("</Nesting>");

  if (nestingCloseIndex >= 0) {
    return `${beforeOwnedColumns.slice(0, nestingCloseIndex)}${nestingXml}\n  ${beforeOwnedColumns.slice(nestingCloseIndex)}${after}`;
  }

  return `${beforeOwnedColumns}  <Nesting>\n${nestingXml}\n  </Nesting>\n  ${after}`;
}

function insertColumnsIntoTopLevelOwnedColumns(xml, columnsXml) {
  const index = findTopLevelOwnedColumnsIndex(xml);
  if (index < 0) throw new Error("Could not find top-level <OwnedColumns>.");
  const open = xml.slice(index).match(/<OwnedColumns>/i)?.[0];
  return `${xml.slice(0, index)}${open}\n${columnsXml}${xml.slice(index + open.length)}`;
}

function findTopLevelOwnedColumnsIndex(xml) {
  const tokenPattern = /<Nesting\b[^>]*>|<\/Nesting>|<OwnedColumns>/gi;
  let depth = 0;
  let match;
  while ((match = tokenPattern.exec(xml)) !== null) {
    const token = match[0];
    if (/^<OwnedColumns>/i.test(token) && depth === 0) return match.index;
    if (/^<\/Nesting>/i.test(token)) {
      depth = Math.max(0, depth - 1);
    } else if (/^<Nesting\b/i.test(token) && !token.endsWith("/>")) {
      depth += 1;
    }
  }
  return -1;
}

function removeColumnByName(xml, name) {
  return removeColumnByNameWhen(xml, name, () => true);
}

function removeColumnByNameWhen(xml, name, predicate) {
  const ranges = [];
  for (const block of findElementBlocks(xml, "Column")) {
    const body = xml.slice(block.start, block.end);
    const attrs = parseAttributes(body.match(/<Column\b([^>]*)/i)?.[1] ?? "");
    if (attrs.Name === name && predicate(body)) ranges.push(block);
  }
  return removeRanges(xml, ranges);
}

function findElementBlocks(xml, tagName) {
  const blocks = [];
  const stack = [];
  const tokenPattern = new RegExp(`<${tagName}\\b[^>]*>|<\\/${tagName}>`, "gi");
  let match;

  while ((match = tokenPattern.exec(xml)) !== null) {
    const token = match[0];
    if (token.startsWith("</")) {
      const start = stack.pop();
      if (start != null) blocks.push({ start, end: tokenPattern.lastIndex });
    } else if (token.endsWith("/>")) {
      blocks.push({ start: match.index, end: tokenPattern.lastIndex });
    } else {
      stack.push(match.index);
    }
  }
  return blocks;
}

function removeRanges(xml, ranges) {
  let next = xml;
  for (const range of ranges.sort((left, right) => right.start - left.start)) {
    const whitespaceStart = findWhitespaceStart(next, range.start);
    next = `${next.slice(0, whitespaceStart)}${next.slice(range.end)}`;
  }
  return next;
}

function stableExistingId(xml, tagName, name) {
  const match = xml.match(new RegExp(`<${tagName}\\b(?=[^>]*\\bName=["']${escapeRegExp(name)}["'])([^>]*)`, "i"));
  return match ? parseAttributes(match[1]).id : null;
}

function stableExistingTopLevelColumnId(xml, name) {
  const nestingRanges = findElementBlocks(xml, "Nesting")
    .filter((block) => !xml.slice(block.start, block.end).match(/^<Nesting\b[^>]*\/>$/i));

  for (const column of findElementBlocks(xml, "Column")) {
    if (nestingRanges.some((range) => column.start > range.start && column.start < range.end)) continue;
    const body = xml.slice(column.start, column.end);
    const attrs = parseAttributes(body.match(/<Column\b([^>]*)/i)?.[1] ?? "");
    if (attrs.Name === name && attrs.id) return attrs.id;
  }
  return null;
}

function stableExistingColumnIdInNesting(xml, nestingName, columnName) {
  for (const block of findElementBlocks(xml, "Nesting")) {
    const body = xml.slice(block.start, block.end);
    const attrs = parseAttributes(body.match(/<Nesting\b([^>]*)/i)?.[1] ?? "");
    if (attrs.Name !== nestingName) continue;

    for (const column of findElementBlocks(body, "Column")) {
      const columnBody = body.slice(column.start, column.end);
      const columnAttrs = parseAttributes(columnBody.match(/<Column\b([^>]*)/i)?.[1] ?? "");
      if (columnAttrs.Name === columnName && columnAttrs.id) return columnAttrs.id;
    }
  }
  return null;
}

function ensureRestAllowed(xml) {
  if (isRestAllowed(xml)) return xml;
  const taggedValue = `  <TaggedValue>
    <TaggedValue
      Tag="Eco.RestAllowed"
      Value="True" />
  </TaggedValue>
`;
  if (/<TaggedValue>/i.test(xml)) {
    return xml.replace(/<TaggedValue>/i, `<TaggedValue>
    <TaggedValue
      Tag="Eco.RestAllowed"
      Value="True" />`);
  }
  return insertBefore(xml, /<\/Span>/i, taggedValue);
}

function ensureSpanVariable(xml, name, typeName) {
  if (new RegExp(`<SpanVariable\\b[^>]*\\bName=["']${escapeRegExp(name)}["']`, "i").test(xml)) return xml;
  const variable = `    <SpanVariable
      Name="${escapeXml(name)}"
      InitialValue=""
      TypeName="${escapeXml(typeName)}"
      UserData="" />
`;
  if (/<SpanVariables>/i.test(xml)) return xml.replace(/<SpanVariables>/i, `<SpanVariables>\n${variable}`);
  return insertBefore(xml, /<\/Span>/i, `  <SpanVariables>\n${variable}  </SpanVariables>\n`);
}

function insertBefore(xml, pattern, text) {
  if (!pattern.test(xml)) throw new Error(`Could not find insertion point ${pattern}.`);
  pattern.lastIndex = 0;
  return xml.replace(pattern, `${text}$&`);
}

function equivalentSpanXml(left, right) {
  return normalizeGeneratedWhitespace(left) === normalizeGeneratedWhitespace(right);
}

function normalizeGeneratedWhitespace(value) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n{2,}(\s*<\/OwnedColumns>)/g, "\n$1")
    .trim();
}

async function findDefaultArchive(modelFolder) {
  const parent = dirname(modelFolder);
  const expected = resolve(parent, `${basename(modelFolder)}.modlr`);
  if (await exists(expected)) return expected;
  const files = await readdir(parent);
  const modlr = files.find((file) => extname(file).toLowerCase() === ".modlr");
  return modlr ? resolve(parent, modlr) : null;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function updateArchive(archive, modelFolder, changedFiles) {
  for (const file of changedFiles) {
    const relative = file.slice(modelFolder.length + 1);
    const result = spawnSync("zip", ["-u", archive, relative], {
      cwd: modelFolder,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(`Failed to update archive ${archive}: ${result.stderr || result.stdout}`);
    }
  }
  console.log(`Updated archive: ${archive}`);
}

function isRestAllowed(xml) {
  return /<TaggedValue\b[^>]*\bTag=["']Eco\.RestAllowed["'][^>]*\bValue=["']True["'][^>]*\/?\s*>/i.test(xml)
    || /<TaggedValue\b[^>]*\bValue=["']True["'][^>]*\bTag=["']Eco\.RestAllowed["'][^>]*\/?\s*>/i.test(xml);
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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r", "&#xD;")
    .replaceAll("\n", "&#xA;")
    .replaceAll("\t", "&#x9;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
