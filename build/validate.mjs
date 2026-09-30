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

// 1 dataset has rows. Expected counts are DERIVED from the corrected dataset — there are
// deliberately no hard-coded row or segment totals anywhere in this file.
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
// D is now two populations: the original rule (LY>0, TY=0) plus the fallback for products that
// match none of A/B/C. Asserted precisely, so a D that should have been A, B or C still fails.
const W8 = new Map(JSON.parse(JSON.parse(readFileSync(
  resolve(ROOT, 'evidence/extract-2026-09-30-final/pack-i-extract.json'), 'utf8'))
  .data.rows[0].payload).map(r => [`${r[0]}|${r[2]}|${r[3]}`, { last7: +r[20], prev7: +r[21] }]));
const isRuleD = r => r.ly_sales > 0 && r.ty_sales === 0;
const matchesABC = r => {
  const w = W8.get(`${r.account_id}|${r.ebay_id}|${r.marketplace}`) || { last7: 0, prev7: 0 };
  if (r.ly_ad_sales > 0 && r.ty_ad_sales === 0) return 'C';
  if (r.ty_sales < r.ly_sales && w.last7 > w.prev7) return 'B';
  if (r.ty_sales > r.ly_sales) return 'A';
  return null;
};
const dRows = rows.filter(r => r.segment === 'D');
const badD = dRows.filter(r => !isRuleD(r) && matchesABC(r) !== null);
check('8  every D is either the LY>0/TY=0 rule or matches none of A/B/C (fallback)',
      badD.length === 0,
      badD.length ? `${badD.length} D rows should be ${matchesABC(badD[0])}, first ${badD[0].ebay_id}`
        : `${dRows.length} D rows = ${dRows.filter(isRuleD).length} rule + ` +
          `${dRows.filter(r => !isRuleD(r)).length} fallback`);

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

// ---------------------------------------------------------------------------
// 15-19 SALES-ONLY SCOPE CORRECTION (2026-09-29)
// The dashboard population is sales-driven. Traffic/ads enrich, never populate.
// ---------------------------------------------------------------------------

// 15/16 REVISED 2026-09-29. Zero-sales rows are allowed, but ONLY for verified
// utharsika-assigned products in the two categories and the six accounts. A zero-sales row
// that is not assigned would be the original "all the IDs are turning up" fault returning,
// so it is still a hard failure.
const APPROVED_ACCTS = ['Sunsone','Ledsone','Electricalsone','Huttenlampen','ledsone uk de','ledsone de'];
const APPROVED_CATS  = ['Lamp Shade','Wall Plug'];
const allowEarly = JSON.parse(readFileSync(resolve(ROOT, 'evidence/extract-2026-09-30-final/utharsika-ebay-allowlist.json'), 'utf8'));
const ASSIGNED = new Set(allowEarly.item_ids);

const zeroRows = rows.filter(r => r.ly_sales === 0 && r.ty_sales === 0);
const badZero  = zeroRows.filter(r => !ASSIGNED.has(r.ebay_id)
                                   || !APPROVED_CATS.includes(r.category)
                                   || !APPROVED_ACCTS.includes(r.account));
check('15 zero-sales rows are all assigned / in-category / in-account', badZero.length === 0,
      badZero.length ? `${badZero.length} unapproved, first ${badZero[0].ebay_id}`
                     : `${zeroRows.length} zero-sales rows, every one assigned`);

check('16 no unassigned zero-sales row (the original all-ID fault)',
      zeroRows.every(r => ASSIGNED.has(r.ebay_id)),
      `${rows.length - zeroRows.length} with September sales, ${zeroRows.length} assigned-but-no-sales`);

// 17 date scope + sales reconciliation against the independent DB aggregation
const recon2 = JSON.parse(readFileSync(resolve(ROOT, 'evidence/extract-2026-09-30-final/sales-reconciliation.json'), 'utf8'));
const ds = recon2.date_scope_proof;
check('17 date scope: September 2025 / September 2026 only',
      ds.distinct_year_months === 2 && ds.rows_outside_september === 0 && ds.rows_outside_2025_2026 === 0
      && ds.ly_min === '2025-09-01' && ds.ly_max === '2025-09-30' && ds.ty_min === '2026-09-01',
      `LY ${ds.ly_min}..${ds.ly_max}, TY ${ds.ty_min}..${ds.ty_max}, ${ds.rows_outside_september} rows outside September`);

let recOk = true, recDetail = [];
for (const b of recon2.by_currency) {
  const mine = rows.filter(r => r.currency === b.currency);
  const ly = Math.round(mine.reduce((a, r) => a + r.ly_sales, 0) * 100) / 100;
  const ty = Math.round(mine.reduce((a, r) => a + r.ty_sales, 0) * 100) / 100;
  const ok = mine.length === b.rows && Math.abs(ly - b.ly_sales) <= 0.01 && Math.abs(ty - b.ty_sales) <= 0.01;
  if (!ok) recOk = false;
  recDetail.push(`${b.currency} ${mine.length}/${b.rows} LY ${ly}/${b.ly_sales} TY ${ty}/${b.ty_sales}`);
}
check('18 sales reconcile vs direct September DB aggregation', recOk, recDetail.join(' | '));

