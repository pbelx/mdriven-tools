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

    console.log(`\n🔌 MDriven MCP Server on port ${port}:`);
    console.log(`   Name: ${serverInfo?.name || 'Unknown'}`);
    console.log(`   Version: ${serverInfo?.version || 'Unknown'}`);
    console.log(`   Protocol: ${client.protocolVersion}`);
    console.log(`\n🛠️  Available Tools (${tools.length}):`);

    tools.forEach((t, i) => {
      console.log(`\n  ${i + 1}. ${t.name}`);
      if (t.description) {
        console.log(`     Description: ${t.description.replace(/\r?\n/g, ' ').slice(0, 140)}...`);
      }
    });
    console.log('');
  } catch (err) {
    console.error(`❌ Failed to list tools: ${err.message}`);
    process.exit(1);
  }
}

main();

