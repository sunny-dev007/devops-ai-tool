# 🔐 Manual Role Assignment Guide - Azure Portal

## Complete Step-by-Step Guide for Environment Switcher Role Permissions

This guide will help you manually assign the required Azure RBAC roles to your Service Principal through the Azure Portal.

---

## 📋 Prerequisites

Before starting, you need:

1. ✅ **Azure Portal Access**: https://portal.azure.com
2. ✅ **Owner or User Access Administrator role** on the subscription
3. ✅ **Service Principal details**:
   - Application (Client) ID
   - Tenant ID
   - Subscription ID

---

## 🎯 Required Roles

Your Service Principal needs these 3 roles for full functionality:

| Role | Purpose | Required For |
|------|---------|--------------|
| **Reader** | View all Azure resources | Dashboard, Resource lists, AI Agent discovery |
| **Cost Management Reader** | View cost and billing data | Cost analysis, Budget tracking |
| **Contributor** | Create/manage resources | AI Agent cloning, Resource creation |

> **Note**: Start with **Reader** and **Cost Management Reader** for basic functionality. Add **Contributor** only when you need to clone/create resources.

---

## 📖 Step-by-Step Guide

### Step 1: Log into Azure Portal

1. Open your web browser
2. Navigate to: https://portal.azure.com
3. Sign in with your Azure account credentials
4. Ensure you're in the correct **Directory** and **Subscription**

**Screenshot guide**: Look for your profile icon in the top-right corner → Verify the directory name

---

### Step 2: Navigate to Subscriptions

1. In the Azure Portal search bar (top center), type: **`Subscriptions`**
2. Click on **"Subscriptions"** from the results
3. You'll see a list of all your Azure subscriptions

**Screenshot guide**: 
```
┌─────────────────────────────────────────┐
│ 🔍 Search resources...                  │
│    Subscriptions ✓                      │
│    Subscription (service)               │
└─────────────────────────────────────────┘
```

---

### Step 3: Select Your Subscription

1. From the list, **click on the subscription** where you want to assign roles
2. This is the subscription that your Environment Switcher will use
3. The subscription ID should match the one in your `.env` file

**How to verify**:
- The subscription name will be displayed at the top
- You can see the Subscription ID in the overview section
- Copy this ID and verify it matches `AZURE_SUBSCRIPTION_ID` in your `.env`

**Screenshot guide**:
```
Subscriptions > Pay-As-You-Go
┌─────────────────────────────────────────┐
│ Subscription ID: 5588ec4e-3711-4cd3-... │
│ Status: Active                          │
└─────────────────────────────────────────┘
```

---

### Step 4: Open Access Control (IAM)

1. In the left sidebar menu, scroll down and click **"Access control (IAM)"**
2. This is where you manage role assignments for the subscription
3. Wait for the page to load completely

**Screenshot guide**:
```
Left Menu:
├── Overview
├── Activity log
├── Access control (IAM)  ← Click here
├── Tags
├── Diagnose and solve problems
└── ...
```

---

### Step 5: Add Role Assignment

1. At the top of the Access control (IAM) page, click **"+ Add"** button
2. From the dropdown, select **"Add role assignment"**
3. A new panel will open on the right side

**Screenshot guide**:
```
Access control (IAM)
┌─────────────────────────────────────────┐
│ [+ Add ▼] [Check access] [View]        │
│   ├── Add role assignment  ← Click this │
│   ├── Add co-administrator              │
│   └── Add deny assignment               │
└─────────────────────────────────────────┘
```

