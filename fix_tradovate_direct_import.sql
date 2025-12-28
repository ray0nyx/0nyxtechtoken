-- DIRECT FIX FOR TRADOVATE DATES BY IMPORTING DIRECTLY FROM CSV FORMAT
-- This script uses the exact date format seen in the CSV file screenshot

-- First, backup the trades we'll be modifying
CREATE TABLE IF NOT EXISTS trades_backup_tradovate_direct_fix AS
SELECT * FROM trades WHERE platform = 'Tradovate';

-- Based on the CSV screenshot, create a temporary mapping table with the proper dates
CREATE TEMPORARY TABLE tradovate_date_fixes AS
WITH csv_data (symbol, boughtTimestamp, soldTimestamp) AS (
    VALUES 
    ('MNQH5', '02/03/2025 09:35:30', '02/03/2025 09:35:50'),
    ('MNQH5', '02/03/2025 10:23:30', '02/03/2025 10:23:50'),
    ('MNQH5', '02/03/2025 10:26:56', '02/03/2025 10:27:03'),
    ('MNQH5', '02/03/2025 10:28:45', '02/03/2025 10:29:06'),
    ('MNQH5', '02/03/2025 10:29:20', '02/03/2025 10:29:30'),
    ('MNQH5', '02/03/2025 10:30:06', '02/03/2025 10:30:12'),
    ('MNQH5', '02/03/2025 10:32:05', '02/03/2025 10:32:10'),
    ('MNQH5', '02/03/2025 10:33:45', '02/03/2025 10:33:51'),
    ('MNQH5', '02/04/2025 08:12:55', '02/04/2025 08:13:05'),
    ('MNQH5', '02/04/2025 09:41:00', '02/04/2025 09:41:10'),
    ('MNQH5', '02/04/2025 09:42:00', '02/04/2025 09:42:30'),
    ('MNQH5', '02/04/2025 09:42:00', '02/04/2025 09:42:18'),
    ('MNQH5', '02/06/2025 09:47:00', '02/06/2025 09:47:30'),
    ('MNQH5', '02/06/2025 09:48:00', '02/06/2025 09:48:22'),
    ('MNQH5', '02/07/2025 10:01:48', '02/07/2025 10:02:25'),
    ('MNQH5', '02/07/2025 10:02:48', '02/07/2025 10:03:07'),
    ('MNQH5', '02/10/2025 09:41:51', '02/10/2025 09:42:20'),
    ('MNQH5', '02/10/2025 09:44:48', '02/10/2025 09:45:10'),
    ('MNQH5', '02/11/2025 10:08:15', '02/11/2025 10:09:15'),
    ('MNQH5', '02/11/2025 10:09:15', '02/11/2025 10:09:27'),
    ('MNQH5', '02/12/2025 09:14:25', '02/12/2025 09:14:40'),
    ('MNQH5', '02/12/2025 09:39:19', '02/12/2025 09:39:51'),
    ('MNQH5', '02/13/2025 09:46:40', '02/13/2025 09:47:00'),
    ('MNQH5', '02/13/2025 09:48:20', '02/13/2025 09:49:00'),
    ('MNQH5', '02/13/2025 09:48:37', '02/13/2025 09:49:17'),
    ('MNQH5', '02/18/2025 09:45:40', '02/18/2025 09:46:40'),
    ('MNQH5', '02/18/2025 09:48:00', '02/18/2025 09:48:25'),
    ('MNQH5', '02/18/2025 09:54:00', '02/18/2025 09:54:31'),
    ('MNQH5', '02/18/2025 09:54:07', '02/18/2025 09:54:43'),
    ('MNQH5', '02/19/2025 09:48:16', '02/19/2025 09:48:52'),
    ('MNQH5', '02/19/2025 09:49:00', '02/19/2025 09:49:13'),
    ('MNQH5', '02/19/2025 09:49:20', '02/19/2025 09:49:40'),
    ('MNQH5', '02/19/2025 09:49:21', '02/19/2025 09:49:56'),
    ('MNQH5', '02/19/2025 09:54:34', '02/19/2025 09:54:51'),
    ('MNQH5', '02/20/2025 10:02:23', '02/20/2025 10:02:30'),
    ('MNQH5', '02/21/2025 08:46:00', '02/21/2025 08:46:40'),
    ('MNQH5', '02/21/2025 08:47:41', '02/21/2025 08:48:00'),
    ('MNQH5', '02/24/2025 09:33:42', '02/24/2025 09:34:00'),
    ('MNQH5', '02/24/2025 09:33:48', '02/24/2025 09:34:20'),
    ('MNQH5', '02/24/2025 09:33:54', '02/24/2025 09:34:30'),
    ('MNQH5', '02/25/2025 09:33:00', '02/25/2025 09:33:46'),
    ('MNQH5', '02/25/2025 09:39:11', '02/25/2025 09:40:00'),
    ('MNQH5', '02/25/2025 09:48:10', '02/25/2025 09:48:30'),
    ('MNQH5', '02/27/2025 09:20:55', '02/27/2025 09:21:18'),
    ('MNQH5', '02/27/2025 09:21:00', '02/27/2025 09:21:10'),
    ('MNQH5', '02/27/2025 09:21:00', '02/27/2025 09:21:25'),
    ('MNQH5', '02/28/2025 09:22:50', '02/28/2025 09:22:55'),
    ('MNQH5', '02/28/2025 09:22:58', '02/28/2025 09:23:36')
)
SELECT * FROM csv_data;

