#!/bin/bash

# WagYu Deployment Script
# This script guides you through the deployment process for recent changes

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}WagYu Deployment Script${NC}"
echo -e "This script will guide you through the deployment process for recent changes."
echo -e "--------------------------------"

# Check if we're in the WagYu directory
if [ ! -d "supabase" ]; then
  echo -e "${RED}Error: This script should be run from the WagYu project root directory.${NC}"
  exit 1
fi

echo -e "\n${YELLOW}Step 1: Push code changes to GitHub${NC}"
echo -e "The following files have been modified to fix user registration issues:"
echo -e "  - src/pages/SignUp.tsx"
echo -e "  - supabase/functions/register-user/index.ts"
echo -e "  - supabase/migrations/20240401000100_add_user_repair_functions.sql"
echo -e "  - supabase/migrations/20240401000200_fix_trigger_conflict.sql"
echo -e "\nThese changes have already been committed and pushed to the main branch."

echo -e "\n${YELLOW}Step 2: Apply database migrations${NC}"
echo -e "To apply the migrations to your Supabase project, you'll need to:"
echo -e "  1. Go to the Supabase dashboard: https://supabase.com/dashboard"
echo -e "  2. Select your project"
echo -e "  3. Go to the SQL Editor"
echo -e "  4. Create a new query"
echo -e "  5. Copy and paste the contents of each migration file and run them in order:"
echo -e "     a. supabase/migrations/20240401000100_add_user_repair_functions.sql"
echo -e "     b. supabase/migrations/20240401000200_fix_trigger_conflict.sql"

echo -e "\n${YELLOW}Step 3: Deploy the Edge Function${NC}"
echo -e "To deploy the register-user Edge Function:"
echo -e "  1. Make sure you have Docker Desktop running"
echo -e "  2. Run the following command:"
echo -e "     cd supabase && npx supabase functions deploy register-user"
echo -e "  3. If you don't have Docker, you can manually deploy from the Supabase Dashboard:"
echo -e "     a. Go to the 'Edge Functions' section"
echo -e "     b. Create a new function called 'register-user'"
echo -e "     c. Copy and paste the contents of supabase/functions/register-user/index.ts"

echo -e "\n${YELLOW}Step 4: Test the Signup Process${NC}"
echo -e "Once deployed, test the signup process with a new email to verify it works correctly."

echo -e "\n${YELLOW}Step 5: Repair Existing Users (if needed)${NC}"
echo -e "If you have existing users with incomplete records, run this SQL query in the Supabase dashboard:"
echo -e "  SELECT * FROM repair_missing_users();"

echo -e "\n${GREEN}Deployment Instructions Complete!${NC}"
echo -e "If you encounter any issues, please refer to the documentation or contact support." 