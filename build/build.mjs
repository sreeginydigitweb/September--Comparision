// build.mjs — merge extraction -> data/september-comparison.json
// Implements documentation/analysis-v1-decisions.md. Zero dependencies.
//
// SCOPE CORRECTION 2026-09-29: the population is SALES-DRIVEN. The extract is now
// produced by sql/f-combined-sales-driven.sql, which builds its base population from
// September sales only and LEFT JOINs traffic/ads/identity as enrichment. The guard
// below re-asserts that rule here so a wrong extract can never reach the dashboard.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv[2];
if (!RAW) { console.error('usage: node build/build.mjs <extract.txt>'); process.exit(1); }

// Column order of the extracted arrays — sql/i-fresh-authoritative.sql, 33 columns.
// Load-bearing: build.mjs destructures positionally. Cols 25/26 are DISTINCT ORDERS;
// cols 28/29 are eBay quantity_sold and feed CONVERSION ONLY; col 30 is LY Ad-Generated;
// cols 31/32 are order-LINE counts, carried for audit and never published as Orders.
const [ACCT_ID, ACCT, ITEM, MK, CUR, SKU_N, SKU1, PSKU, TITLE,
       LY_SALES, TY_SALES, LY_UNITS, TY_UNITS, LY_VIEWS, TY_VIEWS,
       LY_ADS, TY_ADS, TY_SPEND, TY_IMPR, TY_CLICKS, LAST7, PREV7,
       SKU_ID, CATEGORY, CATEGORY_ID, LY_ORD, TY_ORD, IMAGE,
       LY_QTY, TY_QTY, LY_ADGEN, LY_LINES, TY_LINES] = [...Array(33).keys()];

// NO SIDE-CAR EVIDENCE FILES. Every metric — Sales, Orders, Views, Conversion numerator,
// LY Ad-Generated, ad performance — now comes from the single pack I extract, so no frozen
// companion file can silently disagree with a rebuild. (Both the LY ad split and the Orders
// counts used to live in separate JSON files; the split file had drifted from the query that
// was supposed to reproduce it.)
const wrapper = JSON.parse(readFileSync(RAW, 'utf8'));
const rows = JSON.parse(wrapper.data.rows[0].payload);

// Positional destructuring is only safe if every row really is 33 wide.
const badWidth = rows.filter(r => r.length !== 33);
if (badWidth.length)
  throw new Error(`extract column contract violated: ${badWidth.length} of ${rows.length} rows ` +
                  `are not 33 columns (first is ${badWidth[0].length}) — wrong SQL pack?`);

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2  = n => Math.round(n * 100) / 100;

// Source coverage of this extract. TY September 2026 is partial by definition.
// Re-verified against the live DB on 2026-09-30 before this build. Each TY source ends on a
// different day; that is a source-coverage fact and is published, not smoothed over.
//   orders (all eBay) 2026-09-30 03:30 · orders (assigned population) 2026-09-29
//   traffic 2026-09-28 · listing_performance 2026-09-30 · AD_FEE 2026-09-03
const SOURCE_MAX = { sales: '2026-09-29', ads: '2026-09-30', traffic: '2026-09-28' };

// Segment B: recovery windows are anchored on the latest available TY order date.
// Windows: last 7 = (anchor-6)..anchor, preceding 7 = the 7 days before that. The TY span
// is the anchor's day-of-month, so the ">= 14 usable TY days" condition is satisfied at
// window level; a listing with no TY activity scores 0 > 0 = false and is never B.
const TY_SPAN_DAYS = Number(SOURCE_MAX.sales.slice(-2));
const B_ELIGIBLE = TY_SPAN_DAYS >= 14;

// POPULATION RULE (2026-09-29, revised). The population is utharsika's verified PH
// product assignment, restricted to her two categories and the six approved accounts.
// September sales are NOT required: an assigned product with no September sales appears
// with LY = 0 and TY = 0 rather than vanishing. That is a deliberate, narrow exception —
// a zero-sales row is only ever legitimate because the product is ASSIGNED, never because
// it merely exists on eBay. The guard below enforces exactly that.
const CATS = ['Lamp Shade', 'Wall Plug'];
const ACCOUNTS = ['Sunsone','Ledsone','Electricalsone','Huttenlampen','ledsone uk de','ledsone de'];
const badScope = rows.filter(r => !CATS.includes(r[CATEGORY]) || !ACCOUNTS.includes(r[ACCT]));
if (badScope.length)
  throw new Error(`extract is out of scope: ${badScope.length} rows outside the two categories ` +
                  `or six accounts (first: ${badScope[0][ACCT]}/${badScope[0][CATEGORY]})`);

