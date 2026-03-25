# 🗺️ Azure Portal Navigation Map for Role Assignment

## Visual Guide to Finding Everything You Need

---

## 🏠 Starting Point: Azure Portal Home

```
┌────────────────────────────────────────────────────────────┐
│  Microsoft Azure                                  [Profile] │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  [🔍 Search resources, services, and docs...]               │
│      Type "Subscriptions" here                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Recent     │  │  All         │  │  Favorites   │    │
│  │  Resources   │  │ Services     │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## 📍 Step 1: Navigate to Subscriptions

### Option A: Using Search Bar
```
Top center search bar:
┌─────────────────────────────────────────┐
│ 🔍 Subscriptions                        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ 📊 Subscriptions (Service)              │ ← Click this
│ 📄 Subscription (Documentation)         │
│ 🏢 Subscription Management              │
└─────────────────────────────────────────┘
```

### Option B: Using Left Menu
```
Left sidebar → All services → Categories:
┌────────────────────────────┐
│ ☰ All services             │
│   ├─ Analytics             │
│   ├─ Compute               │
│   ├─ Databases             │
│   ├─ General               │
│   │  └─ Subscriptions  ←   │ Click here
│   ├─ Identity              │
│   └─ Management            │
└────────────────────────────┘
```

---

## 📍 Step 2: Subscriptions Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Subscriptions                                       [+ Add]   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [🔍 Filter subscriptions...]                                  │
│                                                                │
│ ┌────────────────────────────────────────────────────┐      │
│ │ Name                    │ Subscription ID          │      │
│ ├────────────────────────────────────────────────────┤      │
│ │ 📋 Pay-As-You-Go       │ 5588ec4e-3711...        │  ← Click│
│ │ 💼 Visual Studio       │ 892a27f1-3f34...        │      │
│ │ 🆓 Free Trial          │ 7bb01aac763e...         │      │
│ └────────────────────────────────────────────────────┘      │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📍 Step 3: Inside Your Subscription

```
┌──────────────────────────────────────────────────────────────┐
│ Pay-As-You-Go                                                 │
├──────────────────────────────────────────────────────────────┤
│ Left Menu                    │ Main Content Area             │
│                              │                                │
│ 📊 Overview                  │ Subscription details          │
│ 📈 Activity log              │ Subscription ID: 5588ec4e...  │
│ 🔐 Access control (IAM)  ←   │ Status: Active                │
│ 📝 Tags                      │ Created: Jan 2024             │
│ 🔧 Diagnose and solve       │                                │
│ 💰 Cost Management           │                                │
│ 📦 Resource groups           │                                │
│ 🔍 Resources                 │                                │
│ ⚙️  Settings                 │                                │
│                              │                                │
└──────────────────────────────────────────────────────────────┘
        │
        │ Click "Access control (IAM)"
        ↓
```

---

## 📍 Step 4: Access Control (IAM) Page

```
┌──────────────────────────────────────────────────────────────┐
│ Pay-As-You-Go | Access control (IAM)                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [+ Add ▼]  [Check access]  [View]  [Refresh]                │
│    └─ Add role assignment  ← Click this                      │
│    └─ Add co-administrator                                   │
│    └─ Add deny assignment                                    │
│                                                                │
│ ┌────────┬─────────────────┬──────────┬───────────┐         │
│ │ Check  │ Role            │ Deny     │ Classic   │         │
│ │ access │ assignments  ←  │assignments│administrators│      │
│ └────────┴─────────────────┴──────────┴───────────┘         │
│                                                                │
│ Current role assignments:                                     │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Name               │ Role          │ Type         │         │
│ ├──────────────────────────────────────────────────┤         │
│ │ John Doe           │ Owner         │ User         │         │
│ │ Jane Smith         │ Contributor   │ User         │         │
│ │ Your-App-Name      │ Reader        │ Service Prin │         │
│ └──────────────────────────────────────────────────┘         │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📍 Step 5: Add Role Assignment Wizard