**Alternative Method** (if above doesn't work):
1. Click on the **"Role assignments"** tab
2. Click **"+ Add"** → **"Add role assignment"**

---

### Step 6: Assign "Reader" Role

#### 6.1 Select the Role

1. In the **"Add role assignment"** wizard, you'll see three tabs at the top
2. Stay on the **"Role"** tab (first tab)
3. In the search box, type: **`Reader`**
4. From the list, click on **"Reader"**
5. Read the description to confirm it's the right role
6. Click **"Next"** at the bottom

**Screenshot guide**:
```
Add role assignment
┌─────────────────────────────────────────┐
│ Role | Members | Conditions | Review   │
│                                         │
│ 🔍 Search by name or description        │
│                                         │
│ ☑️ Reader                               │
│    Grants full access to view all      │
│    resources, but does not allow...    │
│                                         │
│              [Next >]                   │
└─────────────────────────────────────────┘
```

#### 6.2 Add Service Principal as Member

1. You're now on the **"Members"** tab
2. Under **"Assign access to"**, ensure **"User, group, or service principal"** is selected
3. Click **"+ Select members"**
4. A search panel will appear on the right side

**Screenshot guide**:
```
Members
┌─────────────────────────────────────────┐
│ Assign access to:                       │
│ ⦿ User, group, or service principal    │
│ ○ Managed identity                      │
│                                         │
│ [+ Select members]  ← Click this        │
└─────────────────────────────────────────┘
```

#### 6.3 Search for Your Service Principal

1. In the search box, type your **Application (Client) ID** or **App Registration name**
   - Example: `1f16c4c4-8c61-4083-bda0-b5cd4f847dff`
   - Or your app name like: `azure-monitor-ai-assistant`
2. Your Service Principal should appear in the results
3. **Click on it** to select it (it will have a checkmark)
4. The selected member will show at the bottom
5. Click **"Select"** button at the bottom of the panel

**Screenshot guide**:
```
Select members
┌─────────────────────────────────────────┐
│ 🔍 1f16c4c4-8c61-4083-bda0-b5cd4f847dff│
│                                         │
│ Search results:                         │
│ ☑️ azure-monitor-ai-assistant          │
│    Application                          │
│                                         │
│ Selected (1):                           │
│ • azure-monitor-ai-assistant           │
│                                         │
│              [Select]                   │
└─────────────────────────────────────────┘
```

**Troubleshooting - Can't find your Service Principal?**

If you can't find your Service Principal:

1. **Verify you're searching with the correct ID**:
   - Check your `.env` file for `AZURE_CLIENT_ID`
   - Use the exact Client ID value

2. **Try searching with the App Registration name**:
   - Go to Azure Portal → **Azure Active Directory** → **App registrations**
   - Find your app and note the **Display name**
   - Use this name in the search

3. **Ensure you're in the right directory**:
   - Your profile icon (top right) → Switch directory
   - Select the directory that contains your Service Principal

4. **Check if the Service Principal exists**:
   - Azure Portal → **Azure Active Directory** → **App registrations**
   - Switch to **"All applications"** tab
   - Search for your Client ID

#### 6.4 Review and Assign

1. Click **"Next"** to go to the **"Conditions"** tab (optional, skip this)
2. Click **"Next"** again to go to the **"Review + assign"** tab
3. Review the assignment details:
   - **Role**: Reader
   - **Scope**: Subscription / [Your Subscription Name]
   - **Members**: [Your Service Principal Name]
4. Click **"Review + assign"** button at the bottom
5. Wait for the notification: **"Added role assignment"** (green checkmark)

**Screenshot guide**:
```
Review + assign
┌─────────────────────────────────────────┐
│ Role:                                   │
│   Reader                                │
│                                         │
│ Scope:                                  │
│   Subscription                          │
│   Pay-As-You-Go                         │
│                                         │
│ Members:                                │
│   azure-monitor-ai-assistant           │
│                                         │
│         [Review + assign]               │
└─────────────────────────────────────────┘
```

**Success Notification**:
```
✅ Added role assignment
   Role: Reader
   Member: azure-monitor-ai-assistant
```

---

### Step 7: Assign "Cost Management Reader" Role

Repeat Step 6, but this time:

1. Click **"+ Add"** → **"Add role assignment"** again
2. In the **Role** tab, search for: **`Cost Management Reader`**
3. Select **"Cost Management Reader"**
4. Click **"Next"**
5. Click **"+ Select members"**
6. Search for your Service Principal (same as before)
7. Select it and click **"Select"**
8. Click **"Next"** (skip Conditions)
9. Click **"Review + assign"**
10. Wait for success notification

**Screenshot guide**:
```
Add role assignment - Cost Management Reader
┌─────────────────────────────────────────┐
│ 🔍 Cost Management Reader               │
│                                         │
│ ☑️ Cost Management Reader               │
│    View cost and usage data for Azure  │
│    subscriptions and resource groups   │
└─────────────────────────────────────────┘
```

---

### Step 8: Assign "Contributor" Role (For AI Agent Cloning)

> **⚠️ Important**: Only assign this role if you want to use the AI Agent to clone resources. This gives write permissions!

Repeat Step 6 again, but this time:

1. Click **"+ Add"** → **"Add role assignment"**
2. In the **Role** tab, search for: **`Contributor`**
3. Select **"Contributor"**
4. Click **"Next"**
5. Click **"+ Select members"**
6. Search for your Service Principal
7. Select it and click **"Select"**
8. Click **"Next"** (skip Conditions)
9. Click **"Review + assign"**
10. Wait for success notification

**Screenshot guide**:
```
Add role assignment - Contributor
┌─────────────────────────────────────────┐
│ 🔍 Contributor                          │
│                                         │
│ ☑️ Contributor                          │
│    Grants full access to manage all    │
│    resources, but does not allow you   │
│    to assign roles in Azure RBAC...    │
└─────────────────────────────────────────┘
```

---

## ✅ Step 9: Verify Role Assignments

After assigning all roles, verify they were added correctly:

1. In **Access control (IAM)**, click on the **"Role assignments"** tab
2. In the search/filter box, type your **Service Principal name** or **Client ID**
3. You should see all three roles listed:

**Expected result**:
```
Role assignments
┌───────────────────────────────────────────────────────┐
│ Name: azure-monitor-ai-assistant                      │
│                                                       │
│ Role                          | Scope               │
│──────────────────────────────┼─────────────────────│
│ Reader                        | Subscription        │
│ Cost Management Reader        | Subscription        │
│ Contributor                   | Subscription        │
└───────────────────────────────────────────────────────┘
```

**Screenshot guide**:
```
Filter by name or type:
[🔍 azure-monitor-ai-assistant        ]

Results:
┌─────────────────────────────────────────┐
│ ✅ Reader                               │
│    azure-monitor-ai-assistant          │
│    Subscription: Pay-As-You-Go         │
│                                         │
│ ✅ Cost Management Reader               │
│    azure-monitor-ai-assistant          │
│    Subscription: Pay-As-You-Go         │
│                                         │
│ ✅ Contributor                          │
│    azure-monitor-ai-assistant          │
│    Subscription: Pay-As-You-Go         │
└─────────────────────────────────────────┘
```

---

## 🧪 Step 10: Test the Assignment

### Method 1: Using Environment Switcher

1. Go to your application: http://localhost:3000/environment-switcher
2. Enter your credentials:
   - Tenant ID
   - Client ID
   - Client Secret
   - Subscription ID
3. Click **"Validate & Switch Environment"**
4. Wait for validation to complete
5. You should see: **"✅ All required roles verified!"**

### Method 2: Using Azure CLI (Terminal)

```bash
# Login with service principal
az login --service-principal \
  -u "<YOUR_CLIENT_ID>" \
  -p "<YOUR_CLIENT_SECRET>" \
  --tenant "<YOUR_TENANT_ID>"

# Check role assignments
az role assignment list \
  --assignee "<YOUR_CLIENT_ID>" \
  --subscription "<YOUR_SUBSCRIPTION_ID>" \
  --output table

# Expected output:
# Principal                             Role                        Scope
# ------------------------------------  --------------------------  --------
# 1f16c4c4-8c61-4083-bda0-b5cd4f847dff  Reader                      /subscriptions/5588ec4e...
# 1f16c4c4-8c61-4083-bda0-b5cd4f847dff  Cost Management Reader      /subscriptions/5588ec4e...
# 1f16c4c4-8c61-4083-bda0-b5cd4f847dff  Contributor                 /subscriptions/5588ec4e...
```

---

## 🔍 Troubleshooting Common Issues

### Issue 1: "You do not have permission to add role assignments"

**Solution**:
- You need **Owner** or **User Access Administrator** role on the subscription
- Contact your Azure subscription administrator to either:
  1. Give you the required permissions, OR
  2. Assign the roles for you

**How to check your current roles**:
1. Go to **Subscriptions** → Select your subscription
2. Click **Access control (IAM)** → **Role assignments** tab
3. Search for your own username
4. Verify you have **Owner** or **User Access Administrator** role

---

### Issue 2: "Cannot find Service Principal in search"

**Solution 1** - Verify Service Principal exists:
```bash
# List all service principals
az ad sp list --filter "appId eq '<YOUR_CLIENT_ID>'" --output table
```

**Solution 2** - Check if you're in the correct directory:
1. Click your profile icon (top right)
2. Select **"Switch directory"**
3. Choose the directory where your Service Principal was created

**Solution 3** - Use Azure Active Directory:
1. Azure Portal → **Azure Active Directory**
2. **App registrations** → **All applications** tab
3. Search for your Client ID
4. If found, use the **Display name** in the role assignment search

---

### Issue 3: "Role assignment exists but validation fails"

**Solution**:
- Wait 5-10 minutes for Azure RBAC propagation
- Role assignments can take time to fully propagate across Azure services
- Try logging out and logging back in with the Service Principal

**Force token refresh**:
```bash
# Logout
az logout

# Login again
az login --service-principal \
  -u "<YOUR_CLIENT_ID>" \
  -p "<YOUR_CLIENT_SECRET>" \
  --tenant "<YOUR_TENANT_ID>"

# Get fresh token
az account get-access-token
```

---

### Issue 4: "Cost data not showing after assigning roles"

**Solution**:
- Cost Management Reader role can take up to 24 hours to fully activate
- Cost data is updated daily in Azure
- Check if your subscription has any costs to display (it might be a new subscription)

**Verify Cost Management access**:
1. Azure Portal → **Cost Management + Billing**
2. Select your subscription
3. Click **Cost analysis**
4. If you see cost data, the role is working

---

### Issue 5: "Contributor role assigned but AI Agent cannot create resources"

**Solution 1** - Check for Azure Policy restrictions:
1. Azure Portal → **Policy**
2. Click **Assignments**
3. Look for policies that might block resource creation

**Solution 2** - Verify subscription limits/quotas:
- Some resource types have quotas that must be increased
- Example: Free tier App Service Plans may have 0 quota

**Solution 3** - Check region availability:
- Some regions don't support certain resource types
- Try using different regions: "West US", "Central US", "East US 2"

---

## 📝 Quick Reference Card

**Save this for future use**:

| Step | Action | Details |
|------|--------|---------|
| 1 | Open Azure Portal | https://portal.azure.com |
| 2 | Go to Subscriptions | Use search bar |
| 3 | Select subscription | Match with `.env` file |
| 4 | Access control (IAM) | Left sidebar menu |
| 5 | + Add → Add role assignment | Top button |
| 6 | Search "Reader" | Select and Next |
| 7 | + Select members | Search by Client ID |
| 8 | Select Service Principal | Your app name |
| 9 | Review + assign | Complete assignment |
| 10 | Repeat for other roles | Cost Management Reader, Contributor |
| 11 | Verify in Role assignments | Filter by Service Principal name |
| 12 | Test in application | Environment Switcher validation |

---

## 🎯 Minimum Required Roles

For different use cases:

### Basic Monitoring (Dashboard Only):
- ✅ **Reader**

### Full Monitoring with Costs:
- ✅ **Reader**
- ✅ **Cost Management Reader**

### Full Application (Including AI Agent):
- ✅ **Reader**
- ✅ **Cost Management Reader**
- ✅ **Contributor**

---

## 🔐 Security Best Practices

1. **Principle of Least Privilege**:
   - Start with Reader only
   - Add Cost Management Reader if needed
   - Only add Contributor when absolutely necessary

2. **Service Principal Security**:
   - Rotate Client Secrets regularly (recommended: every 6 months)
   - Never commit secrets to Git repositories
   - Use Azure Key Vault for production environments

3. **Monitoring**:
   - Enable Azure Activity Log to track Service Principal actions
   - Set up alerts for suspicious activities
   - Regularly review role assignments

4. **Role Scope**:
   - Consider assigning roles at Resource Group level instead of Subscription
   - This limits the blast radius if credentials are compromised

---

## 📞 Need Help?

If you're still having issues:

1. **Check Application Logs**:
   ```bash
   # Backend logs
   tail -f backend-*.log
   
   # Look for authentication errors
   grep -i "auth" backend-*.log
   ```

2. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for any error messages

3. **Contact Azure Support**:
   - Azure Portal → **Help + support**
   - Create a support ticket for RBAC issues

4. **Documentation**:
   - [Azure RBAC Documentation](https://docs.microsoft.com/en-us/azure/role-based-access-control/)
   - [Service Principal Permissions](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)

---

## ✅ Completion Checklist

Before closing this guide, ensure:

- [ ] You have Owner or User Access Administrator role
- [ ] Service Principal exists in Azure AD
- [ ] You have the correct Client ID, Tenant ID, Subscription ID
- [ ] Reader role assigned and verified
- [ ] Cost Management Reader role assigned and verified
- [ ] Contributor role assigned (if needed for AI Agent)
- [ ] All roles visible in Role assignments tab
- [ ] Validation successful in Environment Switcher
- [ ] Application can access Azure resources
- [ ] No error messages in application logs

---

## 🎉 Success!

If you completed all steps successfully:

✅ Your Service Principal now has the required permissions  
✅ Your Environment Switcher should work without errors  
✅ Your AI Agent can clone resources (if Contributor role added)  
✅ You can now use all application features  

**Next Steps**:
1. Test the Environment Switcher with your credentials
2. Try accessing the Dashboard to see your Azure resources
3. Use the AI Agent to discover and clone resource groups
4. Monitor costs in the Cost Management section

---

**Last Updated**: November 2025  
**Application**: Azure Monitor AI Assistant  
**Version**: 1.0


