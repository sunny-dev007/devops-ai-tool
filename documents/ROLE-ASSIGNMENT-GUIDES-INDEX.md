# 📚 Role Assignment Guides - Complete Index

## All Resources for Assigning Azure RBAC Roles

---

## 🎯 Choose Your Preferred Method

We provide **3 different methods** to assign Azure roles to your Service Principal. Choose the one that works best for you:

| Method | Time | Skill Level | Best For |
|--------|------|-------------|----------|
| **Web-Based UI** | 2 min | Beginner | Quick setup, visual feedback |
| **Azure Portal** | 5 min | Beginner | Step-by-step control, verification |
| **Automated Script** | 1 min | Intermediate | Batch setups, CI/CD |

---

## 📖 Available Guides

### 1️⃣ Web-Based Environment Switcher (Easiest)

**What**: Use the built-in web interface to assign roles with one click

**When to use**:
- ✅ You want the easiest method
- ✅ You prefer visual interfaces
- ✅ You want real-time progress tracking
- ✅ You're setting up a new environment

**How to access**:
1. Navigate to: http://localhost:3000/environment-switcher
2. Enter your Azure credentials
3. Click "Validate & Switch Environment"
4. Click "Assign Required Permissions" button

**Documentation**: Built into the application

---

### 2️⃣ Azure Portal Manual Assignment (Most Common)

#### 📘 Complete Detailed Guide
**File**: [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)

**What**: Full step-by-step guide with detailed explanations, screenshots descriptions, and troubleshooting

**Length**: ~15 pages

**Includes**:
- ✅ Detailed screenshots descriptions
- ✅ What to click at each step
- ✅ Troubleshooting common issues
- ✅ Verification steps
- ✅ Security best practices
- ✅ Alternative methods
- ✅ Terminal commands for verification

**When to use**:
- You're doing this for the first time
- You want to understand each step
- You need troubleshooting help
- You want to see all available options

**Perfect for**: Beginners, Documentation, Training

---

#### ⚡ Quick 5-Minute Reference
**File**: [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md)

**What**: Visual quick reference for experienced users who just need a reminder

**Length**: 2 pages

**Includes**:
- ✅ Numbered steps with emojis
- ✅ Visual ASCII flowchart
- ✅ Quick troubleshooting table
- ✅ Expected completion time
- ✅ Verification checklist

**When to use**:
- You've done this before
- You just need a quick reminder
- You want to verify you didn't miss anything
- You're in a hurry

**Perfect for**: Repeat users, Quick reference, Cheat sheet

---

#### 🗺️ Azure Portal Navigation Map
**File**: [AZURE-PORTAL-NAVIGATION-MAP.md](./AZURE-PORTAL-NAVIGATION-MAP.md)

**What**: Visual map of Azure Portal showing exactly where to click and what you'll see

**Length**: ~8 pages

**Includes**:
- ✅ ASCII mockups of Azure Portal screens
- ✅ Visual navigation paths
- ✅ Color coding explanations
- ✅ Keyboard shortcuts
- ✅ Pro tips for portal usage
- ✅ Alternative navigation methods

**When to use**:
- You find Azure Portal confusing
- You want to see what screens look like
- You need to know where menu items are
- You want to learn portal navigation

**Perfect for**: Visual learners, New to Azure Portal, Training

---

### 3️⃣ Automated CLI Script (Fastest)

**File**: `fix-azure-permissions.sh` (Already exists in project)

**What**: Bash script that automatically assigns all required roles

**Command**:
```bash
./fix-azure-permissions.sh
```

**When to use**:
- ✅ You have Azure CLI installed
- ✅ You're comfortable with terminal
- ✅ You want the fastest method
- ✅ You need to automate role assignment

**Requirements**:
- Azure CLI installed (`az --version`)
- Service Principal credentials in `.env` file
- Terminal access

**Perfect for**: Developers, Automation, CI/CD, Repeat setups

---

## 🎓 Recommended Learning Path

### For Complete Beginners:
1. **Start**: [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)
2. **Practice**: Use Web-Based Environment Switcher
3. **Reference**: Keep [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md) handy

### For Azure Portal Beginners:
1. **Start**: [AZURE-PORTAL-NAVIGATION-MAP.md](./AZURE-PORTAL-NAVIGATION-MAP.md)
2. **Follow**: [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)
3. **Verify**: [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md)

### For Experienced Users:
1. **Quick Check**: [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md)
2. **Automate**: Use `fix-azure-permissions.sh`
3. **Verify**: Web-Based Environment Switcher

### For Troubleshooting:
1. **First**: [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md) → Troubleshooting section
2. **Then**: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. **Verify**: Use Azure Portal to check current roles

---

## 🔍 Quick Comparison

