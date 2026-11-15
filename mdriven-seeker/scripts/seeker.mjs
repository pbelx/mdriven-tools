#!/usr/bin/env node
/** Inspect, add, and repair MDriven seeker criteria (Nestings with UsedForSeekerColumns). */
import { MDrivenClient } from '../../_common/mdriven-client.mjs';

const BS = String.fromCharCode(92);
const lit = s => `'${String(s).split("'").join(BS + "'")}'`;
const isIdent = s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
const isPath = s => s.split('.').every(isIdent);

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { port: 9999, mode: '', seeker: '', name: '', paths: [], expr: '', hilite: '', dryRun: false };
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v === '-p' || v === '--port') o.port = parseInt(a[++i], 10);
    else if (v === '--list' || v === '--add' || v === '--repair') { o.mode = v.slice(2); o.seeker = a[++i] || ''; }
    else if (v === '--name') o.name = a[++i];
    else if (v === '--path') o.paths.push(a[++i]);
    else if (v === '--expr') o.expr = a[++i];
    else if (v === '--hilite') o.hilite = a[++i];
    else if (v === '--dry-run') o.dryRun = true;
    else if (v === '-h' || v === '--help') o.mode = 'help';
  }
  return o;
}

const usage = `Usage:
  node seeker.mjs -p <port> --list <Seeker>
  node seeker.mjs -p <port> --add <Seeker> --path Rel.Attr [--path ...] [--name seekX] [--hilite Class.GridColumn] [--dry-run]
  node seeker.mjs -p <port> --add <Seeker> --name seekX --expr "<OCL>" [--hilite Class.GridColumn] [--dry-run]
  node seeker.mjs -p <port> --repair <Seeker> [--dry-run]`;

const spanRef = n => `Span.allinstances->select(s|s.Name=${lit(n)})->first`;
const nestRef = (s, n) => `Nesting.allinstances->select(n|(n.Span.Name=${lit(s)}) and (n.Name=${lit(n)}))->first`;

async function list(c, seeker) {
  const res = await c.evaluateOCL(`${spanRef(seeker)}.Nesting->collect(n|n.Name+' | seeker='+n.UsedForSeekerColumns.asString+' | class='+n.Class.Name+' | crit='+n.OwnedColumns->select(c|c.Name='Crit1')->collect(c|c.Expression)->asCommaList+' | tags='+n.TaggedValue->collect(t|t.Tag+'='+t.Value)->asCommaList)`);
  const rows = Array.isArray(res.result) ? res.result : [];
  if (!rows.length) throw new Error(`No nestings found for seeker "${seeker}" (check the ViewModel name).`);
  console.log(`\nSeeker "${seeker}" nestings (${rows.length}):`);
  for (const r of rows) {
    const flagged = r.includes('| seeker=True');
    const grid = r.includes('IsSeekerResultGrid=true');
    console.log(`  ${grid ? 'GRID ' : flagged ? 'CRIT ' : 'PLAIN'} ${r}`);
  }
  if (res.modelErrorCount) console.log(`\nModel errors: ${res.errors.join(' | ')}`);
  return rows;
}

async function add(c, o) {
  if (!o.expr && !o.paths.length) throw new Error('--add needs --path or --expr');
  for (const p of o.paths) if (!isPath(p)) throw new Error(`Invalid --path "${p}"`);
  const cls = (await c.evaluateOCL(`${spanRef(o.seeker)}.Nesting->select(n|n.TaggedValue->exists(t|(t.Tag='IsSeekerResultGrid') and (t.Value.toLower='true')))->first.Class.Name`)).result
    || (await c.evaluateOCL(`${spanRef(o.seeker)}.Class.Name`)).result;
  if (!cls) throw new Error(`Cannot determine the result class of "${o.seeker}"`);
  const name = o.name || 'seek' + o.paths[0].split('.').join('');
  if (!isIdent(name)) throw new Error(`Invalid nesting name "${name}"`);
  const exists = (await c.evaluateOCL(`${spanRef(o.seeker)}.Nesting->select(n|n.Name=${lit(name)})->size`)).result;
  if (String(exists) !== '0') throw new Error(`Nesting "${name}" already exists on "${o.seeker}". Use --repair or pick another --name.`);
  const expr = o.expr || `${cls}.allinstances->select(a|${o.paths.map(p => `a.${p}.sqllikecaseinsensitive(vSeekParamWildcard) or (a.${p}=vSeekParam)`).join(' or ')})->orderby(a|a.${o.paths[0]})`;
  const hilite = o.hilite || (o.paths.length ? `${cls}.${o.paths[0].split('.')[0]}` : '');
  console.log(`\nAdding criterion "${name}" to "${o.seeker}" (class ${cls})\n  Crit1: ${expr}\n  Eco.HiliteGridColumn: ${hilite || '(none)'}`);
  if (o.dryRun) { console.log('\n--dry-run: nothing changed.'); return; }
  const create = `let s=${spanRef(o.seeker)} in (let n=Nesting.Create in (n.Name:=${lit(name)}; n.Class:=Class.allinstances->select(k|k.Name=${lit(cls)})->first; s.Nesting.Add(n); n.UsedForSeekerColumns:=true; let col=Column.Create in (col.Name:='Crit1'; col.Expression:=${lit(expr)}; col.ColSpan:=1; col.RowSpan:=1; col.ColSpanWhenInGrid:=1; n.OwnedColumns.Add(col))${hilite ? `; let t=TaggedValue.Create in (t.Tag:='Eco.HiliteGridColumn'; t.Value:=${lit(hilite)}; n.TaggedValue.Add(t))` : ''}); 'created')`;
  await c.evaluateAction(create);
  const check = await c.evaluateOCL(`${nestRef(o.seeker, name)}.UsedForSeekerColumns.asString+' '+${nestRef(o.seeker, name)}.OwnedColumns->first.Expression`);
  console.log(`\nRead back: UsedForSeekerColumns=${String(check.result).split(' ')[0]}`);
  if (check.modelErrorCount) console.log(`Model errors (may be transient, re-check with mdriven-doctor): ${check.errors.join(' | ')}`);
}

async function repair(c, o) {
  const sel = `${spanRef(o.seeker)}.Nesting->select(n|n.Name.startsWith('seek') and (not n.UsedForSeekerColumns) and n.OwnedColumns->exists(c|c.Name='Crit1'))`;
  const names = (await c.evaluateOCL(`${sel}->collect(n|n.Name)`)).result || [];
  if (!names.length) { console.log(`\nNo unflagged seek* criteria on "${o.seeker}".`); return; }
  console.log(`\nUnflagged criteria: ${names.join(', ')}`);
  if (o.dryRun) { console.log('--dry-run: nothing changed.'); return; }
  await c.evaluateAction(`${sel}->asSequence->forEach(n|n.UsedForSeekerColumns:=true); 'repaired'`);
  console.log('Set UsedForSeekerColumns=true on all of them.');
}

async function main() {
  const o = parseArgs();
  if (!o.mode || o.mode === 'help' || !o.seeker) { console.log(usage); process.exit(o.mode === 'help' ? 0 : 1); }
  const c = new MDrivenClient({ port: o.port });
  try {
    if (o.mode === 'list') await list(c, o.seeker);
    else if (o.mode === 'add') { await add(c, o); await list(c, o.seeker); }
    else if (o.mode === 'repair') { await repair(c, o); await list(c, o.seeker); }
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  }
}

main();
