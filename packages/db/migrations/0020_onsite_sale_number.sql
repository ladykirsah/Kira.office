-- Onsite POS sales get a human sales number: DASyyyymm-ddnnn (e.g. DAS202607-01001), where nnn is
-- the Nth sale of that day and resets each day. New sales are minted on the POS device at checkout
-- (so the number prints on the offline receipt) and synced as onsite_sales.sale_number. This
-- backfills every existing sale by date order, then adds a unique index so the number is a real,
-- collision-free identifier. Day buckets use Bangkok local time (+7), matching the app's date logic.

UPDATE onsite_sales
SET sale_number = num.value
FROM (
  SELECT
    id,
    'DAS'
      || strftime('%Y%m', datetime(created_at / 1000, 'unixepoch', '+7 hours'))
      || '-'
      || strftime('%d', datetime(created_at / 1000, 'unixepoch', '+7 hours'))
      || printf('%03d',
           row_number() OVER (
             PARTITION BY strftime('%Y-%m-%d', datetime(created_at / 1000, 'unixepoch', '+7 hours'))
             ORDER BY created_at, id
           )
         ) AS value
  FROM onsite_sales
  WHERE sale_number IS NULL
) AS num
WHERE onsite_sales.id = num.id;

CREATE UNIQUE INDEX IF NOT EXISTS onsite_sale_number_uq
  ON onsite_sales (sale_number)
  WHERE sale_number IS NOT NULL;