// 19 enrichment never populated: rows carrying only traffic/ads and no sales cannot exist
const enrichOnly = rows.filter(r =>
  (r.ly_views > 0 || r.ty_views > 0 || r.ad_impressions > 0 || r.ad_clicks > 0 ||
   r.ad_spend > 0 || r.ly_ad_sales > 0 || r.ty_ad_sales > 0)
  && r.ly_sales === 0 && r.ty_sales === 0 && !ASSIGNED.has(r.ebay_id));
check('19 traffic/ads enrich only, never populate', enrichOnly.length === 0,
      `${rows.filter(r => r.ty_views > 0 || r.ly_views > 0).length} rows enriched with views, ${enrichOnly.length} unqualified`);

// ---------------------------------------------------------------------------
// 22-27 SIX-ACCOUNT BUSINESS SCOPE (2026-09-29)
// Only the six business reporting groups the senior reviews may appear, and the
// LEDSone split must hold exactly. These are data gates, not UI gates — the rows
// themselves are filtered, so hiding an account in the dropdown cannot pass them.
// ---------------------------------------------------------------------------
const APPROVED = ['Sunsone','Ledsone','Electricalsone','Huttenlampen','ledsone uk de','ledsone de'];
const present = [...new Set(rows.map(r => r.account))].sort();
const unexpected = present.filter(a => !APPROVED.includes(a));
const missing    = APPROVED.filter(a => !present.includes(a));

check('22 only approved accounts present', unexpected.length === 0,
      unexpected.length ? 'UNEXPECTED: ' + unexpected.join(', ') : present.length + ' accounts: ' + present.join(' | '));
check('23 all six approved accounts present', missing.length === 0,
      missing.length ? 'MISSING: ' + missing.join(', ') : 'all six');
check('24 exactly six distinct accounts', present.length === 6, present.length + ' distinct');

// 25 'ledsone uk de' is led_sone (sub_source 1) on the DE marketplace, and only that
const ukde = rows.filter(r => r.account === 'ledsone uk de');
check('25 ledsone uk de = led_sone + DE only',
      ukde.length > 0 && ukde.every(r => r.account_id === 1 && r.marketplace === 'DE'),
      ukde.length + ' rows, marketplaces ' + [...new Set(ukde.map(r => r.marketplace))].join(','));

// 26 plain 'Ledsone' is the same account with the DE portion removed
const led = rows.filter(r => r.account === 'Ledsone');
check('26 Ledsone excludes DE (assigned to ledsone uk de)',
      led.length > 0 && led.every(r => r.account_id === 1 && r.marketplace !== 'DE'),
      led.length + ' rows, marketplaces ' + [...new Set(led.map(r => r.marketplace))].sort().join(','));

// 27 'ledsone de' is the separate sub_source 27, never conflated with the two above
const de = rows.filter(r => r.account === 'ledsone de');
check('27 ledsone de = ledsonede (sub_source 27), distinct',
      de.length > 0 && de.every(r => r.account_id === 27),
      de.length + ' rows, account_ids ' + [...new Set(de.map(r => r.account_id))].join(','));

// 28 per-account reconciliation against the independent DB aggregation
let accOk = true, accDetail = [];
for (const b of recon2.by_account) {
  const mine = rows.filter(r => r.account === b.account);
  const ly = Math.round(mine.reduce((a, r) => a + r.ly_sales, 0) * 100) / 100;
  const ty = Math.round(mine.reduce((a, r) => a + r.ty_sales, 0) * 100) / 100;
  const ok = mine.length === b.rows && Math.abs(ly - b.ly_sales) <= 0.01 && Math.abs(ty - b.ty_sales) <= 0.01;
  if (!ok) accOk = false;
  accDetail.push(b.account + ' ' + mine.length + '/' + b.rows);
}
check('28 per-account rows and sales reconcile', accOk, accDetail.join(' | '));

// ---------------------------------------------------------------------------
// 29-33 SKU ID + CATEGORY (2026-09-29)
// Both come from the eBay listing itself (listings.ebay_listings, all_list = 1, keyed
// sub_source + item_id) — item-level and single-valued. The SKU -> Shopify/Amazon
// product_type route is NOT used; it is many-to-many and was proven unreliable.
// ---------------------------------------------------------------------------
const withSku = rows.filter(r => r.sku_id && r.sku_id.trim() !== '').length;
check('29 SKU ID present on every row (or explicitly blank)',
      rows.every(r => typeof r.sku_id === 'string'),
      withSku + '/' + rows.length + ' carry a SKU ID (' + ((withSku/rows.length)*100).toFixed(1) + '%)');

