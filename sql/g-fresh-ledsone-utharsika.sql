-- Pack G (2026-09-29, FRESH LEDSONE REBUILD) -- 28-column extract.
--
-- Supersedes sql/f-combined-sales-driven.sql as the authoritative extract. Authorised to
-- read the live `ledsone` database directly (SELECT only, dbhub_readonly), because the
-- postgres (2) mirror `order_management_copy` is stale for TY September 2026:
--     orders  2026-09-23 (mirror) vs 2026-09-29 (fresh, +6d)
--     traffic 2026-09-22          vs 2026-09-27          (+5d)
--     ppc     2026-09-16          vs 2026-09-29          (+13d)
--     AD_FEE  2026-09-02          vs 2026-09-03          (+1d, still materially incomplete)
--
-- POPULATION: utharsika's PH product assignment, NOT September sales.
--   staff.ph_categories (user_id 109) -> staff.ph_category_products (source_id 2 = EBAY)
--   id 66 'Lampshade' -> Lamp Shade, id 67 'Wall plug' -> Wall Plug.
--   An item assigned to both resolves to Wall Plug (cat_rank 2 wins).
--   Assigned products with zero September sales REMAIN VISIBLE (LY 0 / TY 0).
--
-- GRAIN: acct_id + item_id + marketplace. Proven safe: every assigned item's September
-- orders land on exactly the marketplace of its own listing site (0 mismatches, 0 orphans),
-- so the marketplace-keyed join drops no revenue and blends no accounts.
--
-- ACCOUNTS: the six approved reporting groups. listings.ebay_listings.site is spelled
-- 'UK'/'Germany' (NOT 'GB'/'DE') -- mapped here. 'ledsone uk de' = sub_source 1 on Germany.
--
-- Emits one row, one column `payload`: a JSON array of 28-element arrays in the exact
-- order build/build.mjs destructures.

