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
    console.log(`\n🔍 Running MDriven Doctor on port ${port}...\n`);

    // 1. Check Capabilities & Model-wide Errors
    const overview = await client.evaluateOCL('MCPServerInfo.GetOverViewOfCapabilitiesForOCL');
    const modelErrors = overview.errors || [];

    // 2. Fetch Classes
    const classesRes = await client.evaluateOCL('Class.allinstances->collect(c | c.Name)');
    const classes = Array.isArray(classesRes.result) ? classesRes.result : [];

    // 3. Fetch ViewModels
    const spansRes = await client.evaluateOCL('Span.allinstances->collect(s | s.Name)');
    const viewModels = Array.isArray(spansRes.result) ? spansRes.result : [];

    // 4. Check SpanVariables with unmatched types
    const variablesRes = await client.evaluateOCL(
      "Span.allinstances.SpanVariables->collect(v | v.Span.Name + '::' + v.Name + ' (' + v.TypeName + ')')"
    );
    const variables = Array.isArray(variablesRes.result) ? variablesRes.result : [];

    // 5. Check empty/numbered default classes (e.g. Class1)
    const suspiciousClasses = classes.filter(c => /^Class\d+$/i.test(c) || /^NewClass/i.test(c));

    const report = {
      timestamp: new Date().toISOString(),
      port,
      health: modelErrors.length === 0 ? 'HEALTHY' : 'ERRORS_FOUND',
      classesCount: classes.length,
      classes,
      viewModelsCount: viewModels.length,
      viewModels,
      modelErrorsCount: modelErrors.length,
      modelErrors,
      suspiciousClasses,
      totalVariablesCount: variables.length,
    };

    console.log(`Status: ${report.health === 'HEALTHY' ? '✅ HEALTHY' : '❌ ERRORS FOUND'}`);
    console.log(`Classes (${classes.length}): ${classes.join(', ')}`);
    console.log(`ViewModels (${viewModels.length}): ${viewModels.join(', ')}`);

    if (suspiciousClasses.length > 0) {
      console.log(`⚠️  Suspicious default classes: ${suspiciousClasses.join(', ')}`);
    }

    if (modelErrors.length > 0) {
      console.log(`\n❌ Found ${modelErrors.length} Model Error(s):`);
      modelErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.replace(/\r\n/g, ' ')}`);
      });
    } else {
      console.log('\n✅ 0 Model Errors found.');
    }

    console.log('');
  } catch (err) {
    console.error(`❌ Doctor check failed: ${err.message}`);
    process.exit(1);
  }
}

main();