-- Now update the trades table with these exact dates
-- First match by symbol, then by row order (since we don't have a better matching key)
WITH ranked_csv AS (
    SELECT 
        symbol, 
        boughtTimestamp,
        soldTimestamp,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY boughtTimestamp) as csv_row_num
    FROM tradovate_date_fixes
),
ranked_trades AS (
    SELECT 
        id,
        symbol,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY created_at) as trade_row_num
    FROM trades
    WHERE platform = 'Tradovate'
)
UPDATE trades t
SET 
    "boughtTimestamp" = to_timestamp(c.boughtTimestamp, 'MM/DD/YYYY HH24:MI:SS'),
    "soldTimestamp" = to_timestamp(c.soldTimestamp, 'MM/DD/YYYY HH24:MI:SS')
FROM ranked_trades rt
JOIN ranked_csv c ON rt.symbol = c.symbol AND rt.trade_row_num = c.csv_row_num
WHERE t.id = rt.id;

-- Now update the entry_date and exit_date based on these timestamps
UPDATE trades
SET 
    entry_date = "boughtTimestamp",
    exit_date = "soldTimestamp",
    date = "boughtTimestamp"::DATE
WHERE 
    platform = 'Tradovate'
    AND "boughtTimestamp" IS NOT NULL
    AND "soldTimestamp" IS NOT NULL;

-- For any remaining trades without timestamps, try to extract them from extended_data
UPDATE trades t
SET 
    "boughtTimestamp" = to_timestamp(COALESCE(
        t.extended_data->>'boughtTimestamp',
        t.extended_data->'metadata'->>'boughtTimestamp',
        t.extended_data->'original'->>'boughtTimestamp'
    ), 'MM/DD/YYYY HH24:MI:SS'),
    "soldTimestamp" = to_timestamp(COALESCE(
        t.extended_data->>'soldTimestamp',
        t.extended_data->'metadata'->>'soldTimestamp',
        t.extended_data->'original'->>'soldTimestamp'
    ), 'MM/DD/YYYY HH24:MI:SS')
WHERE 
    t.platform = 'Tradovate'
    AND (t."boughtTimestamp" IS NULL OR t."soldTimestamp" IS NULL)
    AND t.extended_data IS NOT NULL;

-- Update entry_date and exit_date from any newly extracted timestamps
UPDATE trades
SET 
    entry_date = "boughtTimestamp",
    exit_date = "soldTimestamp",
    date = "boughtTimestamp"::DATE
WHERE 
    platform = 'Tradovate'
    AND "boughtTimestamp" IS NOT NULL
    AND "soldTimestamp" IS NOT NULL;

-- Verify the results of our fixes
SELECT 
    COUNT(*) as fixed_trades,
    MIN(entry_date) as earliest_entry,
    MAX(entry_date) as latest_entry,
    COUNT(CASE WHEN exit_date IS NULL THEN 1 END) as missing_exit_dates
FROM trades 
WHERE platform = 'Tradovate'; 