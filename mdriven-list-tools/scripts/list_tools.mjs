#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  let port = 9999;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--port') port = parseInt(args[++i], 10);
  }
  return { port };
}

async function main() {
  const { port } = parseArgs();
  const client = new MDrivenClient({ port });

  try {
    const serverInfo = await client.connect();
    const tools = await client.listTools();

    console.log(`\nMDriven MCP Server on port ${port}:`);
    console.log(`   Name: ${serverInfo?.name || 'Unknown'}`);
    console.log(`   Version: ${serverInfo?.version || 'Unknown'}`);
    console.log(`   Protocol: ${client.protocolVersion}`);
    console.log(`\nAvailable Tools (${tools.length}):`);

    tools.forEach((tool, index) => {
      console.log(`\n  ${index + 1}. ${tool.name}`);
      if (tool.description) {
        console.log(`     Description: ${tool.description.replace(/\r?\n/g, ' ').slice(0, 140)}...`);
      }
    });

    const oclToolAvailable = tools.some(
      (tool) => tool.name === 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel',
    );

    if (oclToolAvailable) {
      const probes = [
        ['OCL overview', 'MCPServerInfo.GetOverViewOfCapabilitiesForOCL'],
        ['Action Language overview', 'MCPServerInfo.GetOverViewOfCapabilitiesForActionLanguage'],
        ['MetaModelMetaInfo', "MCPServerInfo.MetaModelMetaInfo('Attribute')"],
        ['MDriven Wiki search', "MCPServerInfo.WikiSearch('OpenDocument report')"],
        ['MDriven Wiki fetch', "MCPServerInfo.WikiFetch('Documentation:MCP')"],
      ];

      console.log('\nEmbedded Capabilities:');
      for (const [name, expression] of probes) {
        try {
          const result = await client.evaluateOCL(expression);
          if (result.expressionError) {
            console.log(`  UNAVAILABLE ${name}: ${result.expressionError}`);
            continue;
          }

          const value = String(result.result ?? '');
          const preview = value.length > 240 ? `${value.slice(0, 240)}...` : value;
          console.log(`  OK ${name}: ${preview.replace(/\r?\n/g, ' ')}`);
        } catch (error) {
          console.log(`  UNAVAILABLE ${name}: ${error.message}`);
        }
      }
    }

    console.log('');
  } catch (error) {
    console.error(`Failed to inspect capabilities: ${error.message}`);
    process.exit(1);
  }
}

main();
