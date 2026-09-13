#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { port: 9999, vmName: '', list: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') opts.port = parseInt(args[++i], 10);
    else if (a === '-l' || a === '--list') opts.list = true;
    else if (a === '-n' || a === '--name' || a === '--viewmodel') opts.vmName = args[++i];
    else if (!opts.vmName && !a.startsWith('-')) opts.vmName = a;
  }
  return opts;
}

async function main() {
  const { port, vmName, list } = parseArgs();
  const client = new MDrivenClient({ port });

  try {
    if (list || !vmName) {
      const res = await client.evaluateOCL('Span.allinstances->collect(s | s.Name)');
      console.log(`\n📋 ViewModels in Model (${res.result?.length || 0}):`);
      (res.result || []).forEach(name => console.log(`  - ${name}`));
      console.log('\nUse: node viewmodel.mjs -p ' + port + ' <ViewModelName> to inspect details.\n');
      return;
    }

    console.log(`\n🔍 Inspecting ViewModel "${vmName}" on port ${port}...\n`);

    // 1. Get Span Variables
    const varExpr = `
      Span.allinstances->select(s | s.Name = '${vmName}')->first.SpanVariables->collect(v |
        v.Name + ' : ' + v.TypeName + if v.InitialValue->isnullorempty then '' else ' = ' + v.InitialValue endif
      )
    `.trim().replace(/\s+/g, ' ');

    const varRes = await client.evaluateOCL(varExpr);
    const variables = Array.isArray(varRes.result) ? varRes.result : [];

    // 2. Get Columns and Expressions
    const colExpr = `
      Column.allinstances->select(c | c.Span.Name = '${vmName}')->collect(c |
        c.Name + ' | Expr: ' + c.Expression.Replace(String.NewLine, ' ')
      )
    `.trim().replace(/\s+/g, ' ');

    const colRes = await client.evaluateOCL(colExpr);
    const columns = Array.isArray(colRes.result) ? colRes.result : [];

    console.log(`📌 Variables (${variables.length}):`);
    if (variables.length === 0) {
      console.log('  (none)');
    } else {
      variables.forEach(v => console.log(`  - ${v}`));
    }

    console.log(`\n📌 Columns & Expressions (${columns.length}):`);
    if (columns.length === 0) {
      console.log('  (none)');
    } else {
      columns.forEach(c => console.log(`  - ${c}`));
    }

    console.log('');
  } catch (err) {
    console.error(`❌ Inspection failed: ${err.message}`);
    process.exit(1);
  }
}

main();

