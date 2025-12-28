# Affiliate Signup Form - Issue Analysis & Fix

## 🔍 **Issues Identified**

### 1. **Invalid Supabase API Key**
- **Problem**: The Supabase client is using an invalid API key
- **Error**: `Invalid API key` when trying to connect to Supabase
- **Impact**: Form submissions fail completely

### 2. **Environment Variables Not Configured**
- **Problem**: Missing or incorrect environment variables
- **Files affected**: `.env`, `.env.local`, or environment configuration
- **Required variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### 3. **Database Connection Issues**
- **Problem**: Supabase client cannot connect to the database
- **Root cause**: Invalid credentials or network issues

## ✅ **Solutions Implemented**

### 1. **Enhanced Error Handling**
- Added detailed error logging in `src/pages/AffiliateSignup.tsx`
- Improved error messages for better debugging
- Added console logging for Supabase error details

### 2. **Better Environment Variable Validation**
- Enhanced error logging in `src/lib/supabase.ts`
- Added checks for missing environment variables
- Improved debugging information

### 3. **Test Files Created**
- `test-affiliate-simple.html` - Standalone test page
- `test-affiliate-complete.html` - Comprehensive test
- `debug-affiliate-form.js` - Validation test script

## 🛠️ **Steps to Fix**

### Step 1: Configure Environment Variables
Create or update `.env.local` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 2: Get Correct Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the Project URL and anon/public key
4. Update the environment variables

### Step 3: Test the Form
1. Open `test-affiliate-simple.html` in a browser
2. Replace the placeholder credentials with your actual ones
3. Fill out and submit the form
4. Check browser console for any errors

### Step 4: Verify Database
1. Check that the `affiliate_applications` table exists
2. Verify RLS policies allow public inserts
3. Confirm the table structure matches the form data

## 🔧 **Database Schema Verification**

The `affiliate_applications` table has the correct structure:
```sql
- id (UUID, Primary Key)
- first_name (TEXT, NOT NULL)
- last_name (TEXT, NOT NULL)
- email (TEXT, NOT NULL, UNIQUE)
- password (TEXT, NOT NULL)
- website (TEXT, NOT NULL)
- promotion_plan (TEXT, NOT NULL)
- additional_info (TEXT)
- email_agreement (BOOLEAN, NOT NULL)
- terms_agreement (BOOLEAN, NOT NULL)
- status (TEXT, NOT NULL, DEFAULT 'pending')
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## 🧪 **Testing**

### Manual Testing
1. Start development server: `npm run dev`
2. Navigate to affiliate signup page
3. Fill out the form with test data
4. Submit and check for errors

### Automated Testing
1. Use the provided test HTML files
2. Check browser console for detailed error messages
3. Verify data is inserted into the database

## 📋 **Form Validation**

The form correctly validates:
- ✅ Required fields (firstName, lastName, email, password, website, promotionPlan, additionalInfo)
- ✅ Email format validation
- ✅ Checkbox agreements (emailNotifications, termsAndConditions)
- ✅ Duplicate email checking
- ✅ Status checking (pending, approved, denied)

## 🚨 **Common Issues & Solutions**

### Issue: "Invalid API key"
**Solution**: Update environment variables with correct Supabase credentials

### Issue: "Failed to check existing application"
**Solution**: Verify RLS policies allow SELECT operations on affiliate_applications table

### Issue: "Database error" on insert
**Solution**: Check RLS policies allow INSERT operations for public users

### Issue: Form submits but no data appears
**Solution**: Check database permissions and RLS policies

## 📞 **Next Steps**

1. **Get the correct Supabase credentials** from your project dashboard
2. **Update the environment variables** in `.env.local`
3. **Test the form** using the provided test files
4. **Verify the data** is being inserted into the database
5. **Check the browser console** for any remaining errors

The form logic is correct - the issue is with the Supabase configuration and credentials.
