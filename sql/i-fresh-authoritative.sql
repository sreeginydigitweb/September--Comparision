-- Pack I (2026-09-30, FINAL RAW AUDIT) -- 33-column authoritative extract.
--
-- Supersedes pack G (sql/g-fresh-ledsone-utharsika.sql) and pack H (sql/h-actual-orders.sql).
-- Every published metric is derived here, in ONE query against the fresh `ledsone` DB, so all
-- metrics share a single snapshot instant and no side-car evidence file can drift out of step.
-- SELECT ONLY (dbhub_readonly).
--
-- WHAT CHANGED VS PACK G + H
--   * LY/TY Orders = COUNT(DISTINCT orders.order_id) -- actual distinct customer orders.
--     quantity_sold and item_quantity are NEVER Orders. Order-LINE count is never Orders.
--   * quantity_sold moved to cols 28/29, feeding CONVERSION ONLY (eBay STR).
--   * LY Ad-Generated (AD_FEE order-level attribution) computed here, col 30 -- it used to
--     live in evidence/.../ly-sku-ad-split.json, which could silently disagree with a rebuild.
--   * Order LINE counts exposed (cols 31/32) so "lines vs orders" is auditable on the row.
--
-- POPULATION: utharsika's PH product assignment, NOT "products that sold".
--   staff.ph_categories (user_id 109) -> staff.ph_category_products (source_id 2 = EBAY)
--   id 66 'Lampshade' -> Lamp Shade, id 67 'Wall plug' -> Wall Plug; assigned to both -> Wall Plug.
--   Assigned products with zero September sales REMAIN VISIBLE (LY 0 / TY 0). No Bulbs,
--   Transformers or Drivers are reachable: the two category ids are the only entry point.
--
-- GRAIN: acct_id + item_id + marketplace. Every CTE is aggregated to that grain BEFORE it is
-- joined, so campaign/line fan-out cannot multiply any figure. No cross-account aggregation.
--
-- ACCOUNTS: the six approved groups only. listings.ebay_listings.site is spelled
-- 'UK'/'Germany' (NOT 'GB'/'DE') -- mapped here. 'ledsone uk de' = sub_source 1 on Germany.
--
-- WINDOWS: LY 2025-09-01 .. 2025-09-30. TY 2026-09-01 .. 2026-09-30 (calendar month).
-- Each source's own coverage inside that window is reported in meta.source_max_dates:
--   orders 2026-09-30 · traffic 2026-09-28 · listing_performance 2026-09-30 · AD_FEE 2026-09-03.
--
-- CONTROL (verified from raw before this query was written):
--   164525233292 Sept 2025 -> 66 order lines, 62 distinct orders, 94 units, GBP 1,210.05.
--
-- Emits one row, one column `payload`: a JSON array of 33-element arrays.

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
-- ===========================================================================
-- ONE valid-order population, used by Sales, Units, Orders and Lines alike, so those four
-- can never disagree about which orders are real. Cancelled and Refunded excluded on BOTH
-- sides of the comparison; order_id must be present.
-- ===========================================================================
ord_lines AS (
  SELECT o.sub_source_id AS acct_id,
         oii.item_id,
         CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
         o.order_id,
         o.order_date,
         CASE WHEN o.order_date < DATE '2026-01-01' THEN 'LY' ELSE 'TY' END AS yr,
         CAST(NULLIF(oii.item_quantity,'') AS INT)                            AS qty,
         CAST(NULLIF(oii.item_quantity,'') AS INT)
           * CAST(NULLIF(oii.item_price,'') AS DECIMAL(12,2))                 AS rev
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  JOIN order_management.sub_source ss        ON ss.id = o.sub_source_id
  JOIN order_management.source s             ON s.id = ss.source_id AND s.source_name = 'EBAY'
  -- Restricted to assigned items and the six accounts up front. This changes no published
  -- figure (pop only ever contains assigned items, so the LEFT JOINs would discard the rest
  -- anyway) but keeps this CTE small enough for the AD_FEE semi-join below to stay cheap.
  JOIN assign asg                            ON asg.item_id = oii.item_id
  LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
  WHERE ( (o.order_date >= DATE '2025-09-01' AND o.order_date < DATE '2025-10-01')
       OR (o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01') )
    AND o.status NOT IN ('Cancelled','Refunded')
    AND o.sub_source_id IN (1,4,22,27,28)
    AND o.order_id IS NOT NULL AND TRIM(o.order_id) <> ''
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
),
-- Sales = realised revenue of the purchased item. Units = OMS item_quantity (ASP denominator
-- and audit only -- never published as Orders). Lines = order-line count (audit only).
sales AS (
  SELECT acct_id, item_id, mk,
         SUM(rev) FILTER (WHERE yr='LY') AS ly_sales,
         SUM(rev) FILTER (WHERE yr='TY') AS ty_sales,
         SUM(qty) FILTER (WHERE yr='LY') AS ly_units,
         SUM(qty) FILTER (WHERE yr='TY') AS ty_units,
         COUNT(*) FILTER (WHERE yr='LY') AS ly_lines,
         COUNT(*) FILTER (WHERE yr='TY') AS ty_lines
  FROM ord_lines GROUP BY 1,2,3
),
-- ORDERS. DISTINCT (grain, order_id) first, so an order carrying several lines of the same
-- item collapses to ONE order before it is ever counted.
ord_distinct AS (
  SELECT DISTINCT acct_id, item_id, mk, order_id, yr FROM ord_lines
),
orders_agg AS (
  SELECT acct_id, item_id, mk,
         COUNT(*) FILTER (WHERE yr='LY') AS ly_orders,
         COUNT(*) FILTER (WHERE yr='TY') AS ty_orders
  FROM ord_distinct GROUP BY 1,2,3
),
-- Segment B recovery windows, anchored on the latest available TY order date.
daily AS (
  SELECT acct_id, item_id, mk,
         SUM(rev) FILTER (WHERE order_date::date >  (SELECT d FROM ty_anchor) - 7)  AS last7,
         SUM(rev) FILTER (WHERE order_date::date >  (SELECT d FROM ty_anchor) - 14
                            AND order_date::date <= (SELECT d FROM ty_anchor) - 7)  AS prev7
  FROM ord_lines WHERE yr = 'TY' GROUP BY 1,2,3
),
-- LY AD-GENERATED. Promoted STANDARD only: AD_FEE carries a real order_id + item_id, which is
-- what proves attribution at purchased-SKU level. The VALUE taken is the matched order line's
-- realised revenue, never the fee amount. Promoted ADVANCED (PREMIUM_AD_FEES) has order_id='0'
-- and cannot reach a SKU, so Advanced-driven revenue necessarily sits in Non-Ad-Attributed.
-- NOTE ON THE FEE DATE -- there is deliberately NO transaction_date filter here.
-- The (order_id, item_id) pair is what proves attribution, and the join to ord_lines already
-- scopes the period to September orders. eBay bills AD_FEE on its own clock, which can fall
-- OUTSIDE the sales month: order 11-13519-57563 was placed 2025-09-01 but its AD_FEE was
-- billed 2025-08-31. Filtering fees to September 2025 silently dropped that order and
-- understated LY Ad-Generated by GBP 14.29 on item 164043595851 (231.98 instead of 246.27).
-- Checked across the whole order population: 0 rows where ad-generated exceeds the item's
-- own realised sales, so removing the window cannot over-attribute.
-- Bounded by a semi-join to the LY order population rather than by a fee date: this keeps the
-- scan small without reintroducing the date filter that dropped the 2025-08-31 fee.
adfee_ly AS (
  SELECT DISTINCT oe.order_id, oe.item_id::text AS item_id
  FROM accounting.ebay_order_expenses oe
  WHERE oe.fee_type = 'AD_FEE'
    AND oe.order_id IS NOT NULL AND oe.order_id <> '0'
    AND EXISTS (SELECT 1 FROM ord_lines ol
                WHERE ol.order_id = oe.order_id AND ol.yr = 'LY')
),
ly_adgen AS (
  SELECT ol.acct_id, ol.item_id, ol.mk, SUM(ol.rev) AS ly_ad_generated
  FROM ord_lines ol
  JOIN adfee_ly af ON af.order_id = ol.order_id AND af.item_id = ol.item_id
  WHERE ol.yr = 'LY'
  GROUP BY 1,2,3
),
-- Views = ebay_views only (external_views deliberately excluded).
-- quantity_sold is captured for CONVERSION (eBay STR) and for audit -- NOT as Orders.
traffic AS (
  SELECT t.sub_source AS acct_id, t.item_id,
         REPLACE(t.site_code,'EBAY-','') AS mk,
         SUM(t.ebay_views)    FILTER (WHERE t.date < DATE '2026-01-01') AS ly_views,
         SUM(t.ebay_views)    FILTER (WHERE t.date >= DATE '2026-09-01') AS ty_views,
         SUM(t.quantity_sold) FILTER (WHERE t.date < DATE '2026-01-01') AS ly_qty_sold,
         SUM(t.quantity_sold) FILTER (WHERE t.date >= DATE '2026-09-01') AS ty_qty_sold
  FROM business_reports.ebay_traffic_data t
  WHERE (t.date >= DATE '2025-09-01' AND t.date < DATE '2025-10-01')
     OR (t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01')
  GROUP BY 1,2,3
),
-- Advertising PERFORMANCE (click-attributed), aggregated before the join so campaign fan-out
-- cannot multiply spend. sale_amount_listing_currency is eBay ATTRIBUTED ad sales, credited to
-- the CLICKED listing -- it is never subtracted from Total Sales and can legitimately exceed
-- that listing's own sales.
ads AS (
  SELECT c.sub_source AS acct_id,
         lp.ebay_listing_id::text AS item_id,
         REPLACE(c.marketplace_id,'EBAY_','') AS mk,
         SUM(lp.sale_amount_listing_currency) FILTER (WHERE lp.date <  DATE '2026-01-01') AS ly_ad_sales,
         SUM(lp.sale_amount_listing_currency) FILTER (WHERE lp.date >= DATE '2026-09-01') AS ty_ad_sales,
         SUM(lp.ad_fees_listing_currency)     FILTER (WHERE lp.date >= DATE '2026-09-01') AS ty_spend,
         SUM(lp.impressions)                  FILTER (WHERE lp.date >= DATE '2026-09-01') AS ty_impr,
         SUM(lp.clicks)                       FILTER (WHERE lp.date >= DATE '2026-09-01') AS ty_clicks
  FROM ebay_campaigns.listing_performance lp
  JOIN ebay_campaigns.campaigns c ON c.campaign_id = lp.campaign_id
  WHERE (lp.date >= DATE '2025-09-01' AND lp.date < DATE '2025-10-01')
     OR (lp.date >= DATE '2026-09-01' AND lp.date < DATE '2026-10-01')
  GROUP BY 1,2,3
)
SELECT json_agg(json_build_array(
         p.acct_id, p.account, p.item_id, p.mk,                                    -- 0-3
         CASE p.mk WHEN 'GB' THEN 'GBP' WHEN 'US' THEN 'USD' ELSE 'EUR' END,       -- 4
         COALESCE(p.sku_count,0), p.one_sku, p.parent_sku, p.title,                -- 5-8
         ROUND(COALESCE(sl.ly_sales,0),2), ROUND(COALESCE(sl.ty_sales,0),2),       -- 9-10
         COALESCE(sl.ly_units,0), COALESCE(sl.ty_units,0),                         -- 11-12
         COALESCE(t.ly_views,0),  COALESCE(t.ty_views,0),                          -- 13-14
         ROUND(COALESCE(a.ly_ad_sales,0)::numeric,2),                              -- 15
         ROUND(COALESCE(a.ty_ad_sales,0)::numeric,2),                              -- 16
         ROUND(COALESCE(a.ty_spend,0)::numeric,2),                                 -- 17
         COALESCE(a.ty_impr,0), COALESCE(a.ty_clicks,0),                           -- 18-19
         ROUND(COALESCE(d.last7,0),2), ROUND(COALESCE(d.prev7,0),2),               -- 20-21
         p.one_sku, p.category, '',                                                -- 22-24
         COALESCE(og.ly_orders,0), COALESCE(og.ty_orders,0),                       -- 25-26 DISTINCT ORDERS
         COALESCE(p.image_url,''),                                                 -- 27
         COALESCE(t.ly_qty_sold,0), COALESCE(t.ty_qty_sold,0),                     -- 28-29 STR numerator
         ROUND(COALESCE(ag.ly_ad_generated,0),2),                                  -- 30
         COALESCE(sl.ly_lines,0), COALESCE(sl.ty_lines,0)                          -- 31-32 audit
       ) ORDER BY p.acct_id, p.item_id, p.mk)::text AS payload
FROM pop p
LEFT JOIN sales      sl ON sl.acct_id = p.acct_id AND sl.item_id = p.item_id AND sl.mk = p.mk
LEFT JOIN orders_agg og ON og.acct_id = p.acct_id AND og.item_id = p.item_id AND og.mk = p.mk
LEFT JOIN traffic    t  ON t.acct_id  = p.acct_id AND t.item_id  = p.item_id AND t.mk  = p.mk
LEFT JOIN ads        a  ON a.acct_id  = p.acct_id AND a.item_id  = p.item_id AND a.mk  = p.mk
LEFT JOIN daily      d  ON d.acct_id  = p.acct_id AND d.item_id  = p.item_id AND d.mk  = p.mk
LEFT JOIN ly_adgen   ag ON ag.acct_id = p.acct_id AND ag.item_id = p.item_id AND ag.mk = p.mk;