WITH assign AS (
  SELECT pcp.ref_id::text AS item_id,
         MAX(CASE WHEN pc.id = 67 THEN 2 ELSE 1 END) AS cat_rank
  FROM staff.ph_categories pc
  JOIN staff.ph_category_products pcp ON pcp.ph_category_id = pc.id
  WHERE pc.user_id = 109 AND pcp.source_id = 2
  GROUP BY 1
),
pop AS (
  SELECT el.sub_source AS acct_id,
         el.item_id,
         CASE WHEN el.site = 'Germany' THEN 'DE'
              WHEN el.site = 'UK'      THEN 'GB' ELSE el.site END AS mk,
         CASE WHEN el.sub_source = 4  THEN 'Sunsone'
              WHEN el.sub_source = 1 AND el.site = 'Germany' THEN 'ledsone uk de'
              WHEN el.sub_source = 1  THEN 'Ledsone'
              WHEN el.sub_source = 22 THEN 'Electricalsone'
              WHEN el.sub_source = 28 THEN 'Huttenlampen'
              WHEN el.sub_source = 27 THEN 'ledsone de' END AS account,
         CASE WHEN a.cat_rank = 2 THEN 'Wall Plug' ELSE 'Lamp Shade' END AS category,
         COUNT(DISTINCT el.sku)  AS sku_count,
         MIN(el.sku)             AS one_sku,
         MIN(el.parent_sku)      AS parent_sku,
         MIN(el.title)           AS title,
         MIN(REPLACE(el.main_image_url,'http://','https://'))
           FILTER (WHERE el.main_image_url IS NOT NULL AND el.main_image_url <> '') AS image_url
  FROM listings.ebay_listings el
  JOIN assign a ON a.item_id = el.item_id
  WHERE el.all_list = 1 AND el.sub_source IN (1,4,22,27,28)
  GROUP BY 1,2,3,4,5
),
ty_anchor AS (
  SELECT MAX(o.order_date)::date AS d
  FROM order_management.orders o
  JOIN order_management.sub_source ss ON ss.id = o.sub_source_id
  JOIN order_management.source s      ON s.id = ss.source_id AND s.source_name = 'EBAY'
  WHERE o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01'
),
-- Realised revenue. Cancelled and Refunded are excluded on BOTH sides of the comparison.
sales AS (
  SELECT o.sub_source_id AS acct_id, oii.item_id,
         CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
         SUM(CASE WHEN o.order_date < DATE '2026-01-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS ly_sales,
         SUM(CASE WHEN o.order_date >= DATE '2026-09-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT)
                     * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2)) ELSE 0 END) AS ty_sales,
         SUM(CASE WHEN o.order_date < DATE '2026-01-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT) ELSE 0 END) AS ly_units,
         SUM(CASE WHEN o.order_date >= DATE '2026-09-01'
                  THEN CAST(NULLIF(oii.item_quantity,'') AS INT) ELSE 0 END) AS ty_units
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  JOIN order_management.sub_source ss       ON ss.id = o.sub_source_id
  JOIN order_management.source s            ON s.id = ss.source_id AND s.source_name = 'EBAY'
  LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
  WHERE ( (o.order_date >= DATE '2025-09-01' AND o.order_date < DATE '2025-10-01')
       OR (o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01') )
    AND o.status NOT IN ('Cancelled','Refunded')
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
  GROUP BY 1,2,3
),
daily AS (
  SELECT o.sub_source_id AS acct_id, oii.item_id,
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
    AND o.status NOT IN ('Cancelled','Refunded')
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
  GROUP BY 1,2,3
),
-- Views = ebay_views only (external_views deliberately excluded).
-- Orders = eBay-reported quantity_sold, never OMS units.
traffic AS (
  SELECT t.sub_source AS acct_id, t.item_id,
         REPLACE(t.site_code,'EBAY-','') AS mk,
         SUM(CASE WHEN t.date < DATE '2026-01-01'  THEN t.ebay_views    ELSE 0 END) AS ly_views,
         SUM(CASE WHEN t.date >= DATE '2026-09-01' THEN t.ebay_views    ELSE 0 END) AS ty_views,
         SUM(CASE WHEN t.date < DATE '2026-01-01'  THEN t.quantity_sold ELSE 0 END) AS ly_orders,
         SUM(CASE WHEN t.date >= DATE '2026-09-01' THEN t.quantity_sold ELSE 0 END) AS ty_orders
  FROM business_reports.ebay_traffic_data t
  WHERE (t.date >= DATE '2025-09-01' AND t.date < DATE '2025-10-01')
     OR (t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01')
  GROUP BY 1,2,3
),
-- Advertising PERFORMANCE (click-attributed). Aggregated before the join so campaign
-- fan-out cannot multiply spend. sale_amount_listing_currency is eBay ATTRIBUTED ad
-- sales -- it is never subtracted from Total Sales.
ads AS (
  SELECT c.sub_source AS acct_id,
         lp.ebay_listing_id::text AS item_id,
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
         p.acct_id, p.account, p.item_id, p.mk,
         CASE p.mk WHEN 'GB' THEN 'GBP' WHEN 'US' THEN 'USD' ELSE 'EUR' END,
         COALESCE(p.sku_count,0), p.one_sku, p.parent_sku, p.title,
         ROUND(COALESCE(sl.ly_sales,0),2), ROUND(COALESCE(sl.ty_sales,0),2),
         COALESCE(sl.ly_units,0), COALESCE(sl.ty_units,0),
         COALESCE(t.ly_views,0),  COALESCE(t.ty_views,0),
         ROUND(COALESCE(a.ly_ad_sales,0)::numeric,2), ROUND(COALESCE(a.ty_ad_sales,0)::numeric,2),
         ROUND(COALESCE(a.ty_spend,0)::numeric,2),
         COALESCE(a.ty_impr,0), COALESCE(a.ty_clicks,0),
         ROUND(COALESCE(d.last7,0),2), ROUND(COALESCE(d.prev7,0),2),
         p.one_sku, p.category, '',
         COALESCE(t.ly_orders,0), COALESCE(t.ty_orders,0),
         COALESCE(p.image_url,'')
       ) ORDER BY p.acct_id, p.item_id, p.mk)::text AS payload
FROM pop p
LEFT JOIN sales   sl ON sl.acct_id = p.acct_id AND sl.item_id = p.item_id AND sl.mk = p.mk
LEFT JOIN traffic t  ON t.acct_id  = p.acct_id AND t.item_id  = p.item_id AND t.mk  = p.mk
LEFT JOIN ads     a  ON a.acct_id  = p.acct_id AND a.item_id  = p.item_id AND a.mk  = p.mk
LEFT JOIN daily   d  ON d.acct_id  = p.acct_id AND d.item_id  = p.item_id AND d.mk  = p.mk;
