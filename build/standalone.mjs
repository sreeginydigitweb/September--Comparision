// standalone.mjs — package index.html + data/september-comparison.json into ONE
// self-contained file that runs from file:// with no server, network or database.
// Packaging only: no business logic, no data, no calculation is altered.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'September-Comparison-Dashboard.html');

const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const json = readFileSync(resolve(ROOT, 'data/september-comparison.json'), 'utf8');

// Sanity: the snapshot we are embedding must be the validated one. Expectations are
// DERIVED from the snapshot — the old hard-coded 17,845 rows / A1318 B93 C77 D1305
// Other15052 belonged to the superseded all-ID population and would now reject a
// correct build. What is asserted instead are the invariants that must always hold.
const parsed = JSON.parse(json);
const { rows: R, meta: M } = parsed;

if (!R.length) throw new Error('snapshot is empty');

// Scope guard (revised 2026-09-29). Zero-sales rows are legitimate now, but ONLY for
// utharsika's assigned Lamp Shade / Wall Plug products in the six approved accounts —
// the narrow exception the business confirmed. Anything else is the original
// "all the IDs are turning up" fault and must never be packaged.
const CATS = ['Lamp Shade', 'Wall Plug'];
const ACCTS = ['Sunsone','Ledsone','Electricalsone','Huttenlampen','ledsone uk de','ledsone de'];
const outOfScope = R.filter(r => !CATS.includes(r.category) || !ACCTS.includes(r.account));
if (outOfScope.length)
  throw new Error(`${outOfScope.length} rows outside the two categories / six accounts — ` +
                  `first ${outOfScope[0].account}/${outOfScope[0].category}`);

if (M.row_count !== R.length) throw new Error(`meta.row_count ${M.row_count} != ${R.length} rows`);

const keys = new Set(R.map(r => `${r.account_id}|${r.ebay_id}|${r.marketplace}`));
if (keys.size !== R.length) throw new Error(`grain broken: ${keys.size} keys / ${R.length} rows`);

const counted = R.reduce((a, r) => (a[r.segment] = (a[r.segment] || 0) + 1, a), {});
for (const k of new Set([...Object.keys(counted), ...Object.keys(M.segments)]))
  if (counted[k] !== M.segments[k])
    throw new Error(`segment ${k}: meta says ${M.segments[k]}, rows say ${counted[k]}`);

if (M.ty_is_partial !== true) throw new Error('partial-TY flag missing from snapshot');

// COMPLETENESS. Every assigned row must be classified A/B/C/D and every row must be shown:
// D is the fallback, so nothing is excluded. These guards make it impossible to package a build
// that hides a product — the fault that removed 115 of 186 rows, control SKU included.
const PUB = ['A', 'B', 'C', 'D'];
const unclassified = R.filter(r => !PUB.includes(r.segment));
if (unclassified.length)
  throw new Error(`${unclassified.length} rows are not A/B/C/D (first ${unclassified[0].ebay_id} ` +
                  `= "${unclassified[0].segment}") — build/build.mjs must fall back to D`);
if (!/const PUBLISHED_SEGS = \['A', 'B', 'C', 'D'\]/.test(html))
  throw new Error('index.html no longer declares the four business segments');
if (!/^\s*DATA = SOURCE;\s*$/m.test(html))
  throw new Error('index.html no longer shows every row (DATA = SOURCE) — rows could be hidden');
if (/DATA = SOURCE\.filter/.test(html))
  throw new Error('index.html filters rows out of the view — no product may be hidden');
if (/<option value="Other">/.test(html))
  throw new Error('index.html still offers an Other segment option');
const published = R;

// `<` only ever occurs inside JSON strings, never structurally, so escaping it globally
// keeps the JSON valid and makes it impossible for a product title to close the <script>.
const safe = json.replace(/</g, '\\u003c');

// Swap the runtime fetch for the embedded snapshot. Everything else is untouched.
const NEEDLE = "fetch('data/september-comparison.json').then(r => r.json()).then(d => {";
if (!html.includes(NEEDLE)) throw new Error('fetch call not found — index.html changed shape');

const out = html.replace(
  NEEDLE,
  `/* Snapshot embedded at build time — no fetch, no server, no database at runtime. */\n` +
  `const EMBEDDED_DATA = ${safe};\n\n` +
  `Promise.resolve(EMBEDDED_DATA).then(d => {`
);

if (/fetch\s*\(/.test(out.replace(/Snapshot embedded[^\n]*/g, '')))
  throw new Error('a fetch() call still remains in the standalone output');

writeFileSync(OUT, out);
const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2);
const segTally = R.reduce((a, r) => (a[r.segment] = (a[r.segment] || 0) + 1, a), {});
console.log(`wrote September-Comparison-Dashboard.html  ${mb} MB  rows=${R.length} (all shown: A ${segTally.A||0} B ${segTally.B||0} C ${segTally.C||0} D ${segTally.D||0}, 0 hidden)`);
console.log(`segments ${JSON.stringify(M.segments)}`);
console.log(`population ${M.population_rule}`);
