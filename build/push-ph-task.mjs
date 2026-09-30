// push-ph-task.mjs — replace ONLY html_content on tech_team_outputs.ph_task id = 1947
// with the validated standalone dashboard.
//
//   PH_DB_URL='postgresql://user:pass@host:5432/order_management_copy' \
//     node build/push-ph-task.mjs [--dry-run]
//
// Safety, in order:
//   * one transaction; any failed guard aborts it and nothing is written
//   * parameterized SQL — the 1.6 MB of HTML never enters the statement text
//   * the row is re-read FOR UPDATE and every identity guard is checked before writing
//   * only html_content and updated_at are in the SET list; no other column is named
//   * after COMMIT the stored length and MD5 are compared against the source file
//
// updated_at is set explicitly because tech_team_outputs.ph_task has no BEFORE UPDATE
// trigger — the schema doc records that it is not auto-maintained.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'September-Comparison-Dashboard.html');
const DRY  = process.argv.includes('--dry-run');

const ID    = 1947;
const USER  = 'utharsika';
const TEAM  = 'ph_priors';

// This project is deliberately dependency-free, so `pg` is borrowed from a sibling
// project that already has it rather than installed here.
const require_ = createRequire(import.meta.url);
const CANDIDATES = [
  'pg',
  resolve(ROOT, '../Task 4/node_modules/pg/lib/index.js'),
  resolve(ROOT, '../Inventory System/inventory/node_modules/pg/lib/index.js'),
];
let pg = null, pgFrom = null;
for (const c of CANDIDATES) {
  try { pg = c === 'pg' ? require_('pg') : (await import(pathToFileURL(c).href)).default; pgFrom = c; break; }
  catch { /* try the next one */ }
}
if (!pg) {
  console.error('Could not load the `pg` driver. Tried:\n  ' + CANDIDATES.join('\n  ') +
                '\nInstall it (npm i pg) or point one of those paths at a copy.');
  process.exit(1);
}

const url = process.env.PH_DB_URL;
if (!url) { console.error('Missing PH_DB_URL (connection string for order_management_copy).'); process.exit(1); }

const html = readFileSync(FILE, 'utf8');
const md5  = s => createHash('md5').update(s, 'utf8').digest('hex');
const srcLen = html.length, srcMd5 = md5(html);

// Refuse to publish anything but the corrected build: sales-driven population AND the
// six approved business account groups. Each marker is checked separately so a stale or
// half-updated file names the exact thing it is missing.
const MARKERS = [
  ['<h1>September Product Performance Comparison',                                 'dashboard title'],
  ['assigned to PH user ',                                                                     'utharsika product-scope line'],
  ['<option value="">All categories</option>',                                                 'Category filter control'],
  ["{k:'category',          t:'Category',       f:'sku'}",                                     'Category table column'],
  ["{k:'sku_id',            t:'SKU ID',         f:'sku'}",                                     'SKU ID table column'],
  ['LY Ad-Generated Sales</b> uses order-level Promoted Standard attribution',        'LY sales-split note'],
  ['Data Notes &amp; Methodology',                                                  'methodology drawer'],
  ['Sunsone, Ledsone, Electricalsone, Huttenlampen, ledsone uk de and ledsone de',  'six-account scope statement'],
  ['Each TY source ends on its own day',                                          'partial-TY coverage disclosure'],
];
for (const [needle, what] of MARKERS)
  if (!html.includes(needle)) throw new Error(`source HTML lacks the ${what} — wrong or stale file`);

// The embedded snapshot must itself carry exactly the six approved accounts.
const APPROVED = ['Sunsone','Ledsone','Electricalsone','Huttenlampen','ledsone uk de','ledsone de'];
const aKey = '"accounts":[';
const aStart = html.indexOf(aKey);
if (aStart < 0) throw new Error('embedded snapshot has no accounts list');
const aEnd = html.indexOf(']', aStart);
const found = html.slice(aStart + aKey.length, aEnd)
  .split(',').map(t => t.trim().replace(/^"|"$/g, '')).filter(Boolean);
