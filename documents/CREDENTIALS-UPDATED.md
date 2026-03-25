# Azure Credentials Updated

## ✅ Credentials Updated from README.md

Your Azure credentials have been updated to use the values from README.md.

### Updated Credentials

**Backend Configuration (`.env`):**
- **Tenant ID**: `8c3dad1d-b6bc-4f8b-939b-8263372eced6`
- **Client ID**: `574a70af-933c-4b26-a2be-34b4249bf9f6`
- **Client Secret**: `<SET_IN_ENV_FILE>`
- **Subscription ID**: `892a27f1-3f34-4954-a9e9-7bb01aac763e`

**Frontend Configuration (`.env.local` in `client/` folder):**
- **REACT_APP_AZURE_TENANT_ID**: `8c3dad1d-b6bc-4f8b-939b-8263372eced6`
- **REACT_APP_AZURE_CLIENT_ID**: `574a70af-933c-4b26-a2be-34b4249bf9f6`

## 📝 Files Updated

1. ✅ `env.example` - Backend credentials updated
2. ✅ `client/src/config/msalConfig.js` - MSAL config updated with new credentials as fallback
3. ✅ `CREDENTIALS-CONFIGURED.md` - Documentation updated

## 🚀 Next Steps

### 1. Update Your Actual `.env` File

Make sure your actual `.env` file (not `env.example`) has these values:

```env
AZURE_TENANT_ID=8c3dad1d-b6bc-4f8b-939b-8263372eced6
AZURE_CLIENT_ID=574a70af-933c-4b26-a2be-34b4249bf9f6
AZURE_CLIENT_SECRET=<SET_IN_ENV_FILE>
AZURE_SUBSCRIPTION_ID=892a27f1-3f34-4954-a9e9-7bb01aac763e
```

### 2. Create/Update Frontend `.env.local`

Create or update `client/.env.local`:

```env
REACT_APP_AZURE_TENANT_ID=8c3dad1d-b6bc-4f8b-939b-8263372eced6
REACT_APP_AZURE_CLIENT_ID=574a70af-933c-4b26-a2be-34b4249bf9f6
```

### 3. Restart Servers

After updating environment files:

```bash
# Backend
npm start

# Frontend (in client folder)
cd client
npm start
```

### 4. Update Azure AD App Registration

**Important**: Make sure your Azure AD app registration (Client ID: `574a70af-933c-4b26-a2be-34b4249bf9f6`) has:

1. **Redirect URI configured**:
   - Type: **Single-page application (SPA)**
   - URI: `http://localhost:3000` (root URI)

2. **API Permissions**:
   - Azure DevOps → `user_impersonation` (delegated)
   - Admin consent granted

## 🔒 Security Reminder

- ✅ Client secret is only used in backend
- ✅ Frontend uses MSAL (no secret needed)
- ✅ Never commit `.env` or `.env.local` to git
- ✅ MSAL config has fallback values, but environment variables are preferred

## ✅ Status

**Credentials updated and ready to use!**

After updating your `.env` files and restarting servers, the DevOps Monitor should work with the new credentials.

---

**Note**: The MSAL config has these credentials as fallback values, so it will work even if environment variables aren't set, but it's recommended to use environment variables for better security and flexibility.

