#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  let port = 9999;
  let host = 'localhost';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--port') port = parseInt(args[++i], 10);
    else if (args[i] === '-h' || args[i] === '--host') host = args[++i];
  }
  return { port, host };
}

async function main() {
  const { port, host } = parseArgs();
  const client = new MDrivenClient({ port, host });

  try {
    console.log(`\n🔍 Running MDriven Doctor on port ${port}...\n`);

    // Fetch classes and model errors in one response.
    const classesRes = await client.evaluateOCL('Class.allinstances->collect(c | c.Name)');
    const modelErrors = classesRes.errors || [];
    const classes = Array.isArray(classesRes.result) ? classesRes.result : [];

    // 3. Fetch ViewModels
    const spansRes = await client.evaluateOCL('Span.allinstances->collect(s | s.Name)');
    const viewModels = Array.isArray(spansRes.result) ? spansRes.result : [];

    // 4. Count variables without fetching their details.
    const variablesRes = await client.evaluateOCL(
      'Span.allinstances.SpanVariables->size'
    );
    const variableCount = variablesRes.result;

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
      totalVariablesCount: variableCount,
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

