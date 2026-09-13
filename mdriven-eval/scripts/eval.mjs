#!/usr/bin/env node
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { port: 9999, action: false, context: '', returnAggregates: false, expr: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') opts.port = parseInt(args[++i], 10);
    else if (a === '-a' || a === '--action') opts.action = true;
    else if (a === '-c' || a === '--context') opts.context = args[++i];
    else if (a === '-r' || a === '--return-aggregates') opts.returnAggregates = true;
    else if (a === '-e' || a === '--expr' || a === '--expression') opts.expr = args[++i];
    else if (!opts.expr && !a.startsWith('-')) opts.expr = a;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  if (!opts.expr) {
    console.error('Usage: node eval.mjs [-p <port>] [-a] [-c <context>] "<expression>"');
    process.exit(1);
  }

  const client = new MDrivenClient({ port: opts.port });
  try {
    const res = opts.action
      ? await client.evaluateAction(opts.expr, { context: opts.context, returnAggregates: opts.returnAggregates })
      : await client.evaluateOCL(opts.expr, { context: opts.context, returnAggregates: opts.returnAggregates });

    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

