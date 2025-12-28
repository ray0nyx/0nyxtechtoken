# Password Reset Debug Guide

## 🐛 **Debugging Steps**

### **Step 1: Enable Debug Logging**
I've added comprehensive debug logging to track the password reset flow. Here's what to do:

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Request a password reset** from Settings
4. **Check console logs** for debug information

### **Step 2: Use Debug Page**
Visit `/debug/password-reset` to see:
- Current URL parameters
- Session information
- Parameter analysis
- Test different scenarios

### **Step 3: Check Email Link**
1. **Request password reset** from Settings
2. **Check email** for the reset link
3. **Copy the link** and modify it to use localhost
4. **Visit the modified link** to see what happens

## 🔍 **Debug Information Added**

### **Settings Component Debug Logs**
```javascript
console.log('🔍 Password Reset Debug Info:');
console.log('Email:', profile.email);
console.log('Redirect URL:', redirectUrl);
console.log('Window origin:', window.location.origin);
```

### **PasswordResetHandler Debug Logs**
```javascript
console.log('🔍 PasswordResetHandler Debug Info:');
console.log('Current URL:', window.location.href);
console.log('Search params:', searchParams.toString());
console.log('All params:', Object.fromEntries(searchParams.entries()));
console.log('Code:', code);
console.log('Type:', type);
console.log('Error:', error);
console.log('Is password reset:', isPasswordReset);
console.log('Current session before exchange:', currentSession.session ? 'exists' : 'none');
console.log('Exchange result:', { data, error: resetError });
console.log('Session user:', data.session.user?.email);
```

## 🧪 **Test Scenarios**

### **Scenario 1: Normal Password Reset**
1. Go to Settings → Reset Password
2. Check console for redirect URL
3. Check email for reset link
4. Click reset link
5. Check console for debug logs

### **Scenario 2: Debug Page Testing**
1. Visit `/debug/password-reset`
2. Use test buttons to try different scenarios
3. Check parameter analysis
4. Verify session information

### **Scenario 3: Manual URL Testing**
1. Copy reset link from email
2. Replace domain with localhost
3. Visit the modified link
4. Check console logs

## 🔧 **Common Issues & Solutions**

### **Issue 1: Link Goes to Wrong Page**
**Symptoms**: Reset link takes you to login or dashboard instead of reset page
**Debug**: Check console logs for URL parameters
**Solution**: Verify redirect URL is set to `/auth/reset`

### **Issue 2: No Code Parameter**
**Symptoms**: "No reset code found in URL" error
**Debug**: Check URL parameters in debug page
**Solution**: Verify Supabase email configuration

### **Issue 3: Session Exchange Fails**
**Symptoms**: "Failed to create session" error
**Debug**: Check exchange result in console
**Solution**: Verify code is valid and not expired

### **Issue 4: Wrong Type Parameter**
**Symptoms**: Link goes to auth callback instead of reset handler
**Debug**: Check type parameter in debug page
**Solution**: Verify Supabase is sending correct type

## 📋 **Debug Checklist**

### **Before Testing**
- [ ] Browser DevTools open (Console tab)
- [ ] Debug page accessible at `/debug/password-reset`
- [ ] Supabase connection working
- [ ] Email service configured

### **During Testing**
- [ ] Check console logs for debug info
- [ ] Verify URL parameters are correct
- [ ] Check session status before/after exchange
- [ ] Monitor network requests in DevTools

### **After Testing**
- [ ] Check if redirect works correctly
- [ ] Verify session is created properly
- [ ] Check if reset password page loads
- [ ] Test password change functionality

## 🎯 **Expected Debug Output**

### **Settings Component**
```
🔍 Password Reset Debug Info:
Email: user@example.com
Redirect URL: http://localhost:3000/auth/reset
Window origin: http://localhost:3000
```

### **PasswordResetHandler**
```
🔍 PasswordResetHandler Debug Info:
Current URL: http://localhost:3000/auth/reset?code=abc123&type=recovery
Search params: code=abc123&type=recovery
All params: {code: "abc123", type: "recovery"}
Code: abc123
Type: recovery
Error: null
Is password reset: true
Current session before exchange: none
🔄 Exchanging code for session...
Exchange result: {data: {...}, error: null}
✅ Password reset session created successfully
Session user: user@example.com
🔄 Redirecting to reset password page...
```

## 🚨 **Troubleshooting**

### **If No Debug Logs Appear**
1. Check if console is open
2. Verify the component is loading
3. Check for JavaScript errors
4. Try refreshing the page

### **If URL Parameters Are Missing**
1. Check Supabase email configuration
2. Verify redirect URL is correct
3. Check if email service is working
4. Try requesting reset again

### **If Session Exchange Fails**
1. Check if code is valid
2. Verify code hasn't expired
3. Check Supabase configuration
4. Try with a fresh reset request

## 📞 **Next Steps**

1. **Run the debug steps** above
2. **Check console logs** for debug information
3. **Use the debug page** to analyze parameters
4. **Share the debug output** so I can help identify the issue

The debug information will show exactly what's happening in the password reset flow and help identify where the issue is occurring.
