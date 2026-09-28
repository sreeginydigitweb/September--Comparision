-- Pack C: Traffic. Grain: acct + item_id + marketplace + period
-- Views = SUM(ebay_views). external_views deliberately NOT added (no verified rule defines it that way).
-- Verified: exactly one row per item_id + sub_source + site_code + date, so no dedup needed.
SELECT t.sub_source AS acct_id,
       t.item_id    AS item_id,
       REPLACE(t.site_code,'EBAY-','') AS mk,
       CASE WHEN t.date >= DATE '2026-09-01' THEN 'TY' ELSE 'LY' END AS period,
       SUM(t.ebay_views) AS views
FROM business_reports.ebay_traffic_data t
WHERE (t.date >= DATE '2025-09-01' AND t.date < DATE '2025-10-01')
   OR (t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01')
GROUP BY 1,2,3,4;
