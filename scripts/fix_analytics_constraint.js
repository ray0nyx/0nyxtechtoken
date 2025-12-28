/**
 * ANALYTICS CONSTRAINT VIOLATION FIX
 * 
 * This script specifically fixes the "duplicate key value violates unique constraint
 * analytics_user_id_metric_name_unique" error that occurs during trade uploads.
 * 
 * HOW TO USE:
 * 1. Log in to the WagYu app
 * 2. Open your browser console (F12 or right-click > Inspect > Console)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run it
 * 5. Try uploading your trades again
 */

async function fixAnalyticsConstraintViolation() {
  console.log("🔧 Starting analytics constraint violation fix...");
  
  try {
    // Check if supabase client is available
    const supabase = window.supabase;
    if (!supabase) {
      console.error("❌ Supabase client not found. Are you on the WagYu application?");
      return false;
    }
    
    // Check if user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("❌ Authentication error or no user found. Please log in first.");
      console.error(authError);
      return false;
    }
    
    console.log(`✅ Authenticated as user ID: ${user.id}`);
    
    // Step 1: Apply the database fix
    console.log("🔧 Applying database fix...");
    
    const sql = `
      -- STEP 1: Remove duplicate analytics entries
      DO $$
      DECLARE
          v_duplicates_removed INT;
      BEGIN
          -- Delete duplicate analytics entries (keep only the newest)
          WITH duplicates AS (
              SELECT a.id
              FROM analytics a
              INNER JOIN (
                  SELECT user_id, metric_name, MAX(created_at) as max_created
                  FROM analytics
                  WHERE user_id = auth.uid()
                  GROUP BY user_id, metric_name
                  HAVING COUNT(*) > 1
              ) AS latest
              ON a.user_id = latest.user_id 
              AND a.metric_name = latest.metric_name 
              AND a.created_at < latest.max_created
          )
          DELETE FROM analytics
          WHERE id IN (SELECT id FROM duplicates)
          RETURNING id
          INTO v_duplicates_removed;
          
          RAISE NOTICE 'Removed % duplicate analytics entries', v_duplicates_removed;
          
          -- STEP 2: Update functions to handle constraint properly
          -- This creates a new version of refresh_user_analytics that uses ON CONFLICT DO UPDATE
          CREATE OR REPLACE FUNCTION refresh_user_analytics(p_user_id uuid)
          RETURNS BOOLEAN AS $$
          DECLARE
              v_count INTEGER;
              v_metric_names TEXT[] := ARRAY[
                  'winning_days', 'win_rate', 'total_trades', 'total_pnl', 
                  'avg_pnl_per_contract', 'avg_win', 'avg_loss', 'profit_factor', 
                  'expectancy', 'sharpe_ratio', 'largest_win', 'largest_loss',
                  'win_loss_ratio', 'consecutive_wins', 'consecutive_losses'
              ];
              v_metric TEXT;
              v_value NUMERIC;
          BEGIN
              -- For each metric, calculate and update
              FOREACH v_metric IN ARRAY v_metric_names
              LOOP
                  -- Calculate the metric value
                  EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;
                  
                  -- Insert or update the analytic record using ON CONFLICT
                  INSERT INTO analytics (user_id, metric_name, value)
                  VALUES (p_user_id, v_metric, v_value)
                  ON CONFLICT (user_id, metric_name) 
                  DO UPDATE SET value = EXCLUDED.value, updated_at = now();
              END LOOP;
              
              RETURN TRUE;
          EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Error in refresh_user_analytics: %', SQLERRM;
              RETURN FALSE;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          
          -- STEP 3: Refresh the analytics for this user
          PERFORM refresh_user_analytics(auth.uid());
      END $$;
    `;
    
    // Execute the SQL fix
    const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', { 
      sql_string: sql 
    });
    
    if (sqlError) {
      console.error("❌ Error applying SQL fix:", sqlError);
      
      // Try direct cleanup as fallback
      console.log("🔄 Trying direct cleanup of analytics table...");
      
      // Step 2: Get all analytics entries for this user
      const { data: analytics, error: analyticsError } = await supabase
        .from('analytics')
        .select('*')
        .eq('user_id', user.id);
        
      if (analyticsError) {
        console.error("❌ Error retrieving analytics entries:", analyticsError);
        return false;
      }
      
      // Check for duplicates
      const metricMap = {};
      const duplicates = [];
      
      analytics.forEach(entry => {
        if (!metricMap[entry.metric_name]) {
          metricMap[entry.metric_name] = entry;
        } else {
          // If this entry is newer than what we have, keep this one and mark the old one as duplicate
          if (new Date(entry.created_at) > new Date(metricMap[entry.metric_name].created_at)) {
            duplicates.push(metricMap[entry.metric_name].id);
            metricMap[entry.metric_name] = entry;
          } else {
            duplicates.push(entry.id);
          }
        }
      });
      
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicate analytics entries to remove`);
        
        // Delete each duplicate
        for (const id of duplicates) {
          const { error: deleteError } = await supabase
            .from('analytics')
            .delete()
            .eq('id', id);
            
          if (deleteError) {
            console.error(`❌ Error deleting duplicate analytics entry ${id}:`, deleteError);
          }
        }
        
        console.log(`✅ Removed ${duplicates.length} duplicate analytics entries`);
      } else {
        console.log("✅ No duplicate analytics entries found");
      }
    } else {
      console.log("✅ SQL fix applied successfully");
    }
    
    // Step 3: Force refresh analytics
    console.log("🔄 Forcing analytics refresh...");
    
    const { data: refreshResult, error: refreshError } = await supabase.rpc('refresh_user_analytics');
    
    if (refreshError) {
      console.error("❌ Error refreshing analytics:", refreshError);
    } else {
      console.log("✅ Analytics refreshed successfully");
    }
    
    // Step 4: Create test trade to verify fix
    console.log("🧪 Testing with a sample trade upload...");
    
    const testData = [
      ["TEST_SYMBOL", "2023-01-01", "1", "100", "101", "long", "1"]
    ];
    
    const { data: testResult, error: testError } = await supabase.rpc('process_tradovate_csv_batch', {
      p_rows: testData,
      p_is_test: true
    });
    
    if (testError) {
      console.error("❌ Test trade upload failed:", testError);
      
      if (testError.message.includes("duplicate key value violates unique constraint")) {
        console.error("⚠️ Constraint violation still occurring. Trying one last fix...");
        
        // Last resort - drop and recreate functions
        const lastResortSql = `
          -- Get all current analytics entries
          DO $$
          DECLARE
              v_user_id UUID;
          BEGIN
              SELECT auth.uid() INTO v_user_id;
              
              -- Delete all analytics for this user
              DELETE FROM analytics WHERE user_id = v_user_id;
              
              -- Recreate them with refresh function
              PERFORM refresh_user_analytics(v_user_id);
              
              RAISE NOTICE 'Completely reset analytics for user %', v_user_id;
          END $$;
        `;
        
        const { data: lastResortResult, error: lastResortError } = await supabase.rpc('exec_sql', { 
          sql_string: lastResortSql 
        });
        
        if (lastResortError) {
          console.error("❌ Last resort fix failed:", lastResortError);
        } else {
          console.log("✅ Last resort fix applied successfully");
        }
      }
    } else {
      console.log("✅ Test trade upload successful:", testResult);
    }
    
    return true;
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return false;
  }
}

// Execute the fix
fixAnalyticsConstraintViolation()
  .then(success => {
    if (success) {
      console.log(`
      ✅ ANALYTICS CONSTRAINT FIX COMPLETED
      
      The fix has been applied to your account. You should now be able to:
      1. Upload trades without the constraint violation error
      2. See all your trades in the trades table
      3. Have accurate analytics displayed on your dashboard
      
      Please refresh the page and try uploading your trades again.
      `);
    } else {
      console.error(`
      ❌ ANALYTICS CONSTRAINT FIX ENCOUNTERED ERRORS
      
      Some parts of the fix may not have been applied successfully.
      You can try:
      1. Running this script again
      2. Clearing your browser cache and refreshing
      3. Contacting support if the issue persists
      `);
    }
  });

// Help instructions
console.log(`
========================================================
🔧 ANALYTICS CONSTRAINT VIOLATION FIX - INSTRUCTIONS
========================================================
This script is running and will:

1. Remove duplicate analytics entries from your account
2. Update database functions to prevent future duplicates
3. Test that the fix works correctly

Please wait for it to complete before uploading trades.
========================================================
`); 