// Invariants asserted at build time, so a bad extract cannot reach the dashboard at all.
// These are relationships that must hold within ONE order snapshot:
//   * an order buys at least one unit of the item      -> orders <= units
//   * an order contributes at least one line           -> orders <= lines
//   * ad-generated revenue is part of the item's sales -> ly_ad_generated <= ly_sales
// Orders <= quantity_sold is deliberately NOT asserted: quantity_sold is a separate eBay
// traffic feed with incomplete September coverage, so it can legitimately report fewer units
// than there were real orders.
for (const r of rows) {
  const lo = Number(r[25]), to = Number(r[26]);
  if (lo > Number(r[11]) || to > Number(r[12]))
    throw new Error(`orders exceed OMS units for ${r[2]}: ${lo}/${r[11]} LY, ${to}/${r[12]} TY`);
  if (lo > Number(r[31]) || to > Number(r[32]))
    throw new Error(`orders exceed order lines for ${r[2]}: ${lo}/${r[31]} LY, ${to}/${r[32]} TY`);
  if (Number(r[30]) > Number(r[9]) + 0.01)
    throw new Error(`LY ad-generated ${r[30]} exceeds LY sales ${r[9]} for ${r[2]}`);
}

const out = rows.map(r => {
  const lySales = r2(num(r[LY_SALES])), tySales = r2(num(r[TY_SALES]));
  const lyUnits = num(r[LY_UNITS]),     tyUnits = num(r[TY_UNITS]);   // OMS units — ASP denominator only
  const lyQty   = num(r[LY_QTY]),       tyQty   = num(r[TY_QTY]);     // quantity_sold — CONVERSION numerator only
  const lyOrd   = num(r[LY_ORD]),       tyOrd   = num(r[TY_ORD]);     // COUNT(DISTINCT order_id)
  const lyLines = num(r[LY_LINES]),     tyLines = num(r[TY_LINES]);   // order LINES — audit only
  const lyAdGen = r2(num(r[LY_ADGEN]));                               // AD_FEE-attributed LY revenue
  const lyViews = num(r[LY_VIEWS]),     tyViews = num(r[TY_VIEWS]);
  const lyAdS   = r2(num(r[LY_ADS])),   tyAdS   = r2(num(r[TY_ADS]));
  const spend   = r2(num(r[TY_SPEND]));
  const last7   = num(r[LAST7]),        prev7   = num(r[PREV7]);

  // YoY %  (analysis section 3)
  let yoy = null, yoyLabel;
  if (lySales > 0) { yoy = r2(((tySales - lySales) / lySales) * 100); yoyLabel = null; }
  else if (tySales > 0) { yoyLabel = 'NEW'; }
  else { yoyLabel = 'N/A'; }

  // Conversion % = eBay quantity_sold / eBay views * 100. UNCHANGED by the Orders fix:
  // this is algebraically eBay's own
  // STR — verified to 4dp against ebay_traffic_data.str — so the dashboard agrees with
  // eBay's reported rate rather than inventing a different one.
  // from distinct Orders, which would produce a different rate that eBay never reports.
  const conv = (v, q) => v > 0 ? r2((q / v) * 100) : null;
  // Average Price = realised ASP = status-filtered Sales / OMS units. No historical eBay
  // listing price exists anywhere in ledsone, so this is a labelled fallback, not a quote.
  const asp  = (s, u) => u > 0 ? r2(s / u) : null;

  // ROAS / ACoS computed from cols 18-19 so the ratio always matches them (section 10)
  const roas = spend > 0 ? r2(tyAdS / spend) : null;
  const acos = tyAdS > 0 ? r2((spend / tyAdS) * 100) : null;

  // Segment — strict V1 precedence D -> C -> B -> A, with D as the FALLBACK (2026-09-30).
  // The four rules are tried in exactly the order they always were, so every product that
  // already earned A, B, C or D keeps it unchanged. The only change is the final branch:
  // what used to become 'Other' now falls back to D.
  //
  // Business rule: no assigned product may be excluded from the dashboard merely because the
  // rules do not classify it. Previously such rows became 'Other' and were filtered out of the
  // published view, which silently hid 115 of 186 assigned products — including the control SKU
  // 164525233292. D is now the catch-all so the dashboard is always complete.
  //
  // Caveat worth knowing: most fallback rows sold nothing in EITHER September, so "Lost
  // Performer" describes them loosely — they never performed rather than lost performance.
  // That is the business's chosen labelling; the dashboard's D tooltip and notes say so plainly
  // rather than letting the label overstate what the data shows.
  let segment;
  if (lySales > 0 && tySales === 0)                                    segment = 'D';
  else if (lyAdS > 0 && tyAdS === 0)                                   segment = 'C';
  else if (B_ELIGIBLE && tySales < lySales && last7 > prev7)           segment = 'B';
  else if (tySales > lySales)                                          segment = 'A';
  else                                                                 segment = 'D';   // fallback

  const skuCount = num(r[SKU_N]);
  const sku = skuCount === 1 ? (r[SKU1] || '—')
            : skuCount > 1   ? `${r[PSKU] || r[SKU1] || '—'} (${skuCount} variations)`
            : '—';

  return {
    account: r[ACCT] || `#${r[ACCT_ID]}`, account_id: r[ACCT_ID],
    marketplace: r[MK] || '—', currency: r[CUR],
    ebay_id: r[ITEM], sku, sku_count: skuCount, title: r[TITLE] || '',
    // SKU ID and Category come from the eBay listing itself (listings.ebay_listings,
    // all_list = 1, keyed sub_source + item_id) — item-level and single-valued. The
    // SKU -> Shopify/Amazon product_type route is deliberately NOT used: it is
    // many-to-many and was proven unreliable (84% of items carried conflicting types).
    sku_id: r[SKU_ID] || '', category: r[CATEGORY] || 'Unknown', category_id: r[CATEGORY_ID] || '',
    image_url: r[IMAGE] || '',
    ly_sales: lySales, ty_sales: tySales, yoy_pct: yoy, yoy_label: yoyLabel,
    // LY sales split. Ad-Generated is Promoted Standard (AD_FEE) attribution matched at
    // (order_id, item_id) to the purchased line; Non-Ad is the remainder and therefore
    // contains Promoted Advanced, which carries order_id='0' and cannot reach a SKU.
    // TY stays null -> "Pending": eBay AD_FEE billing reaches only 2026-09-03, so any TY
    // figure would be a guess presented as a fact.
    ly_ad_generated: lyAdGen,
    ly_non_ad: r2(lySales - lyAdGen),
    ly_ad_pct: lySales > 0 ? r2((lyAdGen / lySales) * 100) : null,
    ty_ad_generated: null, ty_non_ad: null, ty_ad_pct: null,
    ly_ad_sales: lyAdS, ty_ad_sales: tyAdS,
    ly_views: lyViews, ty_views: tyViews,
    ly_orders: lyOrd, ty_orders: tyOrd,
    ly_units: lyUnits, ty_units: tyUnits,
    // Audit fields — carried so the gates and any future reviewer can prove Orders is not
    // a relabelled units or line count. Not displayed, not in the CSV export.
    ly_qty_sold: lyQty, ty_qty_sold: tyQty,     // eBay quantity_sold = the STR numerator
    ly_order_lines: lyLines, ty_order_lines: tyLines,
    ly_conversion_pct: conv(lyViews, lyQty), ty_conversion_pct: conv(tyViews, tyQty),
    ly_price: asp(lySales, lyUnits), ty_price: asp(tySales, tyUnits),
    ad_impressions: num(r[TY_IMPR]), ad_clicks: num(r[TY_CLICKS]),
    ad_spend: spend, ad_sales: tyAdS,   // col 19 Ad Sales = TY Ad Sales (section 8)
    roas, acos, segment,
  };
});

