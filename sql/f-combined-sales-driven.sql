-- Pack F (CORRECTED 2026-09-29): SALES-DRIVEN combined extract.
--
-- SCOPE CORRECTION. The V1 pack F was a FULL OUTER merge of identity/sales/traffic/ads,
-- so any eBay id that merely existed in listings, traffic or ads entered the dashboard
-- with zero sales. The senior's feedback ("athila ellarda ID m varuthu" — all the IDs are
-- turning up) rejects that population.
--
-- The base population is now built ONLY from September product sales:
--     COALESCE(ly_sales,0) > 0 OR COALESCE(ty_sales,0) > 0
-- Traffic, ads and listing identity are LEFT JOINed onto that population — they ENRICH a
-- sales-qualified row and can never introduce a row of their own.
--
-- ACCOUNT SCOPE (2026-09-29): only the six business reporting groups the senior reviews.
--   Sunsone        -> sub_source 4  (so_926407)
--   Ledsone        -> sub_source 1  (led_sone) EXCLUDING the DE marketplace
--   Electricalsone -> sub_source 22 (electricalsone)
--   Huttenlampen   -> sub_source 28 (huettenlampen)
--   ledsone uk de  -> sub_source 1  (led_sone) ON the DE marketplace only
--   ledsone de     -> sub_source 27 (ledsonede)
-- The DE split is a REPORTING group, not a database account: the estate holds only two
-- LEDSone sub_sources (1 and 27), proven by ebay_campaigns.seller_stores. 'DE' is the
-- verified order_management.market_place.abbreviation value.
--
-- Grain: acct_id + item_id + marketplace (unchanged, already validated).
-- Windows: LY 2025-09-01..2025-09-30, TY 2026-09-01..currently available (PARTIAL).
-- Sales formula (R): SUM(CAST(item_quantity AS INT) * CAST(item_price AS DECIMAL(10,2)))
-- Guard (R): source_name = 'EBAY' is mandatory — order_item_info.item_id also holds
--            Shopify product ids.
--
-- Emits one row, one column `payload`: a JSON array of 22-element arrays in the exact
-- column order build/build.mjs expects.

