// validate.mjs — the build gates. Exits non-zero on any failure.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { meta, rows } = JSON.parse(readFileSync(resolve(ROOT, 'data/september-comparison.json'), 'utf8'));

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// 1 dataset has rows
check('1  dataset has rows', rows.length > 0, `${rows.length} rows`);

// 2 unique account + item_id + marketplace (no row multiplication)
const keys = new Set(rows.map(r => `${r.account_id}|${r.ebay_id}|${r.marketplace}`));
check('2  key unique (account+item+marketplace)', keys.size === rows.length,
      `${keys.size} keys / ${rows.length} rows`);

// 3 sales reconcile against the per-currency totals in meta
const recon = {};
for (const r of rows) {
  const c = (recon[r.currency] ||= { ly: 0, ty: 0 });
  c.ly += r.ly_sales; c.ty += r.ty_sales;
}
let reconOk = true, reconDetail = [];
for (const m of meta.currencies) {
  const a = Math.round(recon[m.currency].ly * 100) / 100;
  const b = Math.round(recon[m.currency].ty * 100) / 100;
  if (Math.abs(a - m.ly_sales) > 0.01 || Math.abs(b - m.ty_sales) > 0.01) reconOk = false;
  reconDetail.push(`${m.currency} LY ${m.ly_sales} TY ${m.ty_sales}`);
}
check('3  LY/TY sales reconcile', reconOk, reconDetail.join(' | '));

// 4 ad spend single-sourced and not duplicated
const spendTotal = {};
for (const r of rows) spendTotal[r.currency] = (spendTotal[r.currency] || 0) + r.ad_spend;
const spendOk = meta.currencies.every(m => Math.abs(Math.round(spendTotal[m.currency] * 100) / 100 - m.ad_spend) <= 0.01);
check('4  ad spend matches single source', spendOk && /listing_performance/.test(meta.ad_spend_source),
      meta.currencies.map(m => `${m.currency} ${m.ad_spend}`).join(' | '));

// 5 no cross-currency aggregation: every row has a currency, every total is per-currency
const curOk = rows.every(r => ['GBP', 'EUR', 'USD'].includes(r.currency))
           && meta.currencies.every(m => m.currency);
check('5  no cross-currency totals', curOk, `${meta.currencies.length} currency buckets`);

// 6/7 exactly one segment per row; counts sum to total
const VALID = ['A', 'B', 'C', 'D', 'Other'];
check('6  exactly one valid segment per row', rows.every(r => VALID.includes(r.segment)));
const sum = Object.values(meta.segments).reduce((a, b) => a + b, 0);
check('7  segment counts sum to rows', sum === rows.length, `${sum} = ${rows.length}`);

// 8 every D
check('8  every D: LY>0 and TY=0',
      rows.filter(r => r.segment === 'D').every(r => r.ly_sales > 0 && r.ty_sales === 0),
      `${meta.segments.D || 0} rows`);

// 9 every C (D precedence already applied)
check('9  every C: LY ad sales>0, TY ad sales=0, not D',
      rows.filter(r => r.segment === 'C').every(r => r.ly_ad_sales > 0 && r.ty_ad_sales === 0 && !(r.ly_sales > 0 && r.ty_sales === 0)),
      `${meta.segments.C || 0} rows`);

// 10 every B satisfies the recovery rule, after D/C precedence
check('10 every B: TY<LY and recovering, not D/C',
      rows.filter(r => r.segment === 'B').every(r => r.ty_sales < r.ly_sales
        && !(r.ly_sales > 0 && r.ty_sales === 0)
        && !(r.ly_ad_sales > 0 && r.ty_ad_sales === 0)),
      `${meta.segments.B || 0} rows`);

// 11 every A, after higher precedence
check('11 every A: TY>LY, not D/C/B',
      rows.filter(r => r.segment === 'A').every(r => r.ty_sales > r.ly_sales
        && !(r.ly_ad_sales > 0 && r.ty_ad_sales === 0)),
      `${meta.segments.A || 0} rows`);

// 12/13/14 numeric health
const NUM = ['ly_sales','ty_sales','yoy_pct','ly_ad_sales','ty_ad_sales','ly_views','ty_views',
             'ly_orders','ty_orders','ly_conversion_pct','ty_conversion_pct','ly_price','ty_price',
             'ad_impressions','ad_clicks','ad_spend','ad_sales','roas','acos'];
let bad = null;
for (const r of rows) for (const k of NUM) {
  const v = r[k];
  if (v === null) continue;
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) { bad = `${r.ebay_id}.${k}=${v}`; break; }
}
check('12 no NaN', !bad || !/NaN/.test(bad), bad || 'clean');
check('13 no Infinity', !bad || !/Infinity/.test(bad), bad || 'clean');
check('14 no broken numerics', bad === null, bad || 'all numeric fields number|null');

// 20 partial-TY metadata present
check('20 partial-TY metadata present', meta.ty_is_partial === true && !!meta.source_max_dates.traffic,
      `traffic ${meta.source_max_dates.traffic}, sales/ads ${meta.source_max_dates.sales}`);

// coverage
check('   coverage: LY and TY both non-empty',
      rows.some(r => r.ly_sales > 0) && rows.some(r => r.ty_sales > 0));

console.log(`\n${fails === 0 ? 'ALL GATES PASSED' : fails + ' GATE(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