### Tab 1: Role
```
┌──────────────────────────────────────────────────────────────┐
│ Add role assignment                                [X]        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [  Role  ] [  Members  ] [  Conditions  ] [ Review + assign ]│
│   ↑ You are here                                              │
│                                                                │
│ Select a role:                                                │
│ [🔍 Search by name or description...]                         │
│                                                                │
│ ┌────────────────────────────────────────────────────┐       │
│ │ 📋 Reader                                          │  ← Select│
│ │    Grants full access to view all resources,      │       │
│ │    but does not allow you to make any changes.    │       │
│ │                                                     │       │
│ │ 💰 Cost Management Reader                         │       │
│ │    View cost and usage data for Azure             │       │
│ │    subscriptions and resource groups.             │       │
│ │                                                     │       │
│ │ ✏️ Contributor                                     │       │
│ │    Grants full access to manage all resources,    │       │
│ │    but does not allow you to assign roles...      │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│                           [Cancel]  [Next >]                  │
└──────────────────────────────────────────────────────────────┘
```

### Tab 2: Members
```
┌──────────────────────────────────────────────────────────────┐
│ Add role assignment                                [X]        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [  Role  ] [  Members  ] [  Conditions  ] [ Review + assign ]│
│              ↑ You are here                                   │
│                                                                │
│ Assign access to:                                             │
│ ⦿ User, group, or service principal                           │
│ ○ Managed identity                                            │
│ ○ Privileged administrator roles (Preview)                    │
│                                                                │
│ Members (0 selected)                                          │
│ [+ Select members]  ← Click this                             │
│                                                                │
│ ┌─────────────────────────────────────────────────┐          │
│ │ No members selected                              │          │
│ └─────────────────────────────────────────────────┘          │
│                                                                │
│                           [< Previous]  [Next >]              │
└──────────────────────────────────────────────────────────────┘
```

### Member Selection Panel
```
┌──────────────────────────────────────────────────────────────┐
│ Select members                                     [X]        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [🔍 1f16c4c4-8c61-4083-bda0-b5cd4f847dff]                    │
│     Paste your Client ID here                                 │
│                                                                │
│ Search results:                                               │
│ ┌────────────────────────────────────────────────────┐       │
│ │ ☑️  azure-monitor-ai-assistant                    │  ← Click│
│ │     Application                                    │       │
│ │     1f16c4c4-8c61-4083-bda0-b5cd4f847dff          │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│ Selected members (1):                                         │
│ • azure-monitor-ai-assistant                                 │
│                                                                │
│                           [Cancel]  [Select]                  │
└──────────────────────────────────────────────────────────────┘
```

### Tab 3: Review + Assign
```
┌──────────────────────────────────────────────────────────────┐
│ Add role assignment                                [X]        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [  Role  ] [  Members  ] [  Conditions  ] [ Review + assign ]│
│                                             ↑ You are here     │
│                                                                │
│ Review + assign                                               │
│                                                                │
│ ┌────────────────────────────────────────────────────┐       │
│ │ Basics                                             │       │
│ │ ─────────────────────────────────────────────────  │       │
│ │ Role:          Reader                              │       │
│ │ Scope:         Subscription                        │       │
│ │                Pay-As-You-Go                       │       │
│ │                                                     │       │
│ │ Members                                            │       │
│ │ ─────────────────────────────────────────────────  │       │
│ │ Name:          azure-monitor-ai-assistant         │       │
│ │ Type:          Service Principal                   │       │
│ │                                                     │       │
│ │ Conditions                                         │       │
│ │ ─────────────────────────────────────────────────  │       │
│ │ Conditions:    None                                │       │
│ └────────────────────────────────────────────────────┘       │
│                                                                │
│                   [< Previous]  [Review + assign]  ← Click   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📍 Step 6: Success Confirmation

```
┌──────────────────────────────────────────────────────────────┐
│ Notifications                                      [X]        │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ ✅ Added role assignment                                      │
│                                                                │
│ Role:               Reader                                    │
│ Scope:              Subscription / Pay-As-You-Go             │
│ Member:             azure-monitor-ai-assistant               │
│                                                                │
│ 2 minutes ago                                                 │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📍 Step 7: Verify Role Assignments

Back in Access control (IAM) → Role assignments tab:

```
┌──────────────────────────────────────────────────────────────┐
│ Pay-As-You-Go | Access control (IAM)                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ [Check access]  [Role assignments]  [Deny assignments]       │
│                      ↑ Click this tab                         │
│                                                                │
│ [🔍 Filter by name or type...]                                │
│     Type your Service Principal name                          │
│                                                                │
│ Role assignments:                                             │
│ ┌──────────────────────────────────────────────────┐         │
│ │ Name                    │ Role           │ Scope  │         │
│ ├──────────────────────────────────────────────────┤         │
│ │ azure-monitor-ai-       │ Reader         │ This   │ ✅     │
│ │ assistant               │                │ resource│        │
│ │                         │                │         │        │
│ │ azure-monitor-ai-       │ Cost Mgmt      │ This   │ ✅     │
│ │ assistant               │ Reader         │ resource│        │
│ │                         │                │         │        │
│ │ azure-monitor-ai-       │ Contributor    │ This   │ ✅     │
│ │ assistant               │                │ resource│        │
│ └──────────────────────────────────────────────────┘         │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Alternative Path: Finding Service Principal via Azure Active Directory

If you can't find your Service Principal in the role assignment search:

```
┌─────────────────────────────────────────────────┐
│ Azure Portal Home                                │
│   ↓                                              │
│ [🔍 Azure Active Directory]                      │
│   ↓                                              │
│ Left Menu: App registrations                     │
│   ↓                                              │
│ [All applications] tab                           │
│   ↓                                              │
│ [🔍 Search by Client ID]                         │
│   ↓                                              │
│ Click on your app                                │
│   ↓                                              │
│ Copy "Display name"                              │
│   ↓                                              │
│ Use this name in role assignment search          │
└─────────────────────────────────────────────────┘
```

Detailed Azure AD path:

```
Azure Portal
  └── Azure Active Directory
      └── Manage
          └── App registrations
              ├── Owned applications
              └── All applications  ← Switch to this tab
                  └── [🔍 Search applications...]
                      └── Enter Client ID: 1f16c4c4-8c61...
                          └── Your App
                              ├── Overview
                              │   ├── Display name
                              │   ├── Application (client) ID
                              │   └── Directory (tenant) ID
                              ├── Certificates & secrets
                              └── API permissions
```

---

## 🎯 Quick Navigation Paths

### Path 1: Fast Role Assignment (Most Direct)
```
Portal → Search "Subscriptions" → Select subscription → 
Access control (IAM) → + Add → Add role assignment
```

### Path 2: Verification Path
```
Portal → Search "Subscriptions" → Select subscription → 
Access control (IAM) → Role assignments tab → Filter by name
```

### Path 3: Service Principal Info
```
Portal → Azure Active Directory → App registrations → 
All applications → Search Client ID → View details
```

---

## 📱 Mobile/Responsive View Tips

If using Azure Portal on mobile or narrow screen:

1. **Hamburger Menu** (☰) - Top left to access all menus
2. **Search First** - Use search instead of menu navigation
3. **Back Button** - Top left to go back in hierarchy
4. **Notifications** - Bell icon (top right) for confirmations

---

## 🎨 Color Coding in Azure Portal

Understanding Azure Portal visual cues:

| Color | Meaning |
|-------|---------|
| 🔵 Blue | Primary actions (Next, Assign, etc.) |
| ⚪ White | Secondary actions (Cancel, Back) |
| 🟢 Green | Success notifications |
| 🔴 Red | Error messages |
| 🟡 Yellow | Warnings |
| ⚫ Gray | Disabled actions |

---

## 🔍 Search Tips

In Azure Portal search bar, you can search for:

1. **Services**: Type exact service name
   - `Subscriptions`
   - `Azure Active Directory`
   - `Cost Management`

2. **Resources**: Type resource name or ID
   - `my-storage-account`
   - `my-web-app`

3. **Documentation**: Type keywords
   - `RBAC roles`
   - `Service principal`

4. **Recent**: Shows your recently accessed items

---

## 💡 Pro Tips

1. **Bookmark frequently used pages**
   - Click ⭐ (star icon) next to page title
   - Access via "Favorites" on home page

2. **Use keyboard shortcuts**
   - `G` then `N` - Open notifications
   - `/` - Focus search bar
   - `?` - Show keyboard shortcuts

3. **Pin to dashboard**
   - Click 📌 (pin icon) on any resource
   - Quick access from Portal home

4. **Multiple tabs**
   - Open multiple Azure Portal tabs
   - Compare different subscriptions/resources

---

## 📞 Need Help?

If you get lost:

1. Click **Microsoft Azure** logo (top left) - Returns to home
2. Use **breadcrumb trail** at top - Shows your path
3. Check **notifications** (bell icon) - See recent actions
4. Access **help** (?) - Top right corner

---

**🎉 You now have a complete map of Azure Portal for role assignments!**

Use this alongside:
- **[Detailed Manual Guide](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)** - Step-by-step instructions
- **[Quick Reference](./QUICK-ROLE-ASSIGNMENT-STEPS.md)** - 5-minute visual guide