const named = rows.filter(r => r.category !== 'Unknown' && !/^Uncategorised /.test(r.category)).length;
check('30 Category present on every row',
      rows.every(r => typeof r.category === 'string' && r.category.trim() !== ''),
      named + '/' + rows.length + ' named (' + ((named/rows.length)*100).toFixed(1) + '%), ' +
      new Set(rows.map(r => r.category)).size + ' distinct');

check('31 meta.categories matches the rows',
      Array.isArray(meta.categories) &&
      meta.categories.length === new Set(rows.map(r => r.category)).size &&
      rows.every(r => meta.categories.includes(r.category)),
      (meta.categories || []).length + ' categories in meta');

// 32 categories must SEPARATE product groups — shades, bulbs and transformers cannot
// share a category, or the senior's filter would not isolate anything.
const cats = [...new Set(rows.map(r => r.category))];
const shadeCats = cats.filter(c => /shade/i.test(c));
const bulbCats  = cats.filter(c => /bulb|gl[üu]hbirne|leuchtmittel|ampoule/i.test(c));
const trafoCats = cats.filter(c => /transform|netzteil|stromwandler|schaltnetzteil/i.test(c));
const overlap = shadeCats.filter(c => bulbCats.includes(c) || trafoCats.includes(c));
check('32 shade / bulb / transformer categories are disjoint', overlap.length === 0,
      'shade[' + shadeCats.join(', ') + '] bulb[' + bulbCats.join(', ') + '] transformer[' + trafoCats.join(', ') + ']');

// 33 cascading integrity: every account has at least one category, and every
// (account, category) pair in the data is reachable from that account's option list.
let cascadeOk = true, cascadeDetail = [];
for (const a of meta.accounts) {
  const mine = rows.filter(r => r.account === a);
  const cs = new Set(mine.map(r => r.category));
  if (!mine.length || !cs.size) cascadeOk = false;
  cascadeDetail.push(a + ':' + cs.size);
}
check('33 every account has selectable categories', cascadeOk, cascadeDetail.join(' | '));

// ---------------------------------------------------------------------------
// 34-38 UTHARSIKA PRODUCT SCOPE (2026-09-29)
// The population is utharsika's own PH product assignment — ledsone
// staff.ph_categories (user_id 109) -> staff.ph_category_products (source_id 2 = EBAY).
// Category is her own PH category name, normalised. Nothing else may appear.
// ---------------------------------------------------------------------------
const allow = JSON.parse(readFileSync(resolve(ROOT, 'evidence/extract-2026-09-30-final/utharsika-ebay-allowlist.json'), 'utf8'));
const ALLOW = new Set(allow.item_ids);

const outside = rows.filter(r => !ALLOW.has(r.ebay_id));
check("34 every eBay ID is in utharsika PH assignment", outside.length === 0,
      outside.length ? outside.length + ' outside, first ' + outside[0].ebay_id
                     : rows.length + ' rows drawn from ' + ALLOW.size + ' assigned IDs');

const ONLY = ['Lamp Shade', 'Wall Plug'];
const badCat = rows.filter(r => !ONLY.includes(r.category));
check('35 every Category is Lamp Shade or Wall Plug', badCat.length === 0,
      badCat.length ? [...new Set(badCat.map(r => r.category))].join(', ')
                    : Object.entries(rows.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{}))
                        .map(([k,v]) => k + ' ' + v).join(' | '));

check('36 Category filter offers exactly the two categories',
      Array.isArray(meta.categories) && meta.categories.length === 2 &&
      ONLY.every(c => meta.categories.includes(c)),
      (meta.categories || []).join(' | '));

// 37 the senior's complaint, stated as a test: no bulbs, transformers, drivers, supplies
const WRONG = /bulb|gl[üu]hbirne|leuchtmittel|ampoule|transform|netzteil|trafo|stromwandler|driver|powers*supply|schaltnetzteil/i;
const leaked = rows.filter(r => WRONG.test(r.category));
check('37 no bulb / transformer / driver / power-supply categories', leaked.length === 0,
      leaked.length ? [...new Set(leaked.map(r => r.category))].join(', ') : 'clean');

// 38 per-category reconciliation against the independent DB aggregation
let catOk = true, catDetail = [];
for (const b of (recon2.by_category || [])) {
  const mine = rows.filter(r => r.category === b.category);
  const ly = Math.round(mine.reduce((a, r) => a + r.ly_sales, 0) * 100) / 100;
  const ty = Math.round(mine.reduce((a, r) => a + r.ty_sales, 0) * 100) / 100;
  if (mine.length !== b.rows || Math.abs(ly - b.ly_sales) > 0.01 || Math.abs(ty - b.ty_sales) > 0.01) catOk = false;
  catDetail.push(b.category + ' ' + mine.length + '/' + b.rows + ' LY ' + ly + ' TY ' + ty);
}
check('38 per-category rows and sales reconcile', catOk && (recon2.by_category || []).length === 2,
      catDetail.join(' | '));

