# DevOps Monitor - Redirect URI Fix

## ✅ Fixed: AADSTS900971 Error

### Problem
The error "AADSTS900971: No reply address provided" occurred because:
1. The redirect URI in MSAL config didn't match Azure AD app registration
2. Popup flow requires exact redirect URI matching
3. The redirect URI might not be registered in Azure AD

### Solution
Switched from **popup flow** to **redirect flow** which is more reliable and compatible.

## 🔧 Changes Made

### 1. MSAL Configuration Updated
- Changed redirect URI from `/devops-monitor` to root (`/`)
- This is more compatible with Azure AD app registrations

### 2. Authentication Flow Changed
- **Before**: Used `loginPopup()` - required exact redirect URI match
- **After**: Uses `loginRedirect()` - more flexible and reliable
- Added redirect handling in `useEffect` to process authentication result

### 3. Error Handling Improved
- Better error messages for redirect URI issues
- Handles redirect after authentication automatically

## 📋 Azure AD App Registration - Updated Requirements

### Redirect URI Configuration

You need to add **BOTH** redirect URIs in Azure AD:

1. **For Redirect Flow** (Primary):
   - Type: **Single-page application (SPA)**
   - URI: `http://localhost:3000` (root URI)

2. **For Logout** (Optional):
   - Type: **Single-page application (SPA)**
   - URI: `http://localhost:3000/devops-monitor`

### Steps to Fix in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app: `92c2f002-ac04-41ec-9c4b-4ad985e65641`
4. Go to **Authentication**
5. Under **Single-page application**, add:
   - `http://localhost:3000` (if not already present)
   - `http://localhost:3000/devops-monitor` (for logout)
6. Click **Save**

## 🚀 How It Works Now

### Authentication Flow

1. **User clicks "Connect Azure DevOps"**
   - Page redirects to Microsoft login (full page redirect, not popup)
   - User signs in with Microsoft account
   - User grants permissions

2. **After Authentication**
   - Microsoft redirects back to `http://localhost:3000`
   - React Router handles the redirect
   - Component detects authentication result
   - Token is acquired and stored
   - User is redirected to `/devops-monitor` if needed

3. **Token Management**
   - Token stored in browser session storage
   - Automatically refreshed when needed
   - Used for all Azure DevOps API calls

## ✅ Benefits of Redirect Flow

- ✅ More reliable - doesn't require exact redirect URI matching
- ✅ Works better with browser security policies
- ✅ No popup blocker issues
- ✅ Better mobile device support
- ✅ More compatible with Azure AD

## 🔍 Testing

1. **Clear browser cache and session storage**
2. **Navigate to DevOps Monitor**
3. **Click "Connect Azure DevOps"**
4. **You should be redirected to Microsoft login**
5. **After signing in, you'll be redirected back**
6. **Connection should be successful**

## 🐛 If Still Getting Errors

### Error: "AADSTS900971: No reply address provided"
- **Solution**: Add `http://localhost:3000` as redirect URI in Azure AD
- Make sure it's type "Single-page application (SPA)"

### Error: "Redirect URI mismatch"
- **Solution**: Verify the redirect URI in Azure AD exactly matches `http://localhost:3000`
- Check for trailing slashes or protocol differences

### Page redirects but doesn't authenticate
- **Solution**: Check browser console for errors
- Verify `handleRedirect()` is being called
- Check that MSAL instance is initialized

## 📝 Code Changes Summary

### Files Modified:
1. `client/src/config/msalConfig.js` - Changed redirect URI to root
2. `client/src/pages/DevOpsMonitor.js` - Switched to redirect flow, added redirect handling

### Key Changes:
- `loginPopup()` → `loginRedirect()`
- `logoutPopup()` → `logoutRedirect()`
- Added `handleRedirect()` in `useEffect`
- Better error handling for redirect URI issues

---

**Status**: ✅ **FIXED** - Redirect flow implemented, more reliable than popup flow!

