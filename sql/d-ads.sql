-- Pack D: Ad performance. Grain: acct + item_id + marketplace + period
-- MUST aggregate before joining, or campaign fan-out multiplies spend.
-- attributed_sales / sold are COUNTS - never used as money.
-- campaign_performance is never unioned or compared against this table.
-- Ad Spend source decision: ad_fees_listing_currency (see analysis-v1-decisions.md section 9)
SELECT c.sub_source AS acct_id,
       lp.ebay_listing_id::text AS item_id,
       REPLACE(c.marketplace_id,'EBAY_','') AS mk,
       CASE WHEN lp.date >= DATE '2026-09-01' THEN 'TY' ELSE 'LY' END AS period,
       SUM(lp.sale_amount_listing_currency) AS ad_sales,
       SUM(lp.ad_fees_listing_currency)     AS ad_spend,
       SUM(lp.impressions)                  AS ad_impressions,
       SUM(lp.clicks)                       AS ad_clicks
FROM ebay_campaigns.listing_performance lp
JOIN ebay_campaigns.campaigns c ON c.campaign_id = lp.campaign_id
WHERE (lp.date >= DATE '2025-09-01' AND lp.date < DATE '2025-10-01')
   OR (lp.date >= DATE '2026-09-01' AND lp.date < DATE '2026-10-01')
GROUP BY 1,2,3,4;