// 39 Electricalsone acceptance test (business-confirmed 2026-09-29)
const ELEC_WP = ['267519662345','267520860246','267528386122','267528394108'];
const elecWp = rows.filter(r => r.account === 'Electricalsone' && r.category === 'Wall Plug');
const elecLs = rows.filter(r => r.account === 'Electricalsone' && r.category === 'Lamp Shade');
check('39 Electricalsone has both categories, incl. the 4 Wall Plug products',
      elecWp.length === 4 && elecLs.length > 0 &&
      ELEC_WP.every(id => elecWp.some(r => r.ebay_id === id)),
      `Wall Plug ${elecWp.length} (${elecWp.map(r => r.ebay_id).sort().join(', ')}) · Lamp Shade ${elecLs.length}`);

// ---------------------------------------------------------------------------
// 40-44 CORRECTED eBay METRIC CONTRACT (2026-09-29)
// ---------------------------------------------------------------------------
// 40 Orders = COUNT(DISTINCT orders.order_id), re-read straight from the raw side-car so the
// gate cannot pass just because build.mjs and the dataset agree with each other.
// Re-read straight from the raw pack I extract (cols 25/26 = distinct orders, 11/12 = OMS
// units, 31/32 = order lines) so this gate cannot pass merely because build.mjs and the
// dataset agree with each other.
const RAW_X = JSON.parse(JSON.parse(readFileSync(
  resolve(ROOT, 'evidence/extract-2026-09-30-final/pack-i-extract.json'), 'utf8'))
  .data.rows[0].payload);
const RAW_ORD = new Map(RAW_X.map(r =>
  [`${r[0]}|${r[2]}|${r[3]}`, { ly: +r[25], ty: +r[26], lyU: +r[11], tyU: +r[12],
                                 lyL: +r[31], tyL: +r[32], lyS: +r[9], tyS: +r[10],
                                 lyAG: +r[30], lyV: +r[13], tyV: +r[14],
                                 lyQ: +r[28], tyQ: +r[29],
                                 im: +r[18], cl: +r[19], sp: +r[17] }]));
const ordBad = rows.filter(r => {
  const raw = RAW_ORD.get(`${r.account_id}|${r.ebay_id}|${r.marketplace}`) || { ly: 0, ty: 0 };
  return r.ly_orders !== raw.ly || r.ty_orders !== raw.ty;
});
check('40 Orders = COUNT(DISTINCT order_id) from raw orders, not quantity_sold, not OMS units',
      ordBad.length === 0 &&
      rows.every(r => Number.isInteger(r.ly_orders) && Number.isInteger(r.ty_orders)),
      ordBad.length ? ordBad.length + ' disagree with raw, first ' + ordBad[0].ebay_id
      : 'distinct orders LY ' + rows.reduce((a,r)=>a+r.ly_orders,0) + ' / TY ' + rows.reduce((a,r)=>a+r.ty_orders,0) +
        ' · quantity_sold LY ' + rows.reduce((a,r)=>a+r.ly_qty_sold,0) + ' / TY ' + rows.reduce((a,r)=>a+r.ty_qty_sold,0) +
        ' · OMS units LY ' + rows.reduce((a,r)=>a+r.ly_units,0) + ' / TY ' + rows.reduce((a,r)=>a+r.ty_units,0));

// 40b Orders <= OMS units is a true invariant: both come from the SAME order_management
// source over the SAME window, and a customer order buys at least one unit of the item.
// Orders <= quantity_sold is deliberately NOT asserted -- quantity_sold is a separate eBay
// traffic feed with incomplete September coverage (LY 28 of 30 days, TY 28 days), so on some
// rows it reports fewer units than there were real orders. Asserting it would be asserting a
// premise the sources do not support.
const unitsBad = rows.filter(r => r.ly_orders > r.ly_units || r.ty_orders > r.ty_units);
check('40b Orders never exceed OMS units (same source, same window)', unitsBad.length === 0,
      unitsBad.length ? unitsBad.length + ' violate, first ' + unitsBad[0].ebay_id
                      : 'all ' + rows.length + ' rows');

// 40e Orders <= order LINES: an order contributes at least one line, and a multi-line order
// collapses to one order. Proves the DISTINCT actually happened rather than lines being counted.
const linesBad = rows.filter(r => r.ly_orders > r.ly_order_lines || r.ty_orders > r.ty_order_lines);
check('40e Orders never exceed order lines, and collapse multi-line orders',
      linesBad.length === 0 &&
      rows.some(r => r.ly_orders < r.ly_order_lines || r.ty_orders < r.ty_order_lines),
      linesBad.length ? linesBad.length + ' violate, first ' + linesBad[0].ebay_id
        : 'lines LY ' + rows.reduce((a,r)=>a+r.ly_order_lines,0) + ' / TY ' + rows.reduce((a,r)=>a+r.ty_order_lines,0) +
          ' vs orders LY ' + rows.reduce((a,r)=>a+r.ly_orders,0) + ' / TY ' + rows.reduce((a,r)=>a+r.ty_orders,0));

