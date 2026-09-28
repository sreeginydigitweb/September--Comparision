// build.mjs — merge extraction -> data/september-comparison.json
// Implements documentation/analysis-v1-decisions.md. Zero dependencies.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv[2];
if (!RAW) { console.error('usage: node build/build.mjs <extract.txt>'); process.exit(1); }

// Column order of the extracted arrays (see sql/ packs + the combined pack F query)
const [ACCT_ID, ACCT, ITEM, MK, CUR, SKU_N, SKU1, PSKU, TITLE,
       LY_SALES, TY_SALES, LY_UNITS, TY_UNITS, LY_VIEWS, TY_VIEWS,
       LY_ADS, TY_ADS, TY_SPEND, TY_IMPR, TY_CLICKS, LAST7, PREV7] = [...Array(22).keys()];

const wrapper = JSON.parse(readFileSync(RAW, 'utf8'));
const rows = JSON.parse(wrapper.data.rows[0].payload);

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2  = n => Math.round(n * 100) / 100;

// Segment B: recovery windows are anchored on the latest available TY order date (2026-09-28).
// Windows: last 7 = 22-28 Sep, preceding 7 = 15-21 Sep. The TY span is 28 days, so the
// ">= 14 usable TY days" condition is satisfied at window level; a listing with no TY
// activity scores 0 > 0 = false and is therefore never classified B.
const TY_SPAN_DAYS = 28;
const B_ELIGIBLE = TY_SPAN_DAYS >= 14;

const out = rows.map(r => {
  const lySales = r2(num(r[LY_SALES])), tySales = r2(num(r[TY_SALES]));
  const lyUnits = num(r[LY_UNITS]),     tyUnits = num(r[TY_UNITS]);
  const lyViews = num(r[LY_VIEWS]),     tyViews = num(r[TY_VIEWS]);
  const lyAdS   = r2(num(r[LY_ADS])),   tyAdS   = r2(num(r[TY_ADS]));
  const spend   = r2(num(r[TY_SPEND]));
  const last7   = num(r[LAST7]),        prev7   = num(r[PREV7]);

  // YoY %  (analysis section 3)
  let yoy = null, yoyLabel;
  if (lySales > 0) { yoy = r2(((tySales - lySales) / lySales) * 100); yoyLabel = null; }
  else if (tySales > 0) { yoyLabel = 'NEW'; }
  else { yoyLabel = 'N/A'; }

  // Conversion % = Orders / Views * 100, Orders = units (sections 5, 6)
  const conv = (v, u) => v > 0 ? r2((u / v) * 100) : null;
  // Price = realised ASP = Sales / Units (section 7)
  const asp  = (s, u) => u > 0 ? r2(s / u) : null;

  // ROAS / ACoS computed from cols 18-19 so the ratio always matches them (section 10)
  const roas = spend > 0 ? r2(tyAdS / spend) : null;
  const acos = tyAdS > 0 ? r2((spend / tyAdS) * 100) : null;

  // Segment — strict V1 precedence D -> C -> B -> A -> Other (section 12)
  let segment;
  if (lySales > 0 && tySales === 0)                                    segment = 'D';
  else if (lyAdS > 0 && tyAdS === 0)                                   segment = 'C';
  else if (B_ELIGIBLE && tySales < lySales && last7 > prev7)           segment = 'B';
  else if (tySales > lySales)                                          segment = 'A';
  else                                                                 segment = 'Other';

  const skuCount = num(r[SKU_N]);
  const sku = skuCount === 1 ? (r[SKU1] || '—')
            : skuCount > 1   ? `${r[PSKU] || r[SKU1] || '—'} (${skuCount} variations)`
            : '—';

  return {
    account: r[ACCT] || `#${r[ACCT_ID]}`, account_id: r[ACCT_ID],
    marketplace: r[MK] || '—', currency: r[CUR],
    ebay_id: r[ITEM], sku, sku_count: skuCount, title: r[TITLE] || '',
    ly_sales: lySales, ty_sales: tySales, yoy_pct: yoy, yoy_label: yoyLabel,
    ly_ad_sales: lyAdS, ty_ad_sales: tyAdS,
    ly_views: lyViews, ty_views: tyViews,
    ly_orders: lyUnits, ty_orders: tyUnits,
    ly_conversion_pct: conv(lyViews, lyUnits), ty_conversion_pct: conv(tyViews, tyUnits),
    ly_price: asp(lySales, lyUnits), ty_price: asp(tySales, tyUnits),
    ad_impressions: num(r[TY_IMPR]), ad_clicks: num(r[TY_CLICKS]),
    ad_spend: spend, ad_sales: tyAdS,   // col 19 Ad Sales = TY Ad Sales (section 8)
    roas, acos, segment,
  };
});

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
    ty_window: '2026-09-01 to 2026-09-30 (PARTIAL)',
    ty_is_partial: true,
    source_max_dates: { sales: '2026-09-28', ads: '2026-09-28', traffic: '2026-09-26' },
    row_count: out.length,
    accounts: [...new Set(out.map(d => d.account))].sort(),
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
