-- Pack E: Approved BILLING ad cost - REFERENCE ONLY, NOT joined into the dashboard.
-- Rule (R): business/rules/ebay-ppc-cost-sources.md names this as the P&L cost source.
-- NOT USED in V1 because it holds only ~3 days of TY September (settlement lag).
-- See analysis-v1-decisions.md section 9. Kept as the record of why.
-- Note: `fee` needs no dedup; `transaction_amount` would.
SELECT to_char(e.transaction_date,'YYYY-MM') AS ym,
       e.fee_type,
       COUNT(*) AS rows,
       COUNT(DISTINCT e.item_id) AS items,
       MAX(e.transaction_date)::text AS max_date,
       ROUND(SUM(e.fee),2) AS fee
FROM accounting.ebay_order_expenses e
WHERE e.fee_type IN ('AD_FEE','PREMIUM_AD_FEES')
  AND ( (e.transaction_date >= DATE '2025-09-01' AND e.transaction_date < DATE '2025-10-01')
     OR (e.transaction_date >= DATE '2026-09-01' AND e.transaction_date < DATE '2026-10-01') )
GROUP BY 1,2 ORDER BY 1,2;