// 40d Orders must not be a restatement of either units series -- the whole point of the fix.
const ctrlRow = rows.find(r => r.ebay_id === '164525233292') || {};
check('40d Orders differ from quantity_sold and from OMS units (not a relabelled units column)',
      rows.some(r => r.ly_orders !== r.ly_qty_sold || r.ty_orders !== r.ty_qty_sold) &&
      rows.some(r => r.ly_orders !== r.ly_units    || r.ty_orders !== r.ty_units),
      'control 164525233292 — orders ' + ctrlRow.ly_orders + ' · quantity_sold ' +
      ctrlRow.ly_qty_sold + ' · OMS units ' + ctrlRow.ly_units);

// 40c The control the business checks, asserted on its own.
const ctrl = rows.find(r => r.ebay_id === '164525233292');
check('40c Control 164525233292: LY Orders = 62, LY Sales = 1210.05, lines 66, units 94',
      !!ctrl && ctrl.ly_orders === 62 && Math.abs(ctrl.ly_sales - 1210.05) < 0.005
            && ctrl.ly_order_lines === 66 && ctrl.ly_units === 94,
      ctrl ? `LY Orders ${ctrl.ly_orders}/62 · LY Sales ${ctrl.ly_sales}/1210.05 · ` +
             `lines ${ctrl.ly_order_lines}/66 · units ${ctrl.ly_units}/94`
           : 'control row missing');

// 41 Conversion must BE eBay STR: quantity_sold/views*100, recomputed independently here.
// It is deliberately NOT distinct Orders / views — that would be a rate eBay never reports.
const convBad = rows.filter(r => {
  const exp = k => r[k+'_views'] > 0 ? Math.round((r[k+'_qty_sold']/r[k+'_views'])*10000)/100 : null;
  return r.ly_conversion_pct !== exp('ly') || r.ty_conversion_pct !== exp('ty');
});
check('41 Conversion % equals eBay STR (quantity_sold/views), not distinct Orders/views',
      convBad.length === 0,
      convBad.length ? convBad.length + ' mismatched, first ' + convBad[0].ebay_id : 'all ' + rows.length + ' rows');

// 41b LY REGRESSION GUARD. LY September 2025 is closed, complete data: nothing about a TY
// refresh may move it. These figures were independently re-derived from raw on 2026-09-30 and
// are asserted as absolutes. (The gate this replaces froze TY Conversion against the pre-fix
// dataset — a premise that expired the moment TY traffic gained 2026-09-28. Freezing TY would
// have forced the dashboard to publish a stale rate.)
const LY_BASELINE = { sales: 3182.15, orders: 185, views: 8487, ad_generated: 2952.12,
                      units: 259, lines: 0 };
const lySalesTot = Math.round(rows.reduce((a,r)=>a+r.ly_sales,0)*100)/100;
const lyAdGenTot = Math.round(rows.reduce((a,r)=>a+r.ly_ad_generated,0)*100)/100;
check('41b LY (closed period) has not regressed',
      Math.abs(lySalesTot - LY_BASELINE.sales) < 0.01 &&
      rows.reduce((a,r)=>a+r.ly_orders,0) === LY_BASELINE.orders &&
      rows.reduce((a,r)=>a+r.ly_views,0)  === LY_BASELINE.views &&
      rows.reduce((a,r)=>a+r.ly_units,0)  === LY_BASELINE.units &&
      Math.abs(lyAdGenTot - LY_BASELINE.ad_generated) < 0.01,
      `LY Sales ${lySalesTot}/${LY_BASELINE.sales} · Orders ${rows.reduce((a,r)=>a+r.ly_orders,0)}/${LY_BASELINE.orders} ` +
      `· Views ${rows.reduce((a,r)=>a+r.ly_views,0)}/${LY_BASELINE.views} · Units ${rows.reduce((a,r)=>a+r.ly_units,0)}/${LY_BASELINE.units} ` +
      `· Ad-Generated ${lyAdGenTot}/${LY_BASELINE.ad_generated}`);

