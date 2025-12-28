# Backend-UI Integration Guide

## Overview

This document explains how backend changes are reflected in the UI in real-time, matching axiom.trade's behavior.

## Data Flow

```
Backend (Python/FastAPI)
  ↓
Redis Pub/Sub
  ↓
WebSocket Server (trading_websocket.py)
  ↓
WebSocket Client (trading-websocket.ts)
  ↓
Zustand Store (useTradingStore.ts)
  ↓
React Components (automatic re-render)
```

## Key Integration Points

### 1. WebSocket Connection

**Backend:** `python-backend/services/trading_websocket.py`
- Publishes candle updates via Redis: `candles:{token}:{timeframe}`
- Publishes swap events: `swaps:{token}`
- Publishes indicator updates: `indicators:{token}:{timeframe}`

**Frontend:** `src/lib/trading-websocket.ts`
- Connects to `ws://localhost:8001/ws/trading`
- Subscribes to token/timeframe on connection
- Handles messages and updates Zustand store immediately

### 2. Store Updates

**File:** `src/stores/useTradingStore.ts`

When WebSocket receives a candle update:
```typescript
store.updateCandle(candle) // Updates candles array AND currentPrice/marketCap
```

This automatically triggers React re-renders in components using:
- `useTradingStore((state) => state.candles)`
- `useTradingStore((state) => state.currentPrice)`
- `useTradingStore((state) => state.marketCap)`

### 3. Chart Updates

**File:** `src/components/crypto/TradingViewLightweightChart.tsx`

The chart receives data from:
1. **Initial load:** `data` prop (from Dashboard's chartData state)
2. **Real-time updates:** `realtimeCandle` prop (from store's currentCandle)
3. **Incremental updates:** Chart's `series.update()` method

When `currentCandle` changes in store:
- Chart's useEffect detects change
- Calls `candlestickSeriesRef.current.update(realtimeCandle)`
- Chart updates instantly without full refetch

### 4. Price Display Updates

**File:** `src/pages/crypto/Dashboard.tsx`

Price updates flow:
1. Backend sends candle update via WebSocket
2. `trading-websocket.ts` calls `store.updateCandle()`
3. Store updates `currentPrice` and `marketCap`
4. Dashboard's `useEffect` detects `storePrice` change
5. Updates `realTimePrice` state
6. CustomPriceChart receives new `realTimePrice` prop
7. Chart displays updated price immediately

## Ensuring Backend Changes Reflect in UI

### Critical Requirements:

1. **WebSocket Connection Must Be Active**
   - Component: `RealtimeDataSync.tsx`
   - Ensures connection is maintained
   - Handles reconnection automatically

2. **Store Updates Must Trigger Re-renders**
   - All components use Zustand selectors
   - Store updates automatically trigger React re-renders
   - No manual `setState` needed

3. **Chart Must Use Incremental Updates**
   - Uses `series.update()` not `setData()`
   - Prevents full chart redraw
   - Maintains smooth animations

4. **Price Updates Must Be Immediate**
   - Store's `updateCandle()` updates `currentPrice`
   - Components subscribe to `currentPrice`
   - UI updates instantly

## Testing Backend-UI Sync

1. **Start Backend:**
   ```bash
   cd python-backend
   uvicorn main:app --reload
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   ```

3. **Verify WebSocket Connection:**
   - Check browser console for `[TradingWS] Connected`
   - Check for "Live" indicator in bottom-right

4. **Test Real-time Updates:**
   - Backend processes a swap
   - Should see candle update in chart immediately
   - Price should update without page refresh
   - Trade bubble should appear on chart

## Common Issues

### Issue: UI not updating
**Solution:** Check WebSocket connection status in store:
```typescript
const wsStatus = useTradingStore((state) => state.wsStatus);
// Should be 'connected'
```

### Issue: Chart not updating
**Solution:** Ensure chart receives `realtimeCandle` prop:
```typescript
const currentCandle = useTradingStore((state) => state.currentCandle);
// Pass to chart component
```

### Issue: Price not updating
**Solution:** Check store subscription:
```typescript
const price = useTradingStore((state) => state.currentPrice);
// Component will re-render when price changes
```

## Performance Considerations

- **Incremental Updates:** Only update changed candles, not full array
- **Debouncing:** Not needed - WebSocket handles backpressure
- **Memoization:** Chart component uses React.memo for performance
- **Batching:** Zustand batches multiple updates automatically
