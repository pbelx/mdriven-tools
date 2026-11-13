import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MDrivenClient } from '../_common/mdriven-client.mjs';

async function fixture(t, override = () => undefined) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    requests.push({ ...payload, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    let result = override(payload);
    if (payload.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    if (result === undefined) {
      if (payload.method === 'initialize') {
        res.setHeader('Mcp-Session-Id', 'test-session');
        result = { serverInfo: { name: 'test', version: '1' }, protocolVersion: '2024-11-05' };
      } else if (payload.method === 'tools/list') result = { tools: [{ name: 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel', description: 'Test tool' }] };
      else {
        const expression = payload.params.arguments.OCLOrActionExpression;
        const inner = { resultfromexpression: expression === 'null' ? null : ['Customer', 'Order'], modelwideErrors: [], createdobjects: [], expressionError: '' };
        if (expression === 'fail') { inner.expressionError = 'Unknown property'; inner.createdobjects = ['partial-id']; }
        if (expression === 'created') { inner.createdobjects = ['id-1']; inner.modelwideErrors = ['Existing model error']; }
        result = { content: [{ type: 'text', text: JSON.stringify({ OCLOrActionExpression: expression, RawJson: JSON.stringify(inner) }) }] };
      }
    }
    const response = JSON.stringify({ jsonrpc: '2.0', id: payload.id, result });
    if (payload.params?.arguments?.OCLOrActionExpression === 'sse') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.end(`: keepalive\n\nevent: message\ndata: ${response}\n\n`);
    } else res.end(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { requests, port: server.address().port };
}

async function cli(script, port, args = [], input = '') {
  const path = fileURLToPath(new URL(`../${script}`, import.meta.url));
  const powershell = script.endsWith('.ps1');
  const child = spawn(powershell ? 'powershell.exe' : process.execPath,
    powershell ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path, '-Port', String(port), ...args] : [path, '-p', String(port), ...args],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => stdout += data);
  child.stderr.on('data', data => stderr += data);
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  const timer = setTimeout(() => child.kill(), 15000);
  try {
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    return { code, stdout, stderr };
  } finally { clearTimeout(timer); }
}
const evalScript = 'mdriven-eval/scripts/eval.mjs';
const listScript = 'mdriven-list-tools/scripts/list_tools.mjs';

test('compact results preserve errors and created IDs; debug includes raw details', async t => {
  const f = await fixture(t);
  const client = new MDrivenClient({ port: f.port, host: '127.0.0.1' });
  const result = await client.evaluateOCL('created');
  assert.deepEqual(result, { ok: true, result: ['Customer', 'Order'], errors: ['Existing model error'], modelErrorCount: 1, createdObjects: ['id-1'] });
  assert.equal((await client.evaluateOCL('null')).result, null);
  const debug = new MDrivenClient({ port: f.port, host: '127.0.0.1', debug: true });
  const raw = await debug.evaluateOCL('created');
  assert.equal(raw.expression, 'created');
  assert.deepEqual(raw.rawInner.createdobjects, ['id-1']);
});

test('expression, tool and malformed envelope failures reject rather than report success', async t => {
  const f = await fixture(t, p => {
    const expression = p.params?.arguments?.OCLOrActionExpression;
    if (expression === 'toolError') return { isError: true, content: [{ text: 'Bad tool call' }] };
    if (expression === 'malformed') return { content: [{ text: '{' }] };
    if (expression === 'envelope') return { content: [{ text: '{}' }] };
  });
  const client = new MDrivenClient({ port: f.port, host: '127.0.0.1' });
  await assert.rejects(client.evaluateOCL('fail'), /Expression error: Unknown property/);
  await assert.rejects(client.evaluateOCL('toolError'), /MCP tool error: Bad tool call/);
  await assert.rejects(client.evaluateOCL('malformed'), /Invalid evaluator JSON/);
  await assert.rejects(client.evaluateOCL('envelope'), /Invalid evaluator response envelope/);
  assert.deepEqual((await client.evaluateOCL('sse')).result, ['Customer', 'Order']);
});

test('batch reuses session, preserves order and forwards per-job options', async t => {
  const f = await fixture(t);
  const result = await cli(evalScript, f.port, ['--batch-file', '-'], JSON.stringify([
    { expression: 'first' }, { expression: 'created', action: true, context: 'id-1', returnAggregates: true },
  ]));
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).results.length, 2);
  assert.equal(f.requests.length, 4);
  const calls = f.requests.filter(r => r.method === 'tools/call');
  assert.deepEqual(calls.map(r => r.params.arguments.OCLOrActionExpression), ['first', 'created']);
  assert.match(calls[1].params.name, /EvaluateActionLanguage/);
  assert.equal(calls[1].params.arguments.ContextForSelfNameOrId, 'id-1');
  assert.equal(calls[1].params.arguments.ReturnObjectAggregatesNotJustTheObject, true);
  assert.ok(f.requests.slice(1).every(r => r.headers['mcp-session-id'] === 'test-session'));
  const ids = f.requests.filter(r => r.id !== undefined).map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('batch stops on failure and reports completed results without retrying mutations', async t => {
  const f = await fixture(t);
  const result = await cli(evalScript, f.port, ['--batch-file', '-'], JSON.stringify([
    { expression: 'created', action: true }, { expression: 'fail', action: true }, { expression: 'never', action: true },
  ]));
  assert.equal(result.code, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.failedIndex, 1);
  assert.equal(report.results.length, 1);
  assert.equal(report.skippedCount, 1);
  assert.deepEqual(report.evaluation.createdObjects, ['partial-id']);
  assert.equal(f.requests.length, 4);
});

test('invalid later batch entry is rejected before any request', async t => {
  const f = await fixture(t);
  const result = await cli(evalScript, f.port, ['--batch-file', '-'], '[{"expression":"created","action":true},{"expression":"bad","action":"false"}]');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /action must be boolean/);
  assert.equal(f.requests.length, 0);
});

test('batch file supports CLI defaults and per-entry overrides', async t => {
  const f = await fixture(t);
  const dir = await mkdtemp(join(tmpdir(), 'mdriven-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'batch.json');
  await writeFile(path, JSON.stringify([{ expression: 'first' }, { expression: 'second', action: false }]));
  const result = await cli(evalScript, f.port, ['--batch-file', path, '--action', '--context', 'Target']);
  assert.equal(result.code, 0, result.stderr);
  const calls = f.requests.filter(r => r.method === 'tools/call');
  assert.match(calls[0].params.name, /EvaluateActionLanguage/);
  assert.match(calls[1].params.name, /EvaluateOCL/);
  assert.ok(calls.every(r => r.params.arguments.ContextForSelfNameOrId === 'Target'));
});

test('single CLI output is compact; expression failures exit nonzero', async t => {
  const f = await fixture(t);
  const result = await cli(evalScript, f.port, ['first']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  assert.equal('rawInner' in JSON.parse(result.stdout), false);
  const failed = await cli(evalScript, f.port, ['fail']);
  assert.equal(failed.code, 1);
  assert.equal(JSON.parse(failed.stderr).ok, false);
  assert.deepEqual(JSON.parse(failed.stderr).evaluation.createdObjects, ['partial-id']);
});

for (const [args, expected] of [[[], 3], [['--tools-only'], 3], [['--capabilities'], 6], [['--wiki'], 5], [['--capabilities', '--wiki'], 8]]) {
  test(`discovery ${args.join(' ') || 'default'} makes ${expected} requests`, async t => {
    const f = await fixture(t);
    const result = await cli(listScript, f.port, args);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(f.requests.length, expected);
    assert.equal(JSON.parse(result.stdout).tools.length, 1);
  });
}

test('discovery reports unavailable embedded capability without failing tool listing', async t => {
  const f = await fixture(t, p => p.method === 'tools/call' ? { isError: true, content: [{ text: 'Not supported' }] } : undefined);
  const result = await cli(listScript, f.port, ['--capabilities']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).probes.ocl.available, false);
});

test('refactor stops on its first failed action', async t => {
  const f = await fixture(t, p => p.method === 'tools/call' ? { isError: true, content: [{ text: 'Cannot rename' }] } : undefined);
  const result = await cli('mdriven-refactor/scripts/refactor.mjs', f.port, ['--from', 'Old', '--to', 'New']);
  assert.equal(result.code, 1);
  assert.equal(f.requests.filter(r => r.method === 'tools/call').length, 1);
  assert.doesNotMatch(result.stdout, /completed cleanly/);
});

test('doctor uses counts rather than capability docs and variable details', async t => {
  const f = await fixture(t, p => {
    const expression = p.params?.arguments?.OCLOrActionExpression;
    if (expression?.endsWith('->size')) return { content: [{ text: JSON.stringify({ RawJson: JSON.stringify({ resultfromexpression: 2, modelwideErrors: [] }) }) }] };
  });
  const result = await cli('mdriven-doctor/scripts/diagnose.mjs', f.port);
  assert.equal(result.code, 0, result.stderr);
  const expressions = f.requests.filter(r => r.method === 'tools/call').map(r => r.params.arguments.OCLOrActionExpression);
  assert.ok(expressions.includes('Span.allinstances.SpanVariables->size'));
  assert.ok(expressions.every(e => !e.includes('GetOverView')));
});

test('PowerShell evaluator returns compact results and rejects expression errors', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  const path = 'mdriven-eval/scripts/eval_mdriven.ps1';
  const result = await cli(path, f.port, ['-Expression', 'created']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, result: ['Customer', 'Order'], errors: ['Existing model error'], modelErrorCount: 1, createdObjects: ['id-1'] });
  const failure = await cli(path, f.port, ['-Expression', 'fail']);
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /Expression error/);
});

test('PowerShell discovery runs probes only when selected', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  const path = 'mdriven-list-tools/scripts/list_mdriven_tools.ps1';
  const result = await cli(path, f.port);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(f.requests.length, 3);
  assert.equal(JSON.parse(result.stdout).embeddedCapabilities.length, 0);
  const probes = await cli(path, f.port, ['-Capabilities', '-Wiki']);
  assert.equal(probes.code, 0, probes.stderr);
  assert.equal(f.requests.length, 11);
  assert.equal(JSON.parse(probes.stdout).embeddedCapabilities.length, 5);
});