// 41c EVERY published field on EVERY row must equal the raw extract. This is the broad
// "dashboard == raw data" gate: no field may be approximated, copied from a neighbour, or
// left behind by a partial rebuild.
const FIELD_MAP = [
  ['ly_sales','lyS',0.005], ['ty_sales','tyS',0.005], ['ly_orders','ly',0], ['ty_orders','ty',0],
  ['ly_units','lyU',0], ['ty_units','tyU',0], ['ly_views','lyV',0], ['ty_views','tyV',0],
  ['ly_qty_sold','lyQ',0], ['ty_qty_sold','tyQ',0], ['ly_order_lines','lyL',0],
  ['ty_order_lines','tyL',0], ['ly_ad_generated','lyAG',0.005],
  ['ad_impressions','im',0], ['ad_clicks','cl',0], ['ad_spend','sp',0.005],
];
const rawDrift = [];
for (const r of rows) {
  const raw = RAW_ORD.get(`${r.account_id}|${r.ebay_id}|${r.marketplace}`);
  if (!raw) { rawDrift.push(`${r.ebay_id} missing from raw extract`); continue; }
  for (const [field, rawKey, tol] of FIELD_MAP)
    if (Math.abs(Number(r[field]) - raw[rawKey]) > tol)
      rawDrift.push(`${r.ebay_id}.${field} dashboard ${r[field]} vs raw ${raw[rawKey]}`);
}
check('41c every published field on every row equals the raw extract', rawDrift.length === 0,
      rawDrift.length ? `${rawDrift.length} drifted, first: ${rawDrift[0]}`
                      : `${rows.length} rows x ${FIELD_MAP.length} fields = ${rows.length * FIELD_MAP.length} raw checks clean`);

// 42 Avg Price is ASP over OMS units — never over eBay orders
const aspBad = rows.filter(r => {
  const exp = k => r[k+'_units'] > 0 ? Math.round((r[k+'_sales']/r[k+'_units'])*100)/100 : null;
  return r.ly_price !== exp('ly') || r.ty_price !== exp('ty');
});
check('42 Avg Price = Sales / units sold', aspBad.length === 0,
      aspBad.length ? aspBad.length + ' mismatched, first ' + aspBad[0].ebay_id : 'ASP consistent');

// 43 image mapping: at most one image per row, and it must be an eBay image URL
const imgRows = rows.filter(r => r.image_url);
// Every image comes from listings.ebay_listings.main_image_url for that exact
// account+item_id. The column legitimately holds several CDNs (eBay, Amazon media,
// LEDSone storage, ListingMirror), so the gate checks transport and shape, not host.
const badImg = imgRows.filter(r => !(r.image_url.startsWith('https://') && r.image_url.split('/').length > 3));
check('43 SKU images are eBay listing images, no row multiplication',
      badImg.length === 0 && rows.length === new Set(rows.map(r => r.account_id+'|'+r.ebay_id+'|'+r.marketplace)).size,
      imgRows.length + '/' + rows.length + ' with an image (' + ((imgRows.length/rows.length)*100).toFixed(1) + '%), ' +
      badImg.length + ' malformed, ' + new Set(imgRows.map(r=>r.image_url.split('/')[2])).size + ' source CDNs');

// 44 ROAS/ACoS derive from summed money, never from averaged per-row eBay rates
const roasBad = rows.filter(r => {
  const exp = r.ad_spend > 0 ? Math.round((r.ad_sales/r.ad_spend)*100)/100 : null;
  return r.roas !== exp;
});
check('44 ROAS = Ad Sales / Ad Spend', roasBad.length === 0,
      roasBad.length ? roasBad.length + ' mismatched' : 'aggregate ratio, not averaged');

// ---------------------------------------------------------------------------
// 45-48 ACTUAL SKU SALES SPLIT (2026-09-29) — LY proven, TY deliberately absent
// ---------------------------------------------------------------------------
const splitBad = rows.filter(r =>
  r.ly_ad_generated < 0 || r.ly_non_ad < 0 ||
  r.ly_ad_generated > r.ly_sales + 0.005 ||
  Math.abs(r.ly_sales - (r.ly_ad_generated + r.ly_non_ad)) > 0.005);
check('45 LY Sales = Ad-Generated + Non-Ad-Attributed, Ad <= Total', splitBad.length === 0,
      splitBad.length ? splitBad.length + ' violations, first ' + splitBad[0].ebay_id
        : 'LY total ' + rows.reduce((s,r)=>s+r.ly_sales,0).toFixed(2) +
          ' = ad ' + rows.reduce((s,r)=>s+r.ly_ad_generated,0).toFixed(2) +
          ' + non-ad ' + rows.reduce((s,r)=>s+r.ly_non_ad,0).toFixed(2));

// 46 the control SKU the business named
const ctl = rows.find(r => r.ebay_id === '164525233292');
check('46 control SKU 164525233292 splits exactly',
      !!ctl && Math.abs(ctl.ly_sales - 1210.05) < 0.005 &&
      Math.abs(ctl.ly_ad_generated - 1210.05) < 0.005 && Math.abs(ctl.ly_non_ad) < 0.005,
      ctl ? ctl.ly_sales + ' = ' + ctl.ly_ad_generated + ' + ' + ctl.ly_non_ad + ', ' + ctl.ly_ad_pct + '%' : 'MISSING');

