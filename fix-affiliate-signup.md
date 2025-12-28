# Affiliate Signup Form Fix

## Issues Identified

1. **Invalid Supabase API Key**: The form is using an invalid API key
2. **Environment Variables**: Missing or incorrect environment variables
3. **Database Connection**: Supabase client not properly configured

## Solutions

### 1. Fix Environment Variables

Create a `.env.local` file with the correct Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Update Supabase Client Configuration

The current Supabase client in `src/lib/supabase.ts` needs to be updated to handle errors better and use the correct environment variables.

### 3. Test the Form

1. Start the development server: `npm run dev`
2. Navigate to the affiliate signup page
3. Fill out the form with test data
4. Check browser console for errors
5. Verify the data is inserted into the `affiliate_applications` table

### 4. Database Schema Verification

The `affiliate_applications` table exists with the correct structure:
- All required fields are present
- RLS policies allow public inserts
- Unique constraint on email field

### 5. Form Validation

The form validation is working correctly:
- Required fields are validated
- Checkbox agreements are checked
- Email format is validated

## Next Steps

1. Get the correct Supabase credentials
2. Update the environment variables
3. Test the form submission
4. Verify data is being inserted correctly
