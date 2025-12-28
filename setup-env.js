#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script creates the necessary .env file with the correct Supabase credentials.
 * Run with: node setup-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up environment variables...\n');

// Supabase configuration
const supabaseUrl = 'https://nlctxawkutljeimvjacp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMTUzNzksImV4cCI6MjA1Njc5MTM3OX0.YnJ3GJb2BRVS7fVLm5ToyUWTBKgSo6gBBMIoDA4JiC4';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTIxNTM3OSwiZXhwIjoyMDU2NzkxMzc5fQ.nzraORQJuR5KwZSF9K8VgvJKruuNaakDedTTdKvYFRw';

// Environment file content
const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}

# Development Configuration
VITE_APP_ENV=development
VITE_APP_URL=http://localhost:8080

# Exchange OAuth Client IDs (replace with real values when needed)
VITE_COINBASE_CLIENT_ID=your_coinbase_client_id_here
VITE_COINBASE_CLIENT_SECRET=your_coinbase_client_secret_here
VITE_KRAKEN_CLIENT_ID=your_kraken_client_id_here
VITE_KRAKEN_CLIENT_SECRET=your_kraken_client_secret_here

# Legacy API Keys (for backward compatibility - not used in OAuth flow)
VITE_BINANCE_API_KEY=your_binance_api_key_here
VITE_BINANCE_SECRET_KEY=your_binance_secret_key_here
VITE_KRAKEN_API_KEY=your_kraken_api_key_here
VITE_KRAKEN_SECRET_KEY=your_kraken_secret_key_here
VITE_KRAKEN_PASSPHRASE=your_kraken_passphrase_here

# Encryption
VITE_ENCRYPTION_SALT=your_encryption_salt_here

# Tradovate OAuth (if needed)
VITE_TRADOVATE_CLIENT_ID=your_tradovate_client_id_here

# Moralis API (for real-time crypto market data)
VITE_MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImZmYzdiZGE4LWRiOWEtNDM1NS1iMmQ1LTBlM2EzNGEwMGZmYSIsIm9yZ0lkIjoiNDg0NzY4IiwidXNlcklkIjoiNDk4NzQwIiwidHlwZUlkIjoiMjdjOGQwYjMtOTc5YS00MWQ0LTljOGMtY2EzZWY2MWRmYTc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjQ5NTkyNjYsImV4cCI6NDkyMDcxOTI2Nn0.U3gyIHv_FFeB8TUr9IU0mROb7qTBsOv72fz2bfCbJzo
`;

// Create .env file
const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file successfully!');
  console.log(`📁 Location: ${envPath}`);
  console.log('');
  console.log('🔑 Environment variables set:');
  console.log(`   VITE_SUPABASE_URL: ${supabaseUrl}`);
  console.log(`   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey.substring(0, 20)}...`);
  console.log(`   VITE_SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(0, 20)}...`);
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Restart your development server');
  console.log('   2. The OAuth implementation should now work correctly');
  console.log('   3. You can test by going to /app/trades and clicking "Sync Trades"');
  console.log('');
  console.log('⚠️  Note: Replace the placeholder API keys with real ones when testing with actual exchanges.');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('');
  console.log('🔧 Manual setup:');
  console.log('Create a .env file in the project root with the following content:');
  console.log('');
  console.log(envContent);
}