// 47 TY attribution must be NULL everywhere — never 0, which would read as "no ad sales"
const tyBad = rows.filter(r => r.ty_ad_generated !== null || r.ty_non_ad !== null || r.ty_ad_pct !== null);
check('47 TY attribution is null (Pending), never zero', tyBad.length === 0,
      tyBad.length ? tyBad.length + ' rows carry a TY attribution value' : 'all ' + rows.length + ' rows null');

// 48 Segment C still uses the eBay attributed metric, not the incomplete TY billing
check('48 Segment C uses eBay attributed ad sales, not TY AD_FEE',
      rows.filter(r => r.segment === 'C').every(r => r.ly_ad_sales > 0 && r.ty_ad_sales === 0),
      (meta.segments.C || 0) + ' C rows, all on the attributed rule');

// 20 partial-TY metadata present
// ---------------------------------------------------------------------------
// 49-54 CLASSIFICATION COMPLETENESS (2026-09-30) — every assigned product is shown
//
// BUSINESS RULE UNDER TEST: "No assigned product may be excluded solely because its
// classification is missing; missing/unclassified falls back to D — Lost Performers."
//
// History these gates exist to prevent: rows the A/B/C/D rules did not match were labelled
// 'Other' and filtered out of the published view, silently hiding 115 of 186 assigned products
// — including the control SKU 164525233292, the single largest LY seller. Nothing may hide a
// product again: not a missing segment, not a view filter, not a packaging step.
// ---------------------------------------------------------------------------
const SEGMENTS = ['A', 'B', 'C', 'D'];
const segCount = rows.reduce((a, r) => (a[r.segment] = (a[r.segment] || 0) + 1, a), {});
const segTotal = SEGMENTS.reduce((n, k) => n + (segCount[k] || 0), 0);
const unclassified = rows.filter(r => !SEGMENTS.includes(r.segment));

check('49 every assigned product is classified A/B/C/D, and A+B+C+D equals the row count',
      unclassified.length === 0 && segTotal === rows.length,
      unclassified.length
        ? `${unclassified.length} unclassified (first ${unclassified[0].ebay_id} = "${unclassified[0].segment}")`
        : `A ${segCount.A||0} + B ${segCount.B||0} + C ${segCount.C||0} + D ${segCount.D||0} ` +
          `= ${segTotal} = ${rows.length} rows · 0 unclassified · 0 hidden`);

const IDX = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const SA  = readFileSync(resolve(ROOT, 'September-Comparison-Dashboard.html'), 'utf8');

// 50 The page must show every row. A view filter on segment is exactly how products vanished
// before, so its ABSENCE is asserted — in the source page and in the packaged standalone.
check('50 the page hides nothing: no segment filter on the view, no Other option',
      /^\s*DATA = SOURCE;\s*$/m.test(IDX) && /^\s*DATA = SOURCE;\s*$/m.test(SA) &&
      !/DATA = SOURCE\.filter/.test(IDX) && !/DATA = SOURCE\.filter/.test(SA) &&
      !/<option value="Other">/.test(IDX) && !/<option value="Other">/.test(SA) &&
      !/Other:'Other/.test(IDX),
      'DATA = SOURCE in index.html and standalone; no view-level segment filter; no Other option');

