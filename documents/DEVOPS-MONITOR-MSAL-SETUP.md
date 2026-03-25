# DevOps Monitor - MSAL Authentication Setup

## Overview

The DevOps Monitor now uses **MSAL (Microsoft Authentication Library)** for browser-based OAuth authentication instead of Personal Access Tokens (PAT). This provides a more secure and user-friendly authentication experience.

## Setup Instructions

### 1. Azure AD App Registration

You need to register an Azure AD application that will be used for Azure DevOps authentication:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: `Azure Monitor AI Assistant - DevOps`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - Type: **Single-page application (SPA)**
     - URI: `http://localhost:3000/devops-monitor` (for development)
     - For production: `https://your-domain.com/devops-monitor`
5. Click **Register**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Azure DevOps**
4. Choose **Delegated permissions**
5. Select: `user_impersonation`
6. Click **Add permissions**
7. Click **Grant admin consent** (if you're an admin)

### 3. Get Application Details

1. In your app registration, go to **Overview**
2. Copy the following values:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### 4. Configure Environment Variables

Add these to your `.env` file (or create a `.env.local` in the client folder):

**Backend `.env`:**
```env
# Azure AD Configuration (for MSAL)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
```

**Frontend `.env.local` (in client folder):**
```env
REACT_APP_AZURE_TENANT_ID=your-tenant-id
REACT_APP_AZURE_CLIENT_ID=your-client-id
```

### 5. Restart Application

After configuring environment variables:
1. Restart the backend server
2. Restart the frontend development server

## How It Works

### Authentication Flow

1. **User clicks "Connect Azure DevOps"**
   - MSAL opens a popup window
   - User signs in with their Microsoft account
   - User consents to Azure DevOps permissions

2. **Token Acquisition**
   - MSAL acquires an access token with Azure DevOps scope
   - Token is stored in browser session storage
   - Token is sent to backend for API calls

3. **API Calls**
   - All Azure DevOps API calls use the OAuth token
   - Token is automatically refreshed when needed
   - Token expires after 1 hour (MSAL handles refresh)

### Token Scopes

The application requests these scopes:
- `499b84ac-1321-427f-aa17-267ca6975798/user_impersonation` - Azure DevOps user impersonation
- `offline_access` - For refresh tokens

## Troubleshooting

### Error: "Invalid client configuration"
- Check that `REACT_APP_AZURE_CLIENT_ID` and `REACT_APP_AZURE_TENANT_ID` are set in `.env.local`
- Restart the frontend server after adding environment variables

### Error: "AADSTS70011: The provided value for the input parameter 'scope' is not valid"
- Ensure the Azure AD app has the Azure DevOps API permission configured
- Check that `user_impersonation` permission is granted

### Error: "Redirect URI mismatch"
- Verify the redirect URI in Azure AD matches exactly:
  - Development: `http://localhost:3000/devops-monitor`
  - Production: `https://your-domain.com/devops-monitor`
- Check that the redirect URI type is "Single-page application (SPA)"

### Error: "User cancelled authentication"
- User closed the popup window
- Simply try again

### Token Not Working
- Check browser console for errors
- Verify token is being sent in API requests
- Check backend logs for authentication errors
- Try disconnecting and reconnecting

## Security Notes

1. **Tokens are stored in browser session storage** - They are cleared when the browser session ends
2. **Tokens are sent to backend** - Backend stores them temporarily in memory (not persisted)
3. **HTTPS in production** - Always use HTTPS in production environments
4. **Token expiration** - Tokens expire after 1 hour, MSAL automatically refreshes them

## Migration from PAT

If you were using PAT (Personal Access Token) before:

1. **Remove PAT from `.env`** - No longer needed
2. **Remove `AZURE_DEVOPS_ORGANIZATION`** - Organization is detected automatically
3. **Use MSAL authentication** - Click "Connect Azure DevOps" to authenticate

## API Changes

### Before (PAT-based):
```javascript
// Required environment variables
AZURE_DEVOPS_ORGANIZATION=your-org
AZURE_DEVOPS_PAT=your-pat-token
```

### After (MSAL-based):
```javascript
// Required environment variables
REACT_APP_AZURE_TENANT_ID=your-tenant-id
REACT_APP_AZURE_CLIENT_ID=your-client-id
```

## Support

For issues:
1. Check browser console for errors
2. Check backend logs
3. Verify Azure AD app registration configuration
4. Ensure API permissions are granted

---

**Note**: The MSAL authentication provides better security and user experience compared to PAT tokens, as users don't need to manually create and manage tokens.

