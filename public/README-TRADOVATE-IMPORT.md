# Trading Platform CSV Import Feature

This feature allows you to import your trades from various trading platforms into the TraderLog application. The importer automatically pairs entry and exit trades, calculates P&L, and creates daily summaries.

## Supported Platforms

Currently, the following platforms are supported:

- **Tradovate**: Full support for importing and processing Tradovate CSV exports
- **TopstepX**: Coming soon

## How to Export Trades from Tradovate

1. Log in to your Tradovate account
2. Go to the "Reports" section
3. Select "Fills" report
4. Choose the date range you want to export
5. Click "Export" and select CSV format
6. Save the file to your computer

## CSV Format Requirements

### Tradovate
The CSV file from Tradovate can contain the following columns:

Optional columns:
- `Text`: The order text/notes (used to identify entry and exit pairs) - now optional
- `Fill Time`: The timestamp of the fill - now optional
- `filledQty`: The quantity filled (will be stored in the `qty` field) - now optional
- `avgPrice`: The average fill price - now optional
- `B/S`: Buy or Sell indicator - now optional
- `Product`: The product code (e.g., "MES", "MNQ") - now optional
- `Contract`: The contract name (e.g., "ESM3") - now optional
- `orderId`: The unique identifier for the order (optional)

## How Entry and Exit Pairs are Identified

### Tradovate
The importer uses the `Text` field to identify entry and exit pairs:

- Entry trades are identified by "multibracket" or "Tradingview" in the Text field
- Exit trades are identified by "Exit" at the beginning of the Text field
- The importer pairs consecutive entry and exit trades

## Product Multipliers

### Tradovate
The importer uses the following multipliers to calculate P&L:

- MNQ: $2 per point
- MES: $0.50 per point
- M2K: $0.50 per point
- MYM: $0.50 per point

For other products, a default multiplier of 1 is used.

## Commission Calculation

A fixed commission of $2.50 per trade is applied when calculating net P&L.

## How to Use the Importer

1. Go to the "Add Trades" page in the TraderLog application
2. Select the "Platform Import" tab
3. From the platform dropdown, select your trading platform (e.g., "Tradovate")
4. Click "Choose File" and select your CSV file
5. Click "Process [Platform] CSV"
6. Wait for the processing to complete
7. Review the daily summaries displayed on the page
8. Your trades are now imported into the system

## Daily Summaries

The importer creates daily summaries with the following metrics:

- Total trades
- Daily gross P&L
- Daily net P&L (after commissions)
- Average trade P&L
- Worst trade
- Best trade
- Number of winning trades
- Number of losing trades
- Average trade duration (in minutes)

These summaries are stored in the `daily_trade_summary` table and can be used for reporting and analysis.

## Troubleshooting

If you encounter any issues with the import process:

1. Ensure you've selected the correct platform from the dropdown
2. Ensure your CSV file is in the correct format for the selected platform
3. Check that the file contains both entry and exit trades
4. Verify that the Text field contains the expected values (for Tradovate)
5. Try exporting a smaller date range if the file is very large

If problems persist, please contact support with details of the issue.

# Tradovate CSV Import

This document describes the CSV format for importing Tradovate trades into the application.

## CSV Format

The CSV file should have the following columns:

### Required Columns
- `Fill Time`: The timestamp when the trade was filled
- `Text`: The text description of the trade (used to identify entry and exit pairs)

### Optional Columns
- `filledQty`: The quantity that was filled
- `avgPrice`: The average price of the fill
- `B/S`: Buy or Sell indicator
- `Contract`: The contract traded
- `Product`: The product traded
- `orderId`: The order ID
- `priceFormat`: The price format for the trade
- `priceFormatType`: The type of price format
- `tickSize`: The tick size for the instrument
- `buyFillId`: ID for the buy fill
- `sellFillId`: ID for the sell fill
- `qty`: Alternative to filledQty
- `buyPrice`: Price at which the instrument was bought
- `sellPrice`: Price at which the instrument was sold
- `pnl`: The profit and loss for the trade
- `boughtTimestamp`: Timestamp when the instrument was bought
- `soldTimestamp`: Timestamp when the instrument was sold
- `duration`: Duration between buy and sell

## Trade Pairing

The processor will automatically pair entry and exit trades based on the `Text` field, where:
- Entries are marked with 'multibracket' or 'Tradingview'
- Exits are marked with 'Exit'

## Example CSV

```csv
Text,Fill Time,filledQty,avgPrice,B/S,Contract,Product,orderId,priceFormat,priceFormatType,tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
multibracket,2023-01-01T09:30:00Z,1,100.00,Buy,ESH3,ES,,0.25,decimal,0.25,12345,,1,100.00,,,,2023-01-01T09:30:00Z,
Exit,2023-01-01T10:30:00Z,1,101.00,Sell,ESH3,ES,,0.25,decimal,0.25,,67890,1,,101.00,25.00,2023-01-01T09:30:00Z,2023-01-01T10:30:00Z,3600
```

## Notes

- If `pnl` is provided, it will be used directly instead of calculating it from prices
- If `duration` is provided, it will be used directly instead of calculating it from timestamps
- If `buyPrice` and `sellPrice` are provided, they will be used instead of deriving them from `avgPrice`
- If `boughtTimestamp` and `soldTimestamp` are provided, they will be used instead of deriving them from `Fill Time` 