-- Pack A: Identity. Grain: sub_source + item_id
-- Rule (R): listings must be filtered all_list = 1 (business/rules/ebay-listing-sku-filter.md)
SELECT el.sub_source                                   AS acct_id,
       el.item_id                                      AS item_id,
       COUNT(DISTINCT el.sku)                          AS sku_count,
       MIN(el.sku)                                     AS one_sku,
       MIN(el.parent_sku)                              AS parent_sku,
       MIN(el.title)                                   AS title,
       BOOL_OR(el.is_ended = 1)                        AS is_ended
FROM listings.ebay_listings el
WHERE el.all_list = 1
GROUP BY el.sub_source, el.item_id;
