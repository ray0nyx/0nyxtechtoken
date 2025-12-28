/**
 * ANALYTICS DUPLICATES CHECKER
 * 
 * This simple diagnostic tool checks for and removes duplicate analytics entries.
 * Use this if you're seeing the "duplicate key value violates unique constraint
 * analytics_user_id_metric_name_unique" error but don't want to modify database functions.
 * 
 * HOW TO USE:
 * 1. Log in to the WagYu app
 * 2. Open your browser console (F12 or right-click > Inspect > Console)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run it
 * 5. Refresh the page to see updated analytics
 */

(async function checkAndFixAnalyticsDuplicates() {
  console.log("🔍 Checking for duplicate analytics entries...");
  
  try {
    // Check if Supabase is available
    const supabase = window.supabase;
    if (!supabase) {
      console.error("❌ Supabase client not found. Are you on the WagYu application?");
      return;
    }
    
    // Check if user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("❌ Authentication error or no user found. Please log in first.");
      console.error(authError);
      return;
    }
    
    console.log(`✅ Authenticated as user ID: ${user.id}`);
    
    // Get all analytics entries for this user
    console.log("📊 Retrieving your analytics entries...");
    const { data: analytics, error: analyticsError } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', user.id);
      
    if (analyticsError) {
      console.error("❌ Error retrieving analytics:", analyticsError);
      return;
    }
    
    console.log(`📊 Found ${analytics.length} analytics entries`);
    
    // Check for duplicates
    const metricCounts = {};
    const metricEntries = {};
    let hasDuplicates = false;
    
    analytics.forEach(entry => {
      if (!metricCounts[entry.metric_name]) {
        metricCounts[entry.metric_name] = 1;
        metricEntries[entry.metric_name] = [entry];
      } else {
        metricCounts[entry.metric_name]++;
        metricEntries[entry.metric_name].push(entry);
        hasDuplicates = true;
      }
    });
    
    // Display analytics metrics
    console.log("📊 Your analytics metrics:");
    Object.keys(metricCounts).forEach(metric => {
      console.log(`  - ${metric}: ${metricCounts[metric]} entries`);
    });
    
    if (!hasDuplicates) {
      console.log("✅ No duplicate analytics found. Everything looks good!");
      return;
    }
    
    console.log("🔧 Found duplicate analytics entries. Starting cleanup...");
    
    // Identify and remove duplicates
    let removedCount = 0;
    
    for (const metric in metricEntries) {
      if (metricEntries[metric].length > 1) {
        console.log(`  - Fixing ${metric}: ${metricEntries[metric].length} entries found (should be 1)`);
        
        // Sort by created_at (newest first)
        metricEntries[metric].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Keep the newest entry, delete the rest
        const entriesToDelete = metricEntries[metric].slice(1);
        
        for (const entry of entriesToDelete) {
          const { error: deleteError } = await supabase
            .from('analytics')
            .delete()
            .eq('id', entry.id);
            
          if (deleteError) {
            console.error(`  ❌ Error deleting duplicate entry ${entry.id}:`, deleteError);
          } else {
            console.log(`  ✅ Deleted duplicate entry ${entry.id} (${metric})`);
            removedCount++;
          }
        }
      }
    }
    
    if (removedCount > 0) {
      console.log(`✅ Successfully removed ${removedCount} duplicate analytics entries.`);
      
      // Force analytics refresh
      console.log("🔄 Refreshing analytics data...");
      
      try {
        const { error: refreshError } = await supabase.rpc('refresh_user_analytics');
        
        if (refreshError) {
          console.error("❌ Error refreshing analytics:", refreshError);
        } else {
          console.log("✅ Analytics refreshed successfully");
        }
      } catch (error) {
        console.error("❌ Error refreshing analytics:", error);
      }
      
      console.log("👉 Please refresh the page to see updated analytics.");
    } else {
      console.log("ℹ️ No duplicates were removed. You might need a more comprehensive fix.");
    }
    
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
})();

console.log(`
========================================================
🔍 ANALYTICS DUPLICATES CHECKER - RUNNING
========================================================
This script is checking your analytics entries for duplicates.
It will report any issues found and attempt to fix them.
Please wait for it to complete...
========================================================
`); 