| Feature | Web UI | Azure Portal | CLI Script |
|---------|--------|--------------|------------|
| Visual Interface | ✅ Best | ✅ Good | ❌ No |
| Step-by-step | ✅ Automatic | ⚠️ Manual | ✅ Automatic |
| Real-time Progress | ✅ Yes | ❌ No | ⚠️ Terminal output |
| Troubleshooting | ✅ Built-in | ⚠️ Need guide | ⚠️ Need CLI knowledge |
| Setup Time | 2 min | 5 min | 1 min |
| Prerequisites | App running | Azure Portal access | Azure CLI |
| Learning Curve | Easy | Medium | Hard |
| Best Use Case | First time setup | Manual control | Automation |

---

## 📋 What Roles Do You Need?

### Minimum (View Only):
- ✅ **Reader** - View all resources

### Recommended (Full Dashboard):
- ✅ **Reader** - View all resources
- ✅ **Cost Management Reader** - View costs and billing

### Complete (AI Agent Cloning):
- ✅ **Reader** - View all resources
- ✅ **Cost Management Reader** - View costs and billing
- ✅ **Contributor** - Create and clone resources

**See any guide for detailed role explanations**

---

## 🚨 Common Issues & Solutions

| Issue | Quick Solution | Detailed Guide |
|-------|----------------|----------------|
| Can't find Service Principal | Use Client ID in search | [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md) → Issue 2 |
| No permission to assign roles | Need Owner role first | [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md) → Issue 1 |
| Role assigned but not working | Wait 5-10 minutes | [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md) → Issue 3 |
| Wrong subscription | Verify Subscription ID | [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md) → Common Issues |
| Azure Portal confusing | Use navigation map | [AZURE-PORTAL-NAVIGATION-MAP.md](./AZURE-PORTAL-NAVIGATION-MAP.md) |

---

## ✅ Verification Checklist

After assigning roles, verify using this checklist:

### Method 1: Azure Portal
1. [ ] Go to Subscriptions → Your subscription → Access control (IAM)
2. [ ] Click "Role assignments" tab
3. [ ] Search for your Service Principal name
4. [ ] Verify all required roles are listed
5. [ ] Check scope is "Subscription" (not Resource Group)

### Method 2: Web UI
1. [ ] Go to http://localhost:3000/environment-switcher
2. [ ] Enter credentials
3. [ ] Click "Validate & Switch Environment"
4. [ ] Wait for validation to complete
5. [ ] Look for "✅ All required roles verified!"

### Method 3: Azure CLI
```bash
az role assignment list \
  --assignee "<YOUR_CLIENT_ID>" \
  --subscription "<YOUR_SUBSCRIPTION_ID>" \
  --output table
```

**Expected output**: 3 rows (Reader, Cost Management Reader, Contributor)

---

## 📞 Need More Help?

### In Application:
- Navigate to: http://localhost:3000/environment-switcher
- Click "Try Again" if validation fails
- Check real-time error messages

### Documentation:
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common errors and fixes
- [README.md](./README.md) - General setup and configuration
- [ENVIRONMENT-SWITCHER.md](./ENVIRONMENT-SWITCHER.md) - Environment switcher guide

### Azure Resources:
- [Azure RBAC Documentation](https://docs.microsoft.com/en-us/azure/role-based-access-control/)
- [Service Principal Permissions](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)
- [Azure Portal Help](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)

---

## 🎯 Quick Start (Choose One)

### Option A: Fastest (Web UI)
```
1. http://localhost:3000/environment-switcher
2. Enter credentials
3. Click "Assign Required Permissions"
4. Done! ✅
```

### Option B: Most Control (Azure Portal)
```
1. Open: QUICK-ROLE-ASSIGNMENT-STEPS.md
2. Follow 10 steps
3. Verify in Role assignments
4. Done! ✅
```

### Option C: Automation (CLI Script)
```bash
./fix-azure-permissions.sh
# Done! ✅
```

---

## 📝 Additional Resources

| Document | Purpose |
|----------|---------|
| [MANUAL-ROLE-ASSIGNMENT-GUIDE.md](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md) | Complete step-by-step manual |
| [QUICK-ROLE-ASSIGNMENT-STEPS.md](./QUICK-ROLE-ASSIGNMENT-STEPS.md) | 5-minute quick reference |
| [AZURE-PORTAL-NAVIGATION-MAP.md](./AZURE-PORTAL-NAVIGATION-MAP.md) | Visual portal navigation |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [README.md](./README.md) | Main project documentation |
| [ENVIRONMENT-SWITCHER.md](./ENVIRONMENT-SWITCHER.md) | Environment switcher guide |

---

## 🎉 Success Criteria

You've successfully assigned roles when:

✅ All 3 roles visible in Azure Portal Role assignments  
✅ Environment Switcher validation passes  
✅ No 403 Authorization errors in application  
✅ Dashboard shows your Azure resources  
✅ Cost analysis displays billing data  
✅ AI Agent can discover resources  

**🎊 Congratulations! Your setup is complete!**

---

**Last Updated**: November 2025  
**Maintained By**: Azure Monitor AI Assistant Team  
**Feedback**: Report issues via GitHub Issues


