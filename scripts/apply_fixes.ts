import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wagyu.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  process.exit(1);
}

// Initialize Supabase client
console.log(`Connecting to Supabase at ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to apply SQL file
async function applySqlFix(filePath: string, name: string): Promise<void> {
  try {
    console.log(`Applying ${name} fix...`);
    
    // Get absolute path (support both relative and absolute paths)
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(process.cwd(), filePath);
    
    console.log(`Reading SQL file: ${absolutePath}`);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error(`File not found: ${absolutePath}`);
      return;
    }
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(absolutePath, 'utf8');
    console.log(`SQL file loaded, size: ${sqlContent.length} bytes`);
    
    // Execute the SQL query
    console.log('Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error(`Error applying ${name} fix:`, error);
    } else {
      console.log(`✅ ${name} fix applied successfully!`);
      console.log('Response:', data);
    }
  } catch (error) {
    console.error(`Error processing ${name} fix:`, error);
  }
}

// Check if exec_sql function exists
async function createExecSqlFunctionIfNeeded(): Promise<void> {
  try {
    console.log('Checking if exec_sql function exists...');
    
    // Try to call the function with a simple test
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 as test' });
    
    if (error) {
      console.log('exec_sql function doesn\'t exist or has an error, creating it...');
      
      // Read the SQL file to create the function
      const execSqlFunctionPath = path.resolve(process.cwd(), 'scripts/create_exec_sql_function.sql');
      
      if (!fs.existsSync(execSqlFunctionPath)) {
        console.error(`File not found: ${execSqlFunctionPath}`);
        return;
      }
      
      const sqlContent = fs.readFileSync(execSqlFunctionPath, 'utf8');
      
      // Execute the SQL directly (can't use exec_sql since it doesn't exist yet)
      const { error: createError } = await supabase.from('_exec_sql').rpc('direct_execute', { 
        sql_query: sqlContent 
      });
      
      if (createError) {
        console.error('Error creating exec_sql function:', createError);
        console.log('You may need to run the script to create the exec_sql function manually in the Supabase SQL Editor');
      } else {
        console.log('✅ exec_sql function created successfully!');
      }
    } else {
      console.log('✅ exec_sql function already exists and is working');
    }
  } catch (error) {
    console.error('Error checking/creating exec_sql function:', error);
    console.log('You may need to run scripts/create_exec_sql_function.sql manually in the Supabase SQL Editor');
  }
}

// Main function
async function applyFixes() {
  console.log('Starting to apply database fixes...');
  
  // First ensure exec_sql function exists
  await createExecSqlFunctionIfNeeded();
  
  // Apply Tradovate fix
  await applySqlFix(path.resolve(process.cwd(), 'scripts/fix_tradovate_duration_type.sql'), 'Tradovate duration type');
  
  // Apply TopstepX fix
  await applySqlFix(path.resolve(process.cwd(), 'scripts/fix_topstepx_duration_type.sql'), 'TopstepX duration type');
  
  console.log('All fixes have been applied!');
}

// Run the main function
applyFixes()
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error in main process:', err)); 