WITH ty_anchor AS (
  -- Segment B windows anchor on the latest available TY order date.
  SELECT MAX(o.order_date)::date AS d
  FROM order_management.orders o
  JOIN order_management.sub_source ss ON ss.id = o.sub_source_id
  JOIN order_management.source s      ON s.id = ss.source_id AND s.source_name = 'EBAY'
  WHERE o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01'
),
-- Pack B — September sales, both periods, at the final grain.
sales AS (
  SELECT o.sub_source_id AS acct_id,
         oii.item_id     AS item_id,
         CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
         SUM(CASE WHEN o.order_date <  DATE '2026-01-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS ly_sales,
         SUM(CASE WHEN o.order_date >= DATE '2026-09-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS ty_sales,
         SUM(CASE WHEN o.order_date <  DATE '2026-01-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT) ELSE 0 END)           AS ly_units,
         SUM(CASE WHEN o.order_date >= DATE '2026-09-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT) ELSE 0 END)           AS ty_units
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  JOIN order_management.sub_source ss       ON ss.id = o.sub_source_id
  JOIN order_management.source s            ON s.id = ss.source_id AND s.source_name = 'EBAY'
  LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
  WHERE ( (o.order_date >= DATE '2025-09-01' AND o.order_date < DATE '2025-10-01')
       OR (o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01') )
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
  GROUP BY 1,2,3
),
-- THE POPULATION RULE. Nothing outside this set can reach the dashboard.
pop AS (
  SELECT * FROM sales
  WHERE (COALESCE(ly_sales,0) > 0 OR COALESCE(ty_sales,0) > 0)
    AND acct_id IN (1, 4, 22, 27, 28)   -- the six approved business groups only
),
-- Pack B2 — TY daily sales, collapsed to the two 7-day recovery windows.
daily AS (
  SELECT o.sub_source_id AS acct_id,
         oii.item_id     AS item_id,
         CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
         SUM(CASE WHEN o.order_date::date > (SELECT d FROM ty_anchor) - 7
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS last7,
         SUM(CASE WHEN o.order_date::date > (SELECT d FROM ty_anchor) - 14
                   AND o.order_date::date <= (SELECT d FROM ty_anchor) - 7
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS prev7
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  JOIN order_management.sub_source ss       ON ss.id = o.sub_source_id
  JOIN order_management.source s            ON s.id = ss.source_id AND s.source_name = 'EBAY'
  LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
  WHERE o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01'
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
  GROUP BY 1,2,3
),
-- Pack A — identity. Grain acct + item_id (no marketplace), enrichment only.
ident AS (
  SELECT el.sub_source            AS acct_id,
         el.item_id               AS item_id,
         COUNT(DISTINCT el.sku)   AS sku_count,
         MIN(el.sku)              AS one_sku,
         MIN(el.parent_sku)       AS parent_sku,
         MIN(el.title)            AS title
  FROM listings.ebay_listings el
  WHERE el.all_list = 1
  GROUP BY 1,2
),
-- Pack C — traffic. Enrichment only.
traffic AS (
  SELECT t.sub_source                     AS acct_id,
         t.item_id                        AS item_id,
         REPLACE(t.site_code,'EBAY-','')  AS mk,
         SUM(CASE WHEN t.date <  DATE '2026-01-01' THEN t.ebay_views ELSE 0 END) AS ly_views,
         SUM(CASE WHEN t.date >= DATE '2026-09-01' THEN t.ebay_views ELSE 0 END) AS ty_views
  FROM business_reports.ebay_traffic_data t
  WHERE (t.date >= DATE '2025-09-01' AND t.date < DATE '2025-10-01')
     OR (t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01')
  GROUP BY 1,2,3
),
-- Pack D — ads. Aggregated BEFORE the join so campaign fan-out cannot multiply spend.
ads AS (
  SELECT c.sub_source                        AS acct_id,
         lp.ebay_listing_id::text            AS item_id,
         REPLACE(c.marketplace_id,'EBAY_','') AS mk,
         SUM(CASE WHEN lp.date <  DATE '2026-01-01' THEN lp.sale_amount_listing_currency ELSE 0 END) AS ly_ad_sales,
         SUM(CASE WHEN lp.date >= DATE '2026-09-01' THEN lp.sale_amount_listing_currency ELSE 0 END) AS ty_ad_sales,
         SUM(CASE WHEN lp.date >= DATE '2026-09-01' THEN lp.ad_fees_listing_currency     ELSE 0 END) AS ty_spend,
         SUM(CASE WHEN lp.date >= DATE '2026-09-01' THEN lp.impressions                  ELSE 0 END) AS ty_impr,
         SUM(CASE WHEN lp.date >= DATE '2026-09-01' THEN lp.clicks                       ELSE 0 END) AS ty_clicks
  FROM ebay_campaigns.listing_performance lp
  JOIN ebay_campaigns.campaigns c ON c.campaign_id = lp.campaign_id
  WHERE (lp.date >= DATE '2025-09-01' AND lp.date < DATE '2025-10-01')
     OR (lp.date >= DATE '2026-09-01' AND lp.date < DATE '2026-10-01')
  GROUP BY 1,2,3
)
SELECT json_agg(json_build_array(
         p.acct_id,
         CASE WHEN p.acct_id = 4  THEN 'Sunsone'
              WHEN p.acct_id = 1 AND p.mk = 'DE' THEN 'ledsone uk de'
              WHEN p.acct_id = 1  THEN 'Ledsone'
              WHEN p.acct_id = 22 THEN 'Electricalsone'
              WHEN p.acct_id = 28 THEN 'Huttenlampen'
              WHEN p.acct_id = 27 THEN 'ledsone de'
         END,
         p.item_id,
         p.mk,
         CASE p.mk WHEN 'GB' THEN 'GBP' WHEN 'US' THEN 'USD' ELSE 'EUR' END,
         COALESCE(i.sku_count, 0),
         i.one_sku,
         i.parent_sku,
         i.title,
         ROUND(COALESCE(p.ly_sales,0), 2),
         ROUND(COALESCE(p.ty_sales,0), 2),
         COALESCE(p.ly_units, 0),
         COALESCE(p.ty_units, 0),
         COALESCE(t.ly_views, 0),
         COALESCE(t.ty_views, 0),
         ROUND(COALESCE(a.ly_ad_sales,0)::numeric, 2),
         ROUND(COALESCE(a.ty_ad_sales,0)::numeric, 2),
         ROUND(COALESCE(a.ty_spend,0)::numeric, 2),
         COALESCE(a.ty_impr, 0),
         COALESCE(a.ty_clicks, 0),
         ROUND(COALESCE(d.last7,0), 2),
         ROUND(COALESCE(d.prev7,0), 2)
       ) ORDER BY p.acct_id, p.item_id, p.mk)::text AS payload
FROM pop p
JOIN      order_management.sub_source ss ON ss.id = p.acct_id
LEFT JOIN ident   i ON i.acct_id = p.acct_id AND i.item_id = p.item_id
LEFT JOIN traffic t ON t.acct_id = p.acct_id AND t.item_id = p.item_id AND t.mk = p.mk
LEFT JOIN ads     a ON a.acct_id = p.acct_id AND a.item_id = p.item_id AND a.mk = p.mk
LEFT JOIN daily   d ON d.acct_id = p.acct_id AND d.item_id = p.item_id AND d.mk = p.mk;
