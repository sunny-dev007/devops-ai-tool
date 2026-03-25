# 🚀 Quick Test Guide - Complete Cloning

## 🎯 Your Test Setup
✅ **Source Resource Group**: (contains)
- Web App
- App Service Plan  
- SQL Server
- SQL Database with "users" table + data

✅ **Target**: Clone everything to new resource group

---

## 📋 Quick Steps (5 minutes)

### 1️⃣ Open Browser
```
http://localhost:3000/ai-agent
```
- Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

### 2️⃣ Select Source RG
- Dropdown → Choose your resource group

### 3️⃣ Enter Target Name
- Example: `my-app-clone-test`

### 4️⃣ Discover → Analyze → Generate CLI
- **Discover Resources** (10 sec)
- **Analyze with AI** (15 sec)
- **Generate Azure CLI** (blue button, 20 sec)

### 5️⃣ Execute
- Click **"Execute Now"**
- Watch real-time progress
- **WAIT 5-10 minutes** (database copy takes time!)

---

## ✅ What Gets Cloned

| Resource | Cloning Method | Data Included |
|----------|----------------|---------------|
| SQL Server | New with unique name | N/A |
| SQL Database | `az sql db copy` | ✅ **ALL DATA** |
| Users Table | Copied automatically | ✅ **ALL ROWS** |
| App Service Plan | New with same SKU | N/A |
| Web App | New + config import | ✅ **Settings** |
| Connection Strings | Updated automatically | ✅ **Points to new DB** |

---

## 🔍 Key Things to Watch

### During Execution:
1. **SQL Server Creation** → Unique name with random suffix
2. **Database Copy** → Takes 2-5 minutes (normal!)
3. **SQL Admin Password** → SAVE THIS! Displayed in output
4. **Web App URL** → New URL displayed at end

### After Completion:
1. **Azure Portal** → Verify all resources in target RG
2. **SQL Query** → Run `SELECT * FROM users` in new database
3. **Web App** → Open new URL, test functionality
4. **Connection String** → Verify points to NEW SQL server

---

## 🎬 Expected Timeline

| Step | Time | Status Indicator |
|------|------|------------------|
| Azure CLI Auth | 10s | "Authenticating..." |
| Create SQL Server | 30s | "Creating SQL Server..." |
| Configure Firewall | 5s | "Configuring firewall..." |
| **Copy Database** | **2-5min** | "Copying database WITH ALL DATA..." |
| Create App Plan | 20s | "Creating App Service Plan..." |
| Create Web App | 30s | "Creating web app..." |
| Import Config | 10s | "Importing configuration..." |
| Update Conn Strings | 5s | "Updating connection strings..." |
| **TOTAL** | **~5-7min** | "CLONING COMPLETE" |

---

## 💾 Save This Info

After execution completes, you'll see:

```
=== CLONING COMPLETE ===
New SQL Server: sqlserver24718.database.windows.net
New Database: database24718
New Web App: https://mywebapp-24718.azurewebsites.net
SQL Admin Password: P@ssw0rd247181731234567
```

**📝 Write down:**
- [ ] SQL Server name
- [ ] SQL Admin Password
- [ ] Database name
- [ ] Web App URL

---

## 🔧 Verify Data Copied

### Azure Portal Query Editor:
1. Go to Azure Portal
2. Find new SQL Database
3. Click "Query editor"
4. Login with:
   - **User**: `sqladmin`
   - **Password**: (from output above)
5. Run:
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT * FROM users;
   ```
6. **Compare with original database** → Should match exactly!

---

## ⚠️ Important Notes

✅ **Database copy is AUTOMATIC** - No manual steps needed  
✅ **Data is preserved** - Schema + all rows  
✅ **Connection strings updated** - Web app points to new DB  
✅ **Unique names** - No conflicts with original  
✅ **Original resources untouched** - Safe operation  

❌ **Don't panic if it takes 5+ minutes** - Database copy is slow for large data  
❌ **Don't close browser during execution** - Let it complete  
❌ **Don't forget to save SQL password** - You'll need it later  

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Execution taking too long" | Normal for database copy - wait 10 min |
| "Authentication failed" | Script auto-authenticates, wait for retry |
| "Resource already exists" | Use different target RG name |
| "Web app shows error" | Check connection string in Azure Portal |
| "Can't connect to SQL" | Add your IP to firewall rules |

---

## 🎉 Success = All Green

- [x] Target RG created in Azure
- [x] SQL Server with unique name
- [x] SQL Database copied
- [x] `SELECT * FROM users` returns data
- [x] App Service Plan created
- [x] Web App created and accessible
- [x] Connection string points to new DB
- [x] Web app loads without errors

---

## 🧹 Cleanup (After Testing)

```bash
# Delete target resource group when done testing
az group delete --name my-app-clone-test --yes --no-wait
```

**Note**: This deletes ALL cloned resources. Original resources are safe.

---

## 📸 For DevOps Presentation

**Screenshot these:**
1. AI Agent page with resource list
2. Generated script content
3. Execution modal showing progress
4. Azure Portal with cloned resources
5. SQL Query Editor showing data
6. Web app running at new URL

**Demo flow (5 minutes):**
1. Select source RG → Discover (30s)
2. Generate script → Review (1min)
3. Execute → Show progress (3min)
4. Verify in Portal → Show data (1min)

---

🚀 **Ready? Let's test it now!**

Open: http://localhost:3000/ai-agent
