# ⚡ READY TO SWITCH - Run This Now!

## ✅ Everything is Ready on Your Machine

I've created a **ready-to-use** switching script with your exact credentials:
- File: `switch-to-azure-central.sh`
- Location: `/Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant/`
- Status: ✅ **Ready to run**

---

## 🚀 3-Step Switch (5 Minutes Total)

### Step 1: Run the Switch Script (1 minute)

```bash
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant

./switch-to-azure-central.sh
```

**What it does:**
- ✅ Backs up your current `.env` file automatically
- ✅ Creates new `.env` with Azure-Central-AI-Hub credentials
- ✅ Preserves all your OpenAI settings
- ✅ Shows you what changed

### Step 2: Assign Azure Permissions (1 minute)

```bash
./fix-azure-permissions.sh
```

**What it does:**
- ✅ Logs into Azure (if needed)
- ✅ Assigns "Reader" role
- ✅ Assigns "Cost Management Reader" role  
- ✅ Verifies everything is correct

### Step 3: Wait & Restart (3 minutes wait + 1 minute restart)

```bash
# Wait 5-10 minutes for Azure role propagation
# Then restart:

npm run dev

# In another terminal:
cd client && npm start
```

---

## ✅ Verify It Worked

```bash
# Test 1: Health
curl http://localhost:5000/api/health

# Test 2: Permissions (should show "valid: true")
curl http://localhost:5000/api/azure/validate-permissions

# Test 3: Open browser
open http://localhost:3000
```

Expected results:
- ✅ No 403 errors
- ✅ Dashboard loads
- ✅ Resources from subscription `5588ec4e-3711-4cd3-a62a-52d031b0a6c8`
- ✅ Cost data displayed

---

## 🔙 Switch Back Anytime

```bash
# List backups
ls -la .env.backup.personal.*

# Restore (use the latest timestamp)
cp .env.backup.personal.20250109_XXXXXX .env

# Restart
npm run dev
```

---

## 📝 What's in Your Setup

Your Azure-Central-AI-Hub credentials (already configured in the script):
- **Tenant ID**: `a8f047ad-e0cb-4b81-badd-4556c4cd71f4`
- **Client ID**: `1f16c4c4-8c61-4083-bda0-b5cd4f847dff`
- **Subscription ID**: `5588ec4e-3711-4cd3-a62a-52d031b0a6c8`
- **Client Secret**: (Securely stored in the script)

---

## 🛡️ Your Safety is Guaranteed

1. ✅ **Automatic backup** - Your current setup is backed up automatically
2. ✅ **No code changes** - Only configuration (.env) is modified
3. ✅ **Preserved settings** - OpenAI, ports, all other settings kept
4. ✅ **Instant restore** - One command brings back your original setup
5. ✅ **Local only** - Script stays on your machine (not in GitHub)

---

## ⚡ Start Now!

```bash
# Run this first command:
./switch-to-azure-central.sh
```

**Then follow the on-screen instructions!**

The script will guide you through everything. 🎯

---

## 💡 Files Created for You

| File | Purpose | Location |
|------|---------|----------|
| `switch-to-azure-central.sh` | Ready-to-run switch script | ✅ On your machine |
| `SWITCH-NOW.md` | Detailed instructions | ✅ On your machine |
| `RUN-THIS-NOW.md` | This quick guide | ✅ On your machine |

**Note**: These files with your credentials stay local for security. They're not pushed to GitHub.

---

## 🎯 Complete Command Sequence

Copy and paste this entire block:

```bash
# Navigate to project
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant

# Step 1: Switch environment
./switch-to-azure-central.sh

# Step 2: Assign permissions
./fix-azure-permissions.sh

# Step 3: Verify permissions
curl http://localhost:5000/api/azure/validate-permissions

# Step 4: Restart application
npm run dev
```

---

**Ready? Open your terminal and run the first command!** ⚡

```bash
./switch-to-azure-central.sh
```

