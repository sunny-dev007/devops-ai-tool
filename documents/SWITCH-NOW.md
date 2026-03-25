# 🚀 Switch to Azure-Central-AI-Hub NOW

## Your Environment Details (Ready to Use)

- **Service Principal**: Azure-Central-AI-Hub
- **Tenant ID**: `a8f047ad-e0cb-4b81-badd-4556c4cd71f4`
- **Client ID**: `1f16c4c4-8c61-4083-bda0-b5cd4f847dff`
- **Client Secret**: `<SET_IN_ENV_FILE>`
- **Subscription ID**: `5588ec4e-3711-4cd3-a62a-52d031b0a6c8`

---

## ✅ Quick Switch (3 Commands)

```bash
# 1. Run the switching script
./switch-to-azure-central.sh

# 2. Assign Azure permissions (REQUIRED to fix 403 errors)
./fix-azure-permissions.sh

# 3. Restart your application
npm run dev
```

That's it! Your environment is now switched.

---

## 📋 Detailed Steps

### Step 1: Run the Switch Script

```bash
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant

./switch-to-azure-central.sh
```

This script will:
- ✅ Backup your current `.env` to `.env.backup.personal.TIMESTAMP`
- ✅ Create new `.env` with Azure-Central-AI-Hub credentials  
- ✅ Preserve all your existing settings (OpenAI, ports, etc.)
- ✅ Show you a summary of changes

### Step 2: Assign Azure Permissions (CRITICAL)

**This fixes the 403 authorization errors!**

```bash
./fix-azure-permissions.sh
```

The script will:
- Login to Azure (if needed)
- Assign "Reader" role to your service principal
- Assign "Cost Management Reader" role
- Verify all permissions are correct

**You must have Owner or User Access Administrator role on the subscription to do this.**

If you don't have permission, share these commands with your Azure admin:

```bash
# Reader role
az role assignment create \
  --assignee "1f16c4c4-8c61-4083-bda0-b5cd4f847dff" \
  --role "Reader" \
  --scope "/subscriptions/5588ec4e-3711-4cd3-a62a-52d031b0a6c8"

# Cost Management Reader role
az role assignment create \
  --assignee "1f16c4c4-8c61-4083-bda0-b5cd4f847dff" \
  --role "Cost Management Reader" \
  --scope "/subscriptions/5588ec4e-3711-4cd3-a62a-52d031b0a6c8"
```

### Step 3: Wait for Role Propagation

⏱️ **Wait 5-10 minutes** for Azure to propagate the role assignments.

This is a normal Azure delay. Grab a coffee! ☕

### Step 4: Restart the Application

```bash
# Stop current server if running (Ctrl+C in the terminal)

# Start backend
npm run dev

# In another terminal, start frontend
cd client
npm start
```

### Step 5: Verify Everything Works

```bash
# Test 1: Health check
curl http://localhost:5000/api/health

# Expected: { "status": "healthy", ... }

# Test 2: Permission validation  
curl http://localhost:5000/api/azure/validate-permissions

# Expected: { "success": true, "data": { "valid": true, ... } }

# Test 3: Get subscription summary
curl http://localhost:5000/api/azure/summary

# Expected: Your subscription data (no 403 errors)
```

### Step 6: Test in Browser

Open: http://localhost:3000

You should see:
- ✅ Dashboard loads without errors
- ✅ Resources from subscription `5588ec4e-3711-4cd3-a62a-52d031b0a6c8`
- ✅ Cost data displayed
- ✅ All features working
- ✅ No 403 errors in console

---

## 🔙 Switch Back to Personal Account

If you need to switch back:

```bash
# List your backups
ls -la .env.backup.*

# Restore the most recent one
cp .env.backup.personal.TIMESTAMP .env

# Restart
npm run dev
cd client && npm start
```

---

## ⚠️ Troubleshooting

### Problem: "403 Authorization Failed"

**Solution 1**: Wait longer (roles can take up to 10 minutes)

**Solution 2**: Re-run the permission script
```bash
./fix-azure-permissions.sh
```

**Solution 3**: Verify roles are assigned
```bash
az role assignment list \
  --assignee "1f16c4c4-8c61-4083-bda0-b5cd4f847dff" \
  --scope "/subscriptions/5588ec4e-3711-4cd3-a62a-52d031b0a6c8"
```

### Problem: "Permission denied to assign roles"

You need Owner or User Access Administrator role. Contact your Azure admin.

### Problem: Can't login to Azure CLI

```bash
az login
az account set --subscription "5588ec4e-3711-4cd3-a62a-52d031b0a6c8"
```

---

## 📊 What's Different Now?

After switching, your application will show:
- ✅ Resources from subscription `5588ec4e-3711-4cd3-a62a-52d031b0a6c8`
- ✅ Cost data from this subscription
- ✅ Recommendations for this subscription
- ✅ All your resource groups from this subscription

Everything else stays the same:
- ✅ Same UI
- ✅ Same features
- ✅ Same AI chat
- ✅ Same OpenAI configuration

---

## 🛡️ Safety Guarantees

Your original setup is **100% safe** because:

1. ✅ Automatic backup created: `.env.backup.personal.TIMESTAMP`
2. ✅ Only `.env` file changed (no code modifications)
3. ✅ All non-Azure settings preserved (OpenAI, ports, etc.)
4. ✅ Instant restore available: `cp .env.backup.personal.TIMESTAMP .env`
5. ✅ Can test without affecting your original setup

---

## ✅ Success Checklist

After completing all steps:

- [ ] Ran `./switch-to-azure-central.sh`
- [ ] Backup created successfully
- [ ] Ran `./fix-azure-permissions.sh`
- [ ] Roles assigned (Reader + Cost Management Reader)
- [ ] Waited 5-10 minutes
- [ ] Restarted application
- [ ] Health check passes
- [ ] Permission validation passes
- [ ] Dashboard loads without errors
- [ ] No 403 errors in logs or console

---

## 🎯 Quick Command Summary

```bash
# Complete switch in 3 commands
./switch-to-azure-central.sh
./fix-azure-permissions.sh
npm run dev

# Verify
curl http://localhost:5000/api/azure/validate-permissions

# Open browser
open http://localhost:3000

# Switch back if needed
cp .env.backup.personal.TIMESTAMP .env && npm run dev
```

---

**Ready? Run the first command now!** ⚡

```bash
./switch-to-azure-central.sh
```

