require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

// This script runs the TypeScript initialization script
// It allows us to do "npm run init-admin-metrics" to seed the database

try {
  console.log('Transpiling and running the initialization script...');
  
  // Path to the TypeScript script
  const scriptPath = path.resolve(__dirname, '../src/scripts/initialize-admin-metrics.ts');
  
  // Build the command with proper environment variable access
  const command = `npx ts-node --transpile-only ${scriptPath}`;
  
  // Execute the command and show the output
  const output = execSync(command, { stdio: 'inherit' });
  
  console.log('Admin metrics initialization completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Error running admin metrics initialization:', error.message);
  process.exit(1);
} 