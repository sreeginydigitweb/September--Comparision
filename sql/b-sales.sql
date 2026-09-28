-- Pack B: Sales + units. Grain: acct + item_id + marketplace + period
-- Revenue formula (R): business/queries/ph-sales-by-channel.md
--   CAST(item_quantity AS INT) * CAST(item_price AS DECIMAL(10,2))
-- Guard (R): source_id = 2 is MANDATORY - order_item_info.item_id also holds Shopify product ids
SELECT o.sub_source_id AS acct_id,
       oii.item_id     AS item_id,
       CASE WHEN mp.abbreviation = 'UK' THEN 'GB' ELSE mp.abbreviation END AS mk,
       CASE WHEN o.order_date >= DATE '2026-09-01' THEN 'TY' ELSE 'LY' END AS period,
       SUM(CAST(NULLIF(oii.item_quantity,'') AS INT)
         * CAST(NULLIF(oii.item_price,'')    AS DECIMAL(12,2))) AS sales,
       SUM(CAST(NULLIF(oii.item_quantity,'') AS INT))           AS units
FROM order_management.orders o
JOIN order_management.order_item_info oii ON oii.order_id = o.id
JOIN order_management.sub_source ss       ON ss.id = o.sub_source_id
JOIN order_management.source s            ON s.id = ss.source_id AND s.source_name = 'EBAY'
LEFT JOIN order_management.market_place mp ON mp.id = NULLIF(o.market_place,'')::int
WHERE ( (o.order_date >= DATE '2025-09-01' AND o.order_date < DATE '2025-10-01')
     OR (o.order_date >= DATE '2026-09-01' AND o.order_date < DATE '2026-10-01') )
  AND oii.item_id IS NOT NULL AND oii.item_id <> ''
GROUP BY 1,2,3,4;
