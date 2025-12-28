/**
 * ANALYTICS DUPLICATION FIX
 * 
 * This script fixes the issue where duplicate entries in the analytics table 
 * cause trades to not display properly in the UI.
 * 
 * HOW TO USE:
 * 1. Open your browser console on the WagYu app (F12 or right-click > Inspect > Console)
 * 2. Copy and paste this entire script
 * 3. Press Enter to run it
 * 4. Refresh the page to see all your trades
 */

async function fixAnalyticsDuplication() {
  console.log("🔧 Starting analytics duplication fix...");
  
  try {
    // Try to get Supabase from window
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
    
    // Step 1: Count all trades for this user
    console.log("🔍 Checking your trades...");
    const { data: tradesCount, error: tradesError } = await supabase
      .from('trades')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);
      
    if (tradesError) {
      console.error("❌ Error counting trades:", tradesError);
      return false;
    }
    
    console.log(`✅ Found ${tradesCount.length} trades in your account`);
    
    // Step 2: Check analytics entries
    console.log("🔍 Checking for duplicate analytics entries...");
    const { data: analytics, error: analyticsError } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', user.id);
      
    if (analyticsError) {
      console.error("❌ Error checking analytics:", analyticsError);
      return false;
    }
    
    console.log(`✅ Found ${analytics.length} analytics entries`);
    
    // Check for duplicates
    const metricCounts = {};
    let hasDuplicates = false;
    
    analytics.forEach(entry => {
      if (!metricCounts[entry.metric_name]) {
        metricCounts[entry.metric_name] = 1;
      } else {
        metricCounts[entry.metric_name]++;
        hasDuplicates = true;
      }
    });
    
    if (hasDuplicates) {
      console.log("🔍 Found duplicate analytics entries:", metricCounts);
      
      // Step 3: Fix duplicates using our server-side function
      console.log("🔧 Fixing duplicate analytics...");
      
      // SQL script to fix analytics duplication
      const sql = `
        -- Clean up duplicate analytics for current user
        DO $$
        DECLARE
          v_analytics_count INTEGER;
          v_error TEXT;
        BEGIN
          -- Count analytics for this user
          SELECT COUNT(*) INTO v_analytics_count
          FROM analytics
          WHERE user_id = auth.uid();
          
          RAISE NOTICE 'User has % analytics entries, cleaning up...', v_analytics_count;
          
          -- Delete duplicate entries (keep only the newest)
          DELETE FROM analytics a
          WHERE id IN (
            SELECT a.id
            FROM analytics a
            LEFT JOIN (
              SELECT user_id, metric_name, MAX(created_at) as latest_date
              FROM analytics
              WHERE user_id = auth.uid()
              GROUP BY user_id, metric_name
            ) latest ON a.user_id = latest.user_id AND a.metric_name = latest.metric_name AND a.created_at = latest.latest_date
            WHERE a.user_id = auth.uid()
            AND latest.latest_date IS NULL
          );
          
          -- Force a recalculation of analytics
          PERFORM refresh_user_analytics(auth.uid());
          
          -- Verify the fix
          SELECT COUNT(*) INTO v_analytics_count
          FROM analytics
          WHERE user_id = auth.uid();
          
          RAISE NOTICE 'After cleanup, user has % analytics entries', v_analytics_count;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
          RAISE EXCEPTION 'Error fixing analytics: %', v_error;
        END $$;
      `;
      
      // Execute the SQL via RPC
      const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', { 
        sql_string: sql 
      });
      
      if (sqlError) {
        console.error("❌ Error fixing analytics via SQL:", sqlError);
        
        // Try the fallback RPC
        console.log("🔄 Trying alternative fix via validate_trade_accounts...");
        const { data: validateResult, error: validateError } = await supabase.rpc('validate_trade_accounts');
        
        if (validateError) {
          console.error("❌ Alternative fix also failed:", validateError);
          
          // Last resort - manual fix via direct DELETE
          console.log("🔄 Trying manual fix...");
          
          // Find duplicate entries
          const duplicateMetrics = Object.keys(metricCounts).filter(key => metricCounts[key] > 1);
          
          for (const metric of duplicateMetrics) {
            // Get all entries for this metric, sorted by created_at
            const { data: entries, error: entriesError } = await supabase
              .from('analytics')
              .select('*')
              .eq('user_id', user.id)
              .eq('metric_name', metric)
              .order('created_at', { ascending: false });
              
            if (entriesError) {
              console.error(`❌ Error fetching entries for metric ${metric}:`, entriesError);
              continue;
            }
            
            // Keep the newest entry, delete the rest
            if (entries.length > 1) {
              const newestEntry = entries[0];
              const oldEntries = entries.slice(1);
              
              for (const entry of oldEntries) {
                const { error: deleteError } = await supabase
                  .from('analytics')
                  .delete()
                  .eq('id', entry.id);
                  
                if (deleteError) {
                  console.error(`❌ Error deleting duplicate entry ${entry.id}:`, deleteError);
                } else {
                  console.log(`✅ Deleted duplicate entry ${entry.id}`);
                }
              }
            }
          }
          
          // Refresh analytics
          const { error: refreshError } = await supabase.rpc('refresh_user_analytics');
          
          if (refreshError) {
            console.error("❌ Error refreshing analytics:", refreshError);
            return false;
          }
        } else {
          console.log("✅ Applied alternative fix:", validateResult);
        }
      } else {
        console.log("✅ SQL fix applied successfully!", sqlResult);
      }
    } else {
      console.log("✅ No duplicate analytics found");
    }
    
    // Step 4: Verify all trades are properly associated with accounts
    console.log("🔍 Checking for trades without account IDs...");
    
    const { data: nullAccountTrades, error: nullAccountError } = await supabase
      .from('trades')
      .select('id')
      .eq('user_id', user.id)
      .is('account_id', null);
      
    if (nullAccountError) {
      console.error("❌ Error checking for null account trades:", nullAccountError);
    } else {
      console.log(`Found ${nullAccountTrades?.length || 0} trades without account IDs`);
      
      if (nullAccountTrades && nullAccountTrades.length > 0) {
        console.log("🔧 Fixing trades without account IDs...");
        
        // Call the validate_trade_accounts function to fix them
        const { data: validateResult, error: validateError } = await supabase.rpc('validate_trade_accounts');
        
        if (validateError) {
          console.error("❌ Error fixing trades:", validateError);
        } else {
          console.log("✅ Fixed trades without account IDs:", validateResult);
        }
      }
    }
    
    // Step 5: Force refresh analytics to ensure all trades are counted
    console.log("🔄 Refreshing analytics...");
    
    const { data: refreshResult, error: refreshError } = await supabase.rpc('refresh_user_analytics');
    
    if (refreshError) {
      console.error("❌ Error refreshing analytics:", refreshError);
    } else {
      console.log("✅ Analytics refreshed successfully:", refreshResult);
    }
    
    // Step 6: Count trades again to verify fix
    const { data: finalTradesCount, error: finalTradesError } = await supabase
      .from('trades')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);
      
    if (finalTradesError) {
      console.error("❌ Error counting final trades:", finalTradesError);
    } else {
      console.log(`✅ Final trade count: ${finalTradesCount.length}`);
    }
    
    // Step 7: Verify analytics to ensure no duplicates remain
    const { data: finalAnalytics, error: finalAnalyticsError } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', user.id);
      
    if (finalAnalyticsError) {
      console.error("❌ Error checking final analytics:", finalAnalyticsError);
    } else {
      console.log(`✅ Final analytics count: ${finalAnalytics.length}`);
      
      const finalMetricCounts = {};
      let finalHasDuplicates = false;
      
      finalAnalytics.forEach(entry => {
        if (!finalMetricCounts[entry.metric_name]) {
          finalMetricCounts[entry.metric_name] = 1;
        } else {
          finalMetricCounts[entry.metric_name]++;
          finalHasDuplicates = true;
        }
      });
      
      if (finalHasDuplicates) {
        console.log("⚠️ Still found duplicate analytics after fix:", finalMetricCounts);
      } else {
        console.log("✅ No duplicate analytics remain");
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return false;
  }
}

// Execute the fix
fixAnalyticsDuplication()
  .then(success => {
    if (success) {
      console.log("✅ FINISHED: Analytics duplication fix completed successfully!");
      console.log("👉 Please refresh the page to see all your trades.");
    } else {
      console.error("❌ FINISHED: Analytics duplication fix encountered errors.");
      console.log("👉 Please try again or contact support.");
    }
  })
  .catch(error => {
    console.error("❌ ERROR: Unexpected error during fix:", error);
  });

// Instructions for users
console.log(`
========================================================
🔧 ANALYTICS DUPLICATION FIX - INSTRUCTIONS
========================================================
1. This script has been executed to fix trade display issues
2. If it showed success messages, refresh the page to see all your trades
3. If you still have issues, try running the script again
4. If problems persist, contact support
========================================================
`); 