// 51 Cards: Total is summed from the four buckets, so if it ever disagreed with the row count
// the card itself would expose it rather than hide it.
check('51 summary cards cover A/B/C/D with Total = A+B+C+D = all rows',
      IDX.includes("const total = PUBLISHED_SEGS.reduce((n, k) => n + (seg[k] || 0), 0);") &&
      !/\['Other', seg\.Other/.test(IDX) && segTotal === rows.length,
      `Total ${segTotal} = Listings shown ${rows.length}`);

// 52 Classification is a LABEL. It must not have moved a single metric: re-checked against the
// raw extract, independently of the build.
const METRIC_FIELDS = ['ly_sales','ty_sales','yoy_pct','ly_ad_sales','ty_ad_sales','ly_views',
  'ty_views','ly_orders','ty_orders','ly_conversion_pct','ty_conversion_pct','ly_price',
  'ty_price','ad_impressions','ad_clicks','ad_spend','ad_sales','roas','acos',
  'ly_ad_generated','ly_non_ad','ly_units','ty_units','ly_qty_sold','ty_qty_sold'];
const rawByKey = new Map(RAW_X.map(r => [`${r[0]}|${r[2]}|${r[3]}`, r]));
const metricDrift = rows.filter(r => {
  const raw = rawByKey.get(`${r.account_id}|${r.ebay_id}|${r.marketplace}`);
  if (!raw) return true;
  return Math.abs(r.ly_sales - +raw[9]) > 0.005 || Math.abs(r.ty_sales - +raw[10]) > 0.005
      || r.ly_orders !== +raw[25] || r.ty_orders !== +raw[26]
      || r.ly_views !== +raw[13] || r.ty_views !== +raw[14]
      || r.ly_units !== +raw[11] || r.ty_units !== +raw[12]
      || r.ad_impressions !== +raw[18] || r.ad_clicks !== +raw[19];
});
check('52 classification changed no metric — all rows still match the raw extract',
      metricDrift.length === 0 && METRIC_FIELDS.every(f => rows.every(r => f in r)),
      metricDrift.length ? `${metricDrift.length} rows drifted, first ${metricDrift[0].ebay_id}`
        : `${rows.length} rows match raw · all ${METRIC_FIELDS.length} metric fields present`);

// 53 The fallback itself. Any row that satisfies none of A/B/C must be D, and D must be
// reported as the two populations it now contains, so nobody mistakes its size for lost revenue.
const wByKey = new Map(RAW_X.map(r => [`${r[0]}|${r[2]}|${r[3]}`, { last7: +r[20], prev7: +r[21] }]));
const matchesRule = r => {
  const w = wByKey.get(`${r.account_id}|${r.ebay_id}|${r.marketplace}`) || { last7: 0, prev7: 0 };
  if (r.ly_sales > 0 && r.ty_sales === 0) return 'D';
  if (r.ly_ad_sales > 0 && r.ty_ad_sales === 0) return 'C';
  if (r.ty_sales < r.ly_sales && w.last7 > w.prev7) return 'B';
  if (r.ty_sales > r.ly_sales) return 'A';
  return null;                                    // matches no rule -> must fall back to D
};
const ruleD = rows.filter(r => matchesRule(r) === 'D');
const fallbackD = rows.filter(r => matchesRule(r) === null);
const badFallback = fallbackD.filter(r => r.segment !== 'D');
const badRule = rows.filter(r => { const m = matchesRule(r); return m && m !== r.segment; });
check('53 unclassified falls back to D, and A/B/C assignments are untouched',
      badFallback.length === 0 && badRule.length === 0,
      badFallback.length ? `${badFallback.length} unmatched rows are not D, first ${badFallback[0].ebay_id}`
      : badRule.length ? `${badRule.length} rows overrode their rule, first ${badRule[0].ebay_id}`
      : `D ${segCount.D||0} = ${ruleD.length} by the LY>0/TY=0 rule + ${fallbackD.length} fallback · ` +
        `A/B/C ${(segCount.A||0)+(segCount.B||0)+(segCount.C||0)} all rule-matched`);

// 54 REGRESSION: the control SKU must never silently disappear again. It is the largest LY
// seller and the figure the business checks, and it was the most visible casualty of the
// hidden-rows fault. Asserted by identity AND by its verified source metrics.
const CTRL = rows.find(r => r.ebay_id === '164525233292');
check('54 regression: control 164525233292 is present, intact and classified',
      !!CTRL && CTRL.account === 'Ledsone' && CTRL.marketplace === 'GB' &&
      CTRL.category === 'Lamp Shade' && SEGMENTS.includes(CTRL.segment) &&
      Math.abs(CTRL.ly_sales - 1210.05) < 0.005 && CTRL.ly_orders === 62 &&
      CTRL.ly_order_lines === 66 && CTRL.ly_units === 94 &&
      !!CTRL.sku_id && !!CTRL.image_url,
      CTRL ? `present · ${CTRL.account}/${CTRL.marketplace}/${CTRL.category} · Segment ${CTRL.segment} · ` +
             `LY Sales ${CTRL.ly_sales} · LY Orders ${CTRL.ly_orders} · lines ${CTRL.ly_order_lines} · ` +
             `units ${CTRL.ly_units} · searchable by SKU ID ${CTRL.sku_id}`
           : 'CONTROL SKU 164525233292 IS MISSING FROM THE DATASET');

// 54b The control must also be reachable in the packaged standalone the business opens.
check('54b regression: control 164525233292 is embedded in the published standalone',
      SA.includes('164525233292'),
      SA.includes('164525233292') ? 'present in September-Comparison-Dashboard.html'
                                  : 'ABSENT from the packaged dashboard');

check('20 partial-TY metadata present', meta.ty_is_partial === true && !!meta.source_max_dates.traffic,
      `traffic ${meta.source_max_dates.traffic}, orders ${meta.source_max_dates.sales}, ads ${meta.source_max_dates.ads}`);

// 21 the corrected scope is recorded in the dataset itself
check('21 population rule recorded in meta',
      /PH eBay product assignment/.test(meta.population_rule || '') &&
      /September sales are NOT required/.test(meta.population_rule || ''),
      (meta.population_rule || 'MISSING').slice(0, 120) + '…');

// coverage
check('   coverage: LY and TY both non-empty',
      rows.some(r => r.ly_sales > 0) && rows.some(r => r.ty_sales > 0));

console.log(`\n${fails === 0 ? 'ALL GATES PASSED' : fails + ' GATE(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