const bad = found.filter(a => !APPROVED.includes(a));
if (bad.length)         throw new Error(`snapshot contains unapproved accounts: ${bad.join(', ')}`);
if (found.length !== 6) throw new Error(`snapshot has ${found.length} accounts, expected 6: ${found.join(', ')}`);
console.log(`accounts   ${found.join(' | ')}`);

console.log(`driver     ${pgFrom}`);
console.log(`source     ${FILE}`);
console.log(`           ${srcLen} chars  md5 ${srcMd5}`);

const client = new pg.Client({
  connectionString: url,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
});

await client.connect();
try {
  await client.query('BEGIN');

  const { rows: before } = await client.query(
    `SELECT id, project_name, task_name, assigned_user, assigned_user_team, task_id,
            phase_level, version_level, action_took_by, action_took_date_time,
            LENGTH(html_content) AS len, MD5(html_content) AS md5
       FROM tech_team_outputs.ph_task
      WHERE id = $1
      FOR UPDATE`, [ID]);

  if (before.length !== 1) throw new Error(`expected exactly 1 row id=${ID}, got ${before.length}`);
  const b = before[0];
  if (b.assigned_user !== USER)      throw new Error(`assigned_user is "${b.assigned_user}", expected "${USER}"`);
  if (b.assigned_user_team !== TEAM) throw new Error(`assigned_user_team is "${b.assigned_user_team}", expected "${TEAM}"`);

  console.log(`before     id=${b.id} user=${b.assigned_user} team=${b.assigned_user_team}`);
  console.log(`           html ${b.len} chars  md5 ${b.md5}`);

  if (DRY) { await client.query('ROLLBACK'); console.log('\nDRY RUN — rolled back, nothing written.'); }
  else {
    const { rowCount } = await client.query(
      `UPDATE tech_team_outputs.ph_task
          SET html_content = $1,
              updated_at   = now()
        WHERE id = $2
          AND assigned_user = $3
          AND assigned_user_team = $4`, [html, ID, USER, TEAM]);
    if (rowCount !== 1) throw new Error(`UPDATE touched ${rowCount} rows, expected exactly 1`);

    // Verify inside the transaction, before committing.
    const { rows: [chk] } = await client.query(
      `SELECT LENGTH(html_content) AS len, MD5(html_content) AS md5,
              id, project_name, project_code, task_name, assigned_user, assigned_user_team,
              task_id, phase_level, version_level, action_took_by, action_took_date_time
         FROM tech_team_outputs.ph_task WHERE id = $1`, [ID]);
    if (Number(chk.len) !== srcLen) throw new Error(`length mismatch: stored ${chk.len}, source ${srcLen}`);
    if (chk.md5 !== srcMd5)         throw new Error(`md5 mismatch: stored ${chk.md5}, source ${srcMd5}`);
    for (const [k, v] of Object.entries({
      id: b.id, task_id: b.task_id, task_name: b.task_name, assigned_user: b.assigned_user,
      assigned_user_team: b.assigned_user_team, phase_level: b.phase_level,
      version_level: b.version_level, action_took_by: b.action_took_by,
    })) if (String(chk[k]) !== String(v)) throw new Error(`${k} changed: "${v}" -> "${chk[k]}"`);

    await client.query('COMMIT');
    console.log(`after      html ${chk.len} chars  md5 ${chk.md5}`);
    console.log(`\nUPDATED row ${ID} — html_content only. Integrity PASS.`);
  }

  const { rows: [{ n }] } = await client.query(
    `SELECT COUNT(*)::int AS n FROM tech_team_outputs.ph_task
      WHERE project_code = 'september-comparison'`);
  console.log(`rows for project_code=september-comparison: ${n}  (must stay 1 — no duplicate created)`);
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('\nABORTED, nothing written:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
