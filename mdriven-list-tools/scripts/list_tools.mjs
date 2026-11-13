#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

async function main() {
  const args = process.argv.slice(2);
  let port = 9999, capabilities = false, wiki = false, toolsOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--port') port = Number(args[++i]);
    else if (args[i] === '--capabilities') capabilities = true;
    else if (args[i] === '--wiki') wiki = true;
    else if (args[i] === '--tools-only') toolsOnly = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node list_tools.mjs [-p port] [--tools-only | --capabilities] [--wiki]');
      return;
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  if (toolsOnly && (capabilities || wiki)) throw new Error('--tools-only cannot be combined with probes');
  const client = new MDrivenClient({ port });
  const tools = await client.listTools();
  const report = { server: client.serverInfo, protocol: client.protocolVersion, tools: tools.map(tool => ({ name: tool.name, description: tool.description?.replace(/\r?\n/g, ' ').slice(0, 140) })) };
  if (capabilities || wiki) {
    if (!tools.some(tool => tool.name === 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel')) throw new Error('Read-only evaluator not available for probes');
    const probes = [
      ...(capabilities ? [
        ['ocl', 'MCPServerInfo.GetOverViewOfCapabilitiesForOCL'],
        ['action', 'MCPServerInfo.GetOverViewOfCapabilitiesForActionLanguage'],
        ['metadata', "MCPServerInfo.MetaModelMetaInfo('Attribute')"],
      ] : []),
      ...(wiki ? [
        ['wikiSearch', "MCPServerInfo.WikiSearch('OpenDocument report')"],
        ['wikiFetch', "MCPServerInfo.WikiFetch('Documentation:MCP')"],
      ] : []),
    ];
    report.probes = {};
    for (const [name, expression] of probes) {
      try {
        const result = await client.evaluateOCL(expression);
        const value = typeof result.result === 'string' ? result.result : JSON.stringify(result.result) ?? '';
        report.probes[name] = { available: true, preview: value.slice(0, 240), truncated: value.length > 240 };
      } catch (error) { report.probes[name] = { available: false, error: error.message }; }
    }
  }
  console.log(JSON.stringify(report));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
