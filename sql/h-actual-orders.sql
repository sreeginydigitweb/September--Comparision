-- Pack H (2026-09-30) -- ACTUAL ORDERS. Distinct customer orders, not units.
--
-- WHY THIS PACK EXISTS
-- LY/TY Orders were previously business_reports.ebay_traffic_data.quantity_sold. That column
-- is eBay-reported UNITS SOLD (traffic-side quantity), so one customer order buying 3 units
-- counted as 3 "Orders". The business reads the Orders column as distinct customer orders,
-- so it must be COUNT(DISTINCT order_id).
--
-- DEFINITION
--   Orders = COUNT(DISTINCT o.order_id) over order_management.orders x order_item_info,
--            grouped to the dashboard grain, eBay source only.
--   Valid order_id: NOT NULL and not blank. Verified 2026-09-30 on the fresh `ledsone` DB:
--   across both September windows order_id is 1:1 with orders.id (13,018 rows, 13,018
--   distinct order_id, 0 blank, 0 '0'), so the DISTINCT hides no de-duplication artefact.
--   Excluded statuses: 'Cancelled', 'Refunded' -- the same filter Sales already uses, so
--   Orders and Sales agree on what a realised order is.
--   item_quantity is NEVER summed here. quantity_sold is NEVER read here.
--
-- GRAIN: acct_id (orders.sub_source_id) + item_id + marketplace, identical to pack G, so the
-- result LEFT JOINs onto the pack G population without adding, dropping or splitting a row.
--
-- WINDOWS -- deliberately the pack G snapshot's own windows, so this fix moves ONLY the
-- Orders columns and leaves Sales / Views / Ads on their verified values:
--   LY  2025-09-01 00:00:00 .. 2025-09-30 23:59:59   (full month)
--   TY  2026-09-01 00:00:00 .. 2026-09-29 10:27:17   (the pack G order snapshot instant)
--
-- Why the TY bound is a TIMESTAMP and not a date. The pack G extract in
-- evidence/extract-2026-09-29-fresh/ was taken part-way through 2026-09-29: it contains the
-- three assigned-item orders placed at 00:36, 09:11 and 10:20 that day (GBP 51.67) but not
-- the one placed at 11:59 (order 24-15218-31602, item 266004810103, GBP 27.78). Counting
-- orders to end-of-day would publish Orders = 1 against Sales = 0.00 on that row. This exact
-- bound is PROVEN, not assumed: recomputing LY/TY Sales and LY/TY OMS units from raw orders
-- with it reproduces the pack G snapshot on all 186 rows with zero differences
-- (build/validate.mjs gate 40 re-checks the resulting Orders against this file).
--
-- When the dataset is next rebuilt on a newer order snapshot, move the pack G sales window
-- and this TY bound TOGETHER to that snapshot's instant -- never one without the other.
--
-- CONTROL: eBay ID 164525233292 (Ledsone, sub_source 1, GB), September 2025
--   66 order lines -> 62 distinct order_id -> LY Orders = 62.
--   (quantity_sold said 83; OMS item_quantity said 94. Both are units, not orders.)
--
-- SOURCE: fresh `ledsone` @ 169.58.91.229:5432, dbhub_readonly, SELECT only.
-- Emits one row, one column `payload`: JSON array of
--   [acct_id, item_id, marketplace, ly_orders, ty_orders].

WITH assign AS (
  SELECT pcp.ref_id::text AS item_id
  FROM staff.ph_categories pc
  JOIN staff.ph_category_products pcp ON pcp.ph_category_id = pc.id
  WHERE pc.user_id = 109 AND pcp.source_id = 2
  GROUP BY 1
),
-- One row per (grain, order_id) FIRST, so an order carrying several lines of the same item
-- collapses to a single order before it is ever counted.
order_grain AS (
  SELECT DISTINCT
         o.sub_source_id AS acct_id,
         oii.item_id,
         CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
         o.order_id,
         CASE WHEN o.order_date < DATE '2026-01-01' THEN 'LY' ELSE 'TY' END AS yr
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  JOIN order_management.sub_source ss        ON ss.id = o.sub_source_id
  JOIN order_management.source s             ON s.id = ss.source_id AND s.source_name = 'EBAY'
  JOIN assign a                              ON a.item_id = oii.item_id
  LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
  WHERE ( (o.order_date >= DATE '2025-09-01' AND o.order_date <  DATE '2025-10-01')
       OR (o.order_date >= DATE '2026-09-01' AND o.order_date <  TIMESTAMP '2026-09-29 10:27:17') )
    AND o.status NOT IN ('Cancelled','Refunded')
    AND o.order_id IS NOT NULL AND TRIM(o.order_id) <> ''
    AND o.sub_source_id IN (1,4,22,27,28)
    AND oii.item_id IS NOT NULL AND oii.item_id <> ''
)
SELECT json_agg(json_build_array(acct_id, item_id, mk, ly_orders, ty_orders)
                ORDER BY acct_id, item_id, mk)::text AS payload
FROM (
  SELECT acct_id, item_id, mk,
         COUNT(*) FILTER (WHERE yr = 'LY') AS ly_orders,
         COUNT(*) FILTER (WHERE yr = 'TY') AS ty_orders
  FROM order_grain
  GROUP BY 1,2,3
) g;
