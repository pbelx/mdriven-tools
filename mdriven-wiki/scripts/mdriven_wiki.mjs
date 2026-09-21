#!/usr/bin/env node

const ENDPOINT = 'https://wiki.mdriven.net/mcp/public';
const PROTOCOL_VERSION = '2025-06-18';

function usage() {
  console.error('Usage: node mdriven_wiki.mjs tools | call <tool-name> <json-arguments|->');
  process.exit(2);
}

async function readStdin() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

function parseSseOrJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('event:') && !trimmed.startsWith('data:')) return JSON.parse(trimmed);

  const messages = [];
  for (const block of trimmed.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data) messages.push(JSON.parse(data));
  }
  return messages.at(-1) ?? null;
}

async function post(payload) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} from ${ENDPOINT}`);
  const parsed = parseSseOrJson(await response.text());
  if (parsed?.error) throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
  return parsed;
}

async function initialize() {
  const initialized = await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'mdriven-wiki-skill', version: '1.0.0' },
    },
  });
  await post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  return initialized.result;
}

async function main() {
  const [command, toolName, argumentInput = '{}', ...extra] = process.argv.slice(2);
  if (!command || extra.length || !['tools', 'call'].includes(command)) usage();
  if (command === 'call' && !toolName) usage();

  let args;
  if (command === 'call') {
    const rawArguments = argumentInput === '-' ? await readStdin() : argumentInput;
    try {
      args = JSON.parse(rawArguments);
    } catch (error) {
      throw new Error(`Invalid JSON arguments: ${error.message}`);
    }
  }

  const server = await initialize();
  let response;
  if (command === 'tools') {
    response = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  } else {
    response = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });
  }

  console.log(JSON.stringify({ endpoint: ENDPOINT, server, result: response.result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
