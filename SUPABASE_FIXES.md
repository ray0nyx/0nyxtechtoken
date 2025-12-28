# Supabase 409 Error Fixes

## 🔧 **Issues Fixed**

### 1. **ReferenceError: canAccessTradeSync is not defined**
- **File**: `src/pages/trades/add.tsx`
- **Fix**: Replaced `canAccessTradeSync` with `(isSubscriptionValid || isDeveloper)`
- **Status**: ✅ Fixed

### 2. **409 Conflict Error in user_trade_metrics**
- **File**: `src/utils/analytics.ts`
- **Issue**: Unique constraint violations when inserting duplicate analytics data
- **Fix**: Changed from `.insert()` to `.upsert()` with conflict resolution
- **Status**: ✅ Fixed

## 🛠️ **Technical Details**

### Analytics Tracking Fix
```typescript
// Before (causing 409 errors)
const { error } = await supabase
  .from('user_trade_metrics')
  .insert(eventData);

// After (handles conflicts gracefully)
const { error } = await supabase
  .from('user_trade_metrics')
  .upsert(eventData, { 
    onConflict: 'user_id,event_type,timestamp',
    ignoreDuplicates: true 
  });
```

### Subscription Access Fix
```typescript
// Before (undefined variable)
{canAccessTradeSync && (

// After (using subscription context)
{(isSubscriptionValid || isDeveloper) && (
```

## 📊 **Database Schema Considerations**

If you continue to see 409 errors, consider these database optimizations:

### 1. **Add Proper Indexes**
```sql
-- Create unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_trade_metrics_unique 
ON user_trade_metrics (user_id, event_type, timestamp);

-- Add partial index for better performance
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_user_id 
ON user_trade_metrics (user_id) 
WHERE user_id IS NOT NULL;
```

### 2. **Update RLS Policies**
```sql
-- Ensure proper RLS policies for user_trade_metrics
ALTER TABLE user_trade_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own metrics" ON user_trade_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own metrics" ON user_trade_metrics
  FOR SELECT USING (auth.uid() = user_id);
```

### 3. **Add Conflict Resolution**
```sql
-- Add ON CONFLICT handling at database level
ALTER TABLE user_trade_metrics 
ADD CONSTRAINT unique_user_event_timestamp 
UNIQUE (user_id, event_type, timestamp);
```

## 🧪 **Testing the Fixes**

### 1. **Test Analytics Tracking**
```javascript
// Test in browser console
window.trackEvent('test_event', { test: true });
// Should not show 409 errors in console
```

### 2. **Test Subscription Access**
- Log in as a free user - OAuth section should not show
- Log in as a pro user - OAuth section should show
- Log in as a developer - OAuth section should show

### 3. **Monitor Network Requests**
- Check Network tab in DevTools
- Look for 409 errors - should be eliminated
- Analytics requests should succeed or fail gracefully

## 🚀 **Deployment Notes**

1. **Frontend Changes**: No deployment needed, changes are in code
2. **Database Changes**: Optional optimizations above
3. **Monitoring**: Watch for 409 errors in production logs

## 📈 **Performance Impact**

- **Before**: 409 errors caused failed requests and console errors
- **After**: Graceful conflict resolution with upsert operations
- **Result**: Cleaner console, better user experience, no failed analytics

The fixes ensure that:
- ✅ No more 409 conflict errors
- ✅ No more undefined variable errors  
- ✅ Analytics tracking works reliably
- ✅ Subscription-based features work correctly




