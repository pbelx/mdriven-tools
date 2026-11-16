---
name: mdriven-eval
description: Evaluate OCL (Object Constraint Language) queries or Action Language expressions against an active MDriven Designer model via its MCP server endpoint. Use for inspecting meta-model elements, querying classes, checking model errors, or running model transformations.
---

# MDriven Model Evaluation & Inspection

Interact with a running MDriven Designer instance via its MCP server (default port or user-specified port like `9999`).

## Usage

### Evaluate OCL Query (Read-only)

```powershell
node .agents/skills/mdriven-eval/scripts/eval.mjs -p <port> "<OCL_Expression>"
```

### Evaluate Action Language (State-modifying)

```powershell
node .agents/skills/mdriven-eval/scripts/eval.mjs -p <port> -a "<Action_Expression>"
```

(Fallback PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/mdriven-eval/scripts/eval_mdriven.ps1 -Port <port> -Expression "<expression>"`; add `-Action` for Action Language.)

Node's `fetch` refuses ports it treats as unsafe, including 6665-6669, and reports only `fetch failed`. If `curl` reaches the port but the Node script fails, use the PowerShell script for that port.

Several ports can reach the same Designer, and a port can keep serving a previously opened model. Before writing, confirm which model a port serves (for example, count `Span.allinstances` or look for a known ViewModel) and compare it with the Designer window title.

## Efficient evaluation

Node output is compact JSON: `ok`, `result`, `errors`, `modelErrorCount`, and `createdObjects` when present. `--debug` adds the echoed expression and full `rawInner`; use it only for response troubleshooting. PowerShell uses `-RawResponse` for those details.

For related queries, use `--batch-file <file>` or `--batch-file -` for stdin. Supply a JSON array:

```json
[
  {"expression":"Class.allinstances->collect(c|c.Name)"},
  {"expression":"Span.allinstances->collect(s|s.Name)"}
]
```

Each entry accepts `expression`, optional `action` (boolean), `context` (string), and `returnAggregates` (boolean). Entries inherit CLI options unless overridden. The entire input is validated first; jobs then execute sequentially over one session. Execution stops at the first failure and reports completed results, zero-based `failedIndex`, and `skippedCount`. Batches are not transactions: earlier mutations remain applied. Do not blindly retry a failed mutation batch.

Expression and MCP tool failures exit nonzero. Model errors are returned separately and remain visible on successful evaluations. Filter and project in OCL before returning large collections; keep aggregates off unless needed.

## Evaluator gotchas (verified on Designer metamodel)

- **Quotes:** escape a quote inside an OCL string literal with a backslash: `'\'text\''`. Doubled quotes (`''`) are a syntax error.
- **Precedence:** parenthesise comparisons inside `and`/`or`: `(a.Name='x') and (b.State='y')`. Otherwise you may get `String does not conform to Boolean`.
- **`.Substring`:** unreliable in this evaluator. It threw `StartIndex cannot be less than zero` on ids and long strings, and returned an empty string from a valid range. Do string work in the calling script instead: read the value, change it in PowerShell or Node, and write the whole value back.
- **Empty checks:** `String.notEmpty` is not available on attributes; use `not x.isNullOrEmpty`.
- **Assignment after `let ... in`:** wrap it, as in `(b.MaxSize := a.MaxSize)`. Without parentheses, the evaluator reported `"a" is not a type name`.
- **Long values (CSS, expressions):** build the string in a PowerShell variable, interpolate it into the expression, then read the value back and compare it with the string sent. Back up the previous value to a file first.
- **PowerShell script errors:** `eval_mdriven.ps1` reports failures with `Write-Error`, which stops a script that runs several queries. Wrap each call in `try { & $script ... -ErrorAction Stop } catch { ... }` when running a list of queries.