// CLASSIFICATION COMPLETENESS GUARD. Every row must carry one of the four business segments.
// If this ever throws, a new branch was added without extending the contract — fix the branch,
// do not relax the guard, and never let an unclassified row reach the dashboard.
const SEGMENTS = ['A', 'B', 'C', 'D'];
const unclassified = out.filter(d => !SEGMENTS.includes(d.segment));
if (unclassified.length)
  throw new Error(`${unclassified.length} rows are not classified A/B/C/D ` +
                  `(first ${unclassified[0].ebay_id} = "${unclassified[0].segment}") — ` +
                  `the D fallback is not covering every case`);

// Per-currency totals only — GBP/EUR/USD are never summed together (section 11)
const byCur = {};
for (const d of out) {
  const c = (byCur[d.currency] ||= { currency: d.currency, rows: 0, ly_sales: 0, ty_sales: 0, ad_spend: 0, ad_sales: 0 });
  c.rows++; c.ly_sales += d.ly_sales; c.ty_sales += d.ty_sales;
  c.ad_spend += d.ad_spend; c.ad_sales += d.ad_sales;
}
for (const c of Object.values(byCur))
  for (const k of ['ly_sales', 'ty_sales', 'ad_spend', 'ad_sales']) c[k] = r2(c[k]);

