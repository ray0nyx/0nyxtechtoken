# Comprehensive Password Reset Debug Guide

## 🎯 **The 4 Key Areas to Check**

Based on your feedback, here are the specific areas we need to debug:

1. **Missing Code**: Check if code parameter is present
2. **Wrong Type**: Check if type parameter is recovery or missing  
3. **Session Exchange Fails**: Check if code is valid and not expired
4. **Wrong Redirect**: Check if redirect URL is correct

## 🔧 **Debug Tools Available**

### **1. Enhanced Diagnostic Tool**
- **URL**: `/debug/password-reset-diagnostic`
- **Features**: 
  - Checks all 4 key areas automatically
  - Visual status indicators
  - Test code exchange functionality
  - Detailed error reporting

### **2. Console Debug Logging**
- **Settings Component**: Logs email and redirect URL
- **PasswordResetHandler**: Logs all parameters and exchange results
- **Look for**: 🔍 emoji in console logs

### **3. Test Script**
- **File**: `test-password-reset-debug.js`
- **Run**: `node test-password-reset-debug.js`
- **Purpose**: Test URL parsing and scenarios

## 🧪 **Step-by-Step Debugging Process**

### **Step 1: Run the Diagnostic Tool**
1. Visit `/debug/password-reset-diagnostic`
2. Check the 4 diagnostic cards:
   - **Missing Code Check** (Red/Green status)
   - **Wrong Type Check** (Red/Green status)  
   - **Session Exchange Check** (Test button available)
   - **Wrong Redirect Check** (Shows expected vs actual)

### **Step 2: Test Password Reset Flow**
1. **Open Browser DevTools** (F12) → Console tab
2. **Go to Settings** → Reset Password
3. **Check console logs** for:
   ```
   🔍 Password Reset Debug Info:
   Email: your@email.com
   Redirect URL: http://localhost:3000/auth/reset
   Window origin: http://localhost:3000
   ```

### **Step 3: Check Email Link**
1. **Check your email** for the reset link
2. **Copy the link** and modify domain to localhost
3. **Visit the modified link**
4. **Check console logs** for:
   ```
   🔍 PasswordResetHandler Debug Info:
   Current URL: http://localhost:3000/auth/reset?code=abc123&type=recovery
   Search params: code=abc123&type=recovery
   All params: {code: "abc123", type: "recovery"}
   Code: abc123
   Type: recovery
   Error: null
   Is password reset: true
   ```

### **Step 4: Test Code Exchange**
1. **In the diagnostic tool**, click "Test Code Exchange"
2. **Check results** for success/failure
3. **Look for errors** in the exchange process

## 🔍 **Specific Issues & Solutions**

### **Issue 1: Missing Code Parameter**
**Symptoms**: 
- "No reset code found in URL" error
- Code parameter shows as "None" in diagnostic

**Debug Steps**:
1. Check email link format
2. Verify Supabase email configuration
3. Check if link is being modified by email client

**Solutions**:
- Ensure Supabase email template includes `{{ .ConfirmationURL }}`
- Check Supabase Auth settings
- Try different email client

### **Issue 2: Wrong Type Parameter**
**Symptoms**:
- Link goes to auth callback instead of reset handler
- Type is not "recovery" or missing

**Debug Steps**:
1. Check URL parameters in diagnostic tool
2. Verify Supabase email template
3. Check if type parameter is being stripped

**Solutions**:
- Update Supabase email template
- Check URL rewriting rules
- Verify redirect URL configuration

### **Issue 3: Session Exchange Fails**
**Symptoms**:
- "Failed to create session" error
- Code exchange test fails

**Debug Steps**:
1. Use "Test Code Exchange" button in diagnostic
2. Check console logs for exchange errors
3. Verify code is not expired

**Solutions**:
- Check if code is valid and not expired
- Verify Supabase configuration
- Try with fresh reset request

### **Issue 4: Wrong Redirect URL**
**Symptoms**:
- Link goes to wrong page
- Redirect URL is incorrect

**Debug Steps**:
1. Check redirect URL in Settings debug logs
2. Verify Supabase Auth settings
3. Check URL configuration

**Solutions**:
- Update Supabase Auth redirect URLs
- Check environment variables
- Verify domain configuration

## 📊 **Expected Diagnostic Results**

### **✅ All Good (Green Status)**
```
Code Present: ✅ Yes
Correct Type: ✅ Yes  
Code Exchange: ✅ Yes
Redirect URL: ✅ Yes
```

### **❌ Issues Found (Red Status)**
```
Code Present: ❌ No
Correct Type: ❌ No
Code Exchange: ❌ No
Redirect URL: ❌ No
```

## 🚨 **Common Error Messages & Solutions**

### **"No reset code found in URL"**
- **Cause**: Missing code parameter
- **Solution**: Check email template and Supabase config

### **"Failed to create session"**
- **Cause**: Invalid or expired code
- **Solution**: Request new reset, check code validity

### **"Not a password reset, redirecting to auth callback"**
- **Cause**: Wrong type parameter
- **Solution**: Check email template, verify type is "recovery"

### **"URL error parameter: [error]"**
- **Cause**: Supabase returned an error
- **Solution**: Check Supabase logs, verify configuration

## 🎯 **Quick Fix Checklist**

### **Before Testing**
- [ ] Browser DevTools open (Console tab)
- [ ] Diagnostic tool accessible at `/debug/password-reset-diagnostic`
- [ ] Supabase connection working
- [ ] Email service configured

### **During Testing**
- [ ] Check all 4 diagnostic areas
- [ ] Monitor console logs for debug info
- [ ] Test code exchange if code is present
- [ ] Verify redirect URL is correct

### **After Testing**
- [ ] All 4 areas show green status
- [ ] Console logs show successful flow
- [ ] Password reset page loads correctly
- [ ] Password can be changed successfully

## 📞 **Next Steps**

1. **Run the diagnostic tool** at `/debug/password-reset-diagnostic`
2. **Check the 4 key areas** for any red status indicators
3. **Test the password reset flow** with console logs open
4. **Share the diagnostic results** if issues persist

The diagnostic tool will show exactly which of the 4 areas is causing the problem, making it easy to identify and fix the specific issue!
