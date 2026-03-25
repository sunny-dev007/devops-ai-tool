# Azure Credentials Configuration

## ✅ Credentials Configured

Your Azure credentials have been configured for the DevOps Monitor feature.

### Backend Configuration (`.env`)

The following credentials are configured in `env.example`:
- **Tenant ID**: `8c3dad1d-b6bc-4f8b-939b-8263372eced6`
- **Client ID**: `574a70af-933c-4b26-a2be-34b4249bf9f6`
- **Client Secret**: `<SET_IN_ENV_FILE>`
- **Subscription ID**: `892a27f1-3f34-4954-a9e9-7bb01aac763e`

**Important**: Copy these to your actual `.env` file (not `env.example`).

### Frontend Configuration (`.env.local`)

Create `client/.env.local` with:
- **REACT_APP_AZURE_TENANT_ID**: `8c3dad1d-b6bc-4f8b-939b-8263372eced6`
- **REACT_APP_AZURE_CLIENT_ID**: `574a70af-933c-4b26-a2be-34b4249bf9f6`

**Note**: Client secret is NOT used in frontend - MSAL browser authentication doesn't require it.

### MSAL Configuration

The MSAL config (`client/src/config/msalConfig.js`) has been updated with your credentials as fallback values.

## 🔒 Security Notes

1. **Client Secret**: 
   - ✅ Used in backend for service principal authentication
   - ❌ NOT used in frontend (MSAL uses public client flow)
   - ⚠️ Keep it secure and never commit to git

2. **Environment Files**:
   - `.env` and `.env.local` should be in `.gitignore`
   - Never commit credentials to version control

3. **MSAL Authentication**:
   - Uses OAuth 2.0 public client flow
   - No client secret needed in browser
   - Tokens stored in browser session storage

## 🚀 Next Steps

1. **Copy credentials to actual `.env` file**:
   ```bash
   cp env.example .env
   # Then edit .env with your actual values if needed
   ```

2. **Restart servers**:
   ```bash
   # Backend
   npm start

   # Frontend (in client folder)
   cd client
   npm start
   ```

3. **Test authentication**:
   - Navigate to DevOps Monitor
   - Click "Connect Azure DevOps"
   - Sign in with your Microsoft account

## ⚠️ Important Reminders

- **Azure AD App Registration**: Make sure your Azure AD app has:
  - Redirect URI: `http://localhost:3000/devops-monitor` (for development)
  - API Permission: Azure DevOps → `user_impersonation` (delegated)
  - Admin consent granted

- **If authentication fails**:
  - Check Azure AD app registration settings
  - Verify redirect URI matches exactly
  - Check browser console for errors
  - Ensure API permissions are granted

## 📝 Files Updated

- ✅ `env.example` - Backend credentials
- ✅ `client/.env.local` - Frontend credentials (created)
- ✅ `client/src/config/msalConfig.js` - MSAL config with fallback values

---

**Status**: ✅ Credentials configured and ready to use!

