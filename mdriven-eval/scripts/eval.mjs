#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

const usage = 'Usage: node eval.mjs [-p port] [-a] [-c context] [--debug] "expression" | --batch-file <file|->';

function parseArgs(args) {
  const opts = { port: 9999, action: false, context: '', returnAggregates: false, debug: false };
  const values = { '-p': 'port', '--port': 'port', '-c': 'context', '--context': 'context', '-e': 'expr', '--expr': 'expr', '--expression': 'expr', '--batch-file': 'batchFile' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (values[arg]) {
      if (args[i + 1] === undefined) throw new Error(`Missing value for ${arg}`);
      opts[values[arg]] = args[++i];
    } else if (arg === '-a' || arg === '--action') opts.action = true;
    else if (arg === '-r' || arg === '--return-aggregates') opts.returnAggregates = true;
    else if (arg === '--debug') opts.debug = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (!arg.startsWith('-') && opts.expr === undefined) opts.expr = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  opts.port = Number(opts.port);
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) throw new Error('Invalid port');
  if (!opts.help && (!!opts.expr === !!opts.batchFile)) throw new Error('Provide one expression or --batch-file');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(usage); return; }
  let jobs;
  if (opts.batchFile) {
    let input = '';
    if (opts.batchFile === '-') {
      for await (const chunk of process.stdin) input += chunk;
    } else input = await readFile(opts.batchFile, 'utf8');
    jobs = JSON.parse(input);
    if (!Array.isArray(jobs) || !jobs.length) throw new Error('Batch must be a nonempty JSON array');
  } else jobs = [{ expression: opts.expr }];
  // Validate the entire batch before connecting or mutating anything.
  for (const job of jobs) {
    if (!job || typeof job !== 'object' || typeof job.expression !== 'string' || !job.expression.trim()) throw new Error('Each batch entry needs an expression');
    for (const key of Object.keys(job)) {
      if (!['expression', 'action', 'context', 'returnAggregates'].includes(key)) throw new Error(`Unknown batch field: ${key}`);
    }
    for (const key of ['action', 'returnAggregates']) {
      if (job[key] !== undefined && typeof job[key] !== 'boolean') throw new Error(`${key} must be boolean`);
    }
    if (job.context !== undefined && typeof job.context !== 'string') throw new Error('context must be a string');
  }
  const client = new MDrivenClient(opts);
  const results = [];
  // Ordered, fail-fast execution. A batch is not a transaction.
  for (const [index, job] of jobs.entries()) {
    try {
      const options = { context: job.context ?? opts.context, returnAggregates: job.returnAggregates ?? opts.returnAggregates };
      results.push(await ((job.action ?? opts.action) ? client.evaluateAction(job.expression, options) : client.evaluateOCL(job.expression, options)));
    } catch (error) {
      if (!opts.batchFile) throw error;
      console.log(JSON.stringify({ ok: false, results, failedIndex: index, error: error.message, ...(error.evaluation ? { evaluation: error.evaluation } : {}), skippedCount: jobs.length - index - 1 }));
      process.exitCode = 1;
      return;
    }
  }
  console.log(JSON.stringify(opts.batchFile ? { ok: true, results } : results[0], null, opts.debug ? 2 : undefined));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message, ...(error.evaluation ? { evaluation: error.evaluation } : {}) }));
  process.exitCode = 1;
});