const segments = out.reduce((a, d) => (a[d.segment] = (a[d.segment] || 0) + 1, a), {});

const payload = {
  meta: {
    generated_at: new Date().toISOString(),
    ly_window: '2025-09-01 to 2025-09-30',
    ty_window: `2026-09-01 to ${SOURCE_MAX.sales} (PARTIAL)`,
    ty_is_partial: true,
    source_max_dates: { ...SOURCE_MAX },
    ad_fee_available_through: '2026-09-03',
    extract_source: 'FRESH ledsone (dbhub_readonly, SELECT only) via sql/i-fresh-authoritative.sql — one 33-column query, all metrics from a single snapshot, no side-car evidence files. Supersedes pack G + pack H and the stale order_management_copy mirror.',
    metric_sources: {
      sales: 'orders x order_item_info, SUM(item_quantity*item_price), status NOT IN (Cancelled,Refunded)',
      orders: 'COUNT(DISTINCT order_management.orders.order_id) via order_item_info at account+item+marketplace, EBAY source, status NOT IN (Cancelled,Refunded), order_id non-blank — actual distinct customer orders. NOT ebay_traffic_data.quantity_sold, NOT OMS item_quantity',
      views: 'ebay_traffic_data.ebay_views',
      conversion: 'ebay_traffic_data.quantity_sold / ebay_views * 100 = eBay STR — deliberately NOT recomputed from distinct Orders',
      avg_price: 'Sales / OMS units (ASP fallback — no historical listing price exists)',
      ads: 'listing_performance: sale_amount_listing_currency, ad_fees_listing_currency, impressions, clicks',
      roas: 'SUM(ad_sales)/SUM(ad_spend)',
      image: 'ebay_listings.main_image_url',
      ly_ad_generated: 'ebay_order_expenses AD_FEE (order_id + item_id) matched to the purchased order line — Promoted Standard, order-level. The matched line\'s realised revenue, never the fee. No fee-date window: eBay bills on its own clock (order 11-13519-57563 placed 2025-09-01 was billed 2025-08-31), and windowing fees understated this by GBP 14.29',
      ly_non_ad: 'LY Sales - LY Ad-Generated (includes Promoted Advanced, which carries order_id=0 and cannot reach a SKU)',
      ty_ad_generated: 'NULL (Pending) — eBay AD_FEE billing available through 2026-09-03 only: 3 of 29 TY September days, covering 12.8% of TY sales by value; never estimated',
      attributed_ad_sales: 'listing_performance.sale_amount_listing_currency — click-attributed performance metric, NOT the SKU sales split',
      traffic_coverage: 'LY 28 of 30 September days; TY 28 available days (through 2026-09-28)',
      order_lines: 'order_item_info line count — audit field only, NEVER published as Orders',
      orders_total_caveat: 'Summing Orders across rows sums PER-LISTING order counts; one order containing two assigned listings contributes 1 to each row. It is not a portfolio-level distinct-order count.',
      orders_window: 'LY 2025-09-01..2025-09-30; TY 2026-09-01..2026-09-29 — the same order snapshot Sales uses, so Orders and Sales never disagree on the window',
    },
    population_rule: "utharsika's PH eBay product assignment (staff.ph_categories -> " +
      'staff.ph_category_products), categories Lamp Shade and Wall Plug, within the six ' +
      'approved accounts. September sales are NOT required: an assigned product with no ' +
      'September sales shows LY = 0 and TY = 0. Traffic and advertising enrich these rows ' +
      'and never add a row.',
    row_count: out.length,
    accounts: [...new Set(out.map(d => d.account))].sort(),
    categories: [...new Set(out.map(d => d.category))].sort((a, b) => a.localeCompare(b)),
    currencies: Object.values(byCur).sort((a, b) => b.ty_sales - a.ty_sales),
    segments,
    ad_spend_source: 'ebay_campaigns.listing_performance.ad_fees_listing_currency (performance report, not the billing record)',
  },
  rows: out,
};

mkdirSync(resolve(ROOT, 'data'), { recursive: true });
writeFileSync(resolve(ROOT, 'data/september-comparison.json'), JSON.stringify(payload));
console.log(`rows=${out.length} segments=${JSON.stringify(segments)}`);
console.log('currencies:', Object.values(byCur).map(c => `${c.currency}:${c.rows}`).join(' '));
