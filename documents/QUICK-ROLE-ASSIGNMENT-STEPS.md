# ⚡ Quick Role Assignment Steps - Azure Portal

## 5-Minute Visual Guide

### 🎯 Goal
Assign 3 roles to your Service Principal: **Reader**, **Cost Management Reader**, and **Contributor**

---

## 📱 Quick Steps

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1️⃣  Azure Portal → Subscriptions                      │
│      https://portal.azure.com                          │
│                                                         │
│  2️⃣  Select Your Subscription                          │
│      (Match with AZURE_SUBSCRIPTION_ID in .env)        │
│                                                         │
│  3️⃣  Access control (IAM) → Left sidebar               │
│                                                         │
│  4️⃣  + Add → Add role assignment                       │
│                                                         │
│  5️⃣  Search "Reader" → Select → Next                   │
│                                                         │
│  6️⃣  + Select members                                  │
│      Search: YOUR_CLIENT_ID or app name                │
│                                                         │
│  7️⃣  Select your Service Principal → Select            │
│                                                         │
│  8️⃣  Review + assign                                   │
│      ✅ Wait for "Added role assignment" notification  │
│                                                         │
│  9️⃣  REPEAT steps 4-8 for:                             │
│      • Cost Management Reader                          │
│      • Contributor (optional, for AI Agent)            │
│                                                         │
│  🔟  Verify in Role assignments tab                    │
│      Filter by: YOUR_SERVICE_PRINCIPAL_NAME            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 What to Search

| Step | Search For | What You'll See |
|------|------------|-----------------|
| Find Subscription | `Subscriptions` | List of Azure subscriptions |
| Find IAM | Click subscription → Left menu | Access control (IAM) option |
| Add Reader | Search: `Reader` | Role with "View all resources" |
| Add Cost Reader | Search: `Cost Management Reader` | Role with "View cost data" |
| Add Contributor | Search: `Contributor` | Role with "Manage all resources" |
| Find Service Principal | Search: `<YOUR_CLIENT_ID>` | Your app name in results |

---

## ✅ Verification Checklist

After completion, check **Role assignments** tab:

```
Filter: your-app-name
────────────────────────────────────
✅ Reader
   Scope: Subscription
   
✅ Cost Management Reader
   Scope: Subscription
   
✅ Contributor (optional)
   Scope: Subscription
────────────────────────────────────
```

---

## 🚨 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Can't find Service Principal | Use exact Client ID from `.env` |
| "No permission to assign roles" | Need **Owner** role first |
| Role assigned but not working | Wait 5-10 minutes for propagation |
| Multiple subscriptions showing | Select the one matching `.env` |

---

## 🎯 Expected Time

| Task | Time |
|------|------|
| Login to Azure Portal | 1 minute |
| Navigate to IAM | 1 minute |
| Assign Reader role | 1 minute |
| Assign Cost Management Reader | 1 minute |
| Assign Contributor role | 1 minute |
| **Total** | **~5 minutes** |

---

## 📞 Need Detailed Steps?

See: **[MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)**

---

## 🔗 Alternative: Automated Script

If you have Azure CLI access:

```bash
# Run the automated script
./assign-permissions-manual.sh
```

**What it does**:
- ✅ Logs in with Service Principal
- ✅ Checks current roles
- ✅ Assigns missing roles automatically
- ✅ Verifies assignments

---

**⚡ That's it! You're done in 5 minutes.**

