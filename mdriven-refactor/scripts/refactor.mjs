#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { port: 9999, from: '', to: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') opts.port = parseInt(args[++i], 10);
    else if (a === '-f' || a === '--from' || a === '--old') opts.from = args[++i];
    else if (a === '-t' || a === '--to' || a === '--new') opts.to = args[++i];
  }
  return opts;
}

async function main() {
  const { port, from, to } = parseArgs();
  if (!from || !to) {
    console.error('Usage: node refactor.mjs [-p <port>] --from <OldName> --to <NewName>');
    process.exit(1);
  }

  const client = new MDrivenClient({ port });

  try {
    console.log(`\n🔄 Refactoring references from "${from}" -> "${to}" on port ${port}...\n`);

    // 1. Rename Class if exact match exists
    const classRenameExpr = `
      let targetClass = Class.allinstances->select(c | c.Name = '${from}')->first in
      if targetClass->notempty then
        targetClass.Name := '${to}'
      else
        null
      endif
    `.trim().replace(/\s+/g, ' ');
    await client.evaluateAction(classRenameExpr);

    // 2. Rename AssociationEnds
    const assocEndExpr = `
      AssociationEnd.allinstances->select(ae | ae.Name = '${from}')->forEach(ae |
        ae.Name := '${to}'
      )
    `.trim().replace(/\s+/g, ' ');
    await client.evaluateAction(assocEndExpr);

    // 3. Rename Nestings
    const nestingExpr = `
      Nesting.allinstances->select(n | n.Name = '${from}')->forEach(n |
        n.Name := '${to}'
      )
    `.trim().replace(/\s+/g, ' ');
    await client.evaluateAction(nestingExpr);

    // 4. Update SpanVariables
    const varUpdateExpr = `
      Span.allinstances.SpanVariables->select(v | v.TypeName.sqlLikeCaseInsensitive('%${from}%'))->forEach(v |
        v.TypeName := v.TypeName.Replace('${from}', '${to}')
      )
    `.trim().replace(/\s+/g, ' ');
    const varRes = await client.evaluateAction(varUpdateExpr);
    const updatedVars = varRes.result?.length || 0;
    console.log(`  ✓ Updated ${updatedVars} ViewModel variable(s)`);

    // 5. Update Column Expressions
    const colUpdateExpr = `
      Column.allinstances->select(c | c.Expression.sqlLikeCaseInsensitive('%${from}%'))->forEach(c |
        c.Expression := c.Expression.Replace('${from}', '${to}')
      )
    `.trim().replace(/\s+/g, ' ');
    const colRes = await client.evaluateAction(colUpdateExpr);
    const updatedCols = colRes.result?.length || 0;
    console.log(`  ✓ Updated ${updatedCols} Column expression(s)`);

    // 6. Validate Model Errors
    const checkRes = await client.evaluateOCL('MCPServerInfo.GetOverViewOfCapabilitiesForOCL');
    const errors = checkRes.errors || [];

    if (errors.length === 0) {
      console.log(`\n✅ Refactoring completed cleanly! 0 model errors.`);
    } else {
      console.log(`\n⚠️  Refactoring completed with ${errors.length} remaining model error(s):`);
      errors.forEach((e, idx) => console.log(`  ${idx + 1}. ${e.replace(/\r\n/g, ' ')}`));
    }
    console.log('');
  } catch (err) {
    console.error(`❌ Refactoring failed: ${err.message}`);
    process.exit(1);
  }
}

main();
