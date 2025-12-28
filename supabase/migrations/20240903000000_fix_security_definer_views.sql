-- Migration to fix security definer views
-- 20240903000000_fix_security_definer_views.sql

-- Fix security_definer_view for trade_pairs
DROP VIEW IF EXISTS public.trade_pairs CASCADE;

CREATE VIEW public.trade_pairs AS
WITH entry_trades AS (
    SELECT 
        trades."orderId",
        trades."Account",
        trades."B/S" AS direction,
        trades."Contract",
        trades."Product",
        trades."avgPrice",
        trades."filledQty",
        trades."Fill Time" AS fill_timestamp,
        trades."Text" AS trade_type,
        (trades.entry_date)::date AS trade_date
    FROM trades
    WHERE ((trades."Text" = ANY (ARRAY['multibracket'::text, 'Tradingview'::text])) OR (trades."Text" !~~ 'Exit%'::text))
    ORDER BY trades."Fill Time"
), exit_trades AS (
    SELECT 
        trades."orderId",
        trades."Account",
        trades."B/S" AS direction,
        trades."Contract",
        trades."Product",
        trades."avgPrice",
        trades."filledQty",
        trades."Fill Time" AS fill_timestamp,
        trades."Text" AS trade_type,
        (trades.entry_date)::date AS trade_date,
        lag(trades."orderId") OVER (PARTITION BY trades."Contract", trades."Product" ORDER BY trades."Fill Time") AS prev_order_id
    FROM trades
    WHERE (trades."Text" ~~ 'Exit%'::text)
    ORDER BY trades."Fill Time"
)
SELECT 
    e.trade_date,
    e."orderId" AS entry_order_id,
    x."orderId" AS exit_order_id,
    e."Contract",
    e."Product",
    e.direction AS entry_direction,
    x.direction AS exit_direction,
    (e."avgPrice")::numeric AS entry_price,
    (x."avgPrice")::numeric AS exit_price,
    e."filledQty" AS quantity,
    e.fill_timestamp AS entry_time,
    x.fill_timestamp AS exit_time,
    CASE
        WHEN (e.direction = 'Buy'::text) THEN ((((x."avgPrice")::numeric - (e."avgPrice")::numeric) * (e."filledQty")::numeric) * (
        CASE
            WHEN (e."Product" = 'MNQ'::text) THEN 2
            ELSE 1
        END)::numeric)
        WHEN (e.direction = 'Sell'::text) THEN ((((e."avgPrice")::numeric - (x."avgPrice")::numeric) * (e."filledQty")::numeric) * (
        CASE
            WHEN (e."Product" = 'MNQ'::text) THEN 2
            ELSE 1
        END)::numeric)
        ELSE (0)::numeric
    END AS trade_pnl,
    CASE
        WHEN (e.direction = 'Buy'::text) THEN (((((x."avgPrice")::numeric - (e."avgPrice")::numeric) * (e."filledQty")::numeric) * (
        CASE
            WHEN (e."Product" = 'MNQ'::text) THEN 2
            ELSE 1
        END)::numeric) - 2.50)
        WHEN (e.direction = 'Sell'::text) THEN (((((e."avgPrice")::numeric - (x."avgPrice")::numeric) * (e."filledQty")::numeric) * (
        CASE
            WHEN (e."Product" = 'MNQ'::text) THEN 2
            ELSE 1
        END)::numeric) - 2.50)
        ELSE (0)::numeric
    END AS trade_pnl_after_commission,
    (EXTRACT(epoch FROM (x.fill_timestamp - e.fill_timestamp)) / (60)::numeric) AS trade_duration_minutes
FROM (entry_trades e
    JOIN exit_trades x ON (((e."Contract" = x."Contract") AND (e."Product" = x."Product") AND (e."filledQty" = x."filledQty") AND (e.direction <> x.direction) AND (e.fill_timestamp < x.fill_timestamp) AND (NOT (EXISTS ( SELECT 1
        FROM exit_trades x2
        WHERE ((x2."Contract" = e."Contract") AND (x2."Product" = e."Product") AND (x2."filledQty" = e."filledQty") AND (x2.direction <> e.direction) AND (x2.fill_timestamp > e.fill_timestamp) AND (x2.fill_timestamp < x.fill_timestamp))))))))
ORDER BY e.fill_timestamp;

-- Fix security_definer_view for daily_trade_summary
DROP VIEW IF EXISTS public.daily_trade_summary;

CREATE VIEW public.daily_trade_summary AS
SELECT 
    trade_pairs.trade_date,
    count(*) AS total_trades,
    sum(trade_pairs.trade_pnl) AS daily_gross_pnl,
    sum(trade_pairs.trade_pnl_after_commission) AS daily_net_pnl,
    avg(trade_pairs.trade_pnl) AS avg_trade_pnl,
    min(trade_pairs.trade_pnl) AS worst_trade,
    max(trade_pairs.trade_pnl) AS best_trade,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl > (0)::numeric) THEN 1
            ELSE 0
        END) AS winning_trades,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl < (0)::numeric) THEN 1
            ELSE 0
        END) AS losing_trades,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl > (0)::numeric) THEN trade_pairs.trade_pnl
            ELSE (0)::numeric
        END) AS gross_profit,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl < (0)::numeric) THEN trade_pairs.trade_pnl
            ELSE (0)::numeric
        END) AS gross_loss,
    avg(trade_pairs.trade_duration_minutes) AS avg_trade_duration
FROM trade_pairs
GROUP BY trade_pairs.trade_date
ORDER BY trade_pairs.trade_date;

-- Fix security_definer_view for product_performance
DROP VIEW IF EXISTS public.product_performance;

CREATE VIEW public.product_performance AS
SELECT 
    trade_pairs."Product",
    count(*) AS total_trades,
    sum(trade_pairs.trade_pnl) AS total_gross_pnl,
    sum(trade_pairs.trade_pnl_after_commission) AS total_net_pnl,
    avg(trade_pairs.trade_pnl) AS avg_trade_pnl,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl > (0)::numeric) THEN 1
            ELSE 0
        END) AS winning_trades,
    sum(
        CASE
            WHEN (trade_pairs.trade_pnl < (0)::numeric) THEN 1
            ELSE 0
        END) AS losing_trades,
    CASE
        WHEN (count(*) > 0) THEN round((((sum(
        CASE
            WHEN (trade_pairs.trade_pnl > (0)::numeric) THEN 1
            ELSE 0
        END))::numeric / (count(*))::numeric) * (100)::numeric), 2)
        ELSE (0)::numeric
    END AS win_rate
FROM trade_pairs
GROUP BY trade_pairs."Product"
ORDER BY (sum(trade_pairs.trade_pnl_after_commission)) DESC;

-- Set appropriate permissions
GRANT SELECT ON public.trade_pairs TO authenticated;
GRANT SELECT ON public.trade_pairs TO service_role;
GRANT SELECT ON public.daily_trade_summary TO authenticated;
GRANT SELECT ON public.daily_trade_summary TO service_role;
GRANT SELECT ON public.product_performance TO authenticated;
GRANT SELECT ON public.product_performance TO service_role;