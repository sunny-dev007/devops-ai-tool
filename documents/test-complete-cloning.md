# Complete Cloning Test - Web App + SQL Database with Data

## Your Test Environment
- ✅ Web App
- ✅ App Service Plan
- ✅ SQL Server
- ✅ SQL Database with "users" table (with data)

## Target: Clone Everything with Data

---

## Step-by-Step Test Process

### 1. Open AI Agent Page
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Navigate to: http://localhost:3000/ai-agent

### 2. Select Your Source Resource Group
- Click the "Select Resource Group" dropdown
- Choose the resource group that contains your test environment

### 3. Enter Target Resource Group Name
- Enter a new name like: "my-app-clone-test"
- This will be created automatically

### 4. Discover Resources
- Click "Discover Resources" button
- Wait for resource discovery to complete
- Verify you see:
  * Web App
  * App Service Plan
  * SQL Server
  * SQL Database

### 5. Analyze with AI
- Click "Analyze with AI" button
- Wait for AI analysis
- Review the resource inventory

### 6. Generate Azure CLI Script
- Click the blue "Generate Azure CLI" button (with ✓ RECOMMENDED badge)
- Wait for script generation (15-30 seconds)
- Review the generated script

### 7. Review Script Content
- Click "📜 View Full Script" to expand
- Verify the script includes:
  * SQL Server creation with unique name
  * SQL Database copy command (az sql db copy)
  * App Service Plan creation
  * Web App creation
  * Configuration export/import
  * Connection string updates

### 8. Execute the Cloning
- Click "Execute Now" button
- Watch the execution modal
- Monitor progress in real-time

### 9. Expected Execution Steps
You should see:
1. Azure CLI authentication
2. Resource group creation
3. SQL Server creation (unique name with random suffix)
4. Firewall rule configuration
5. Database copy WITH DATA (this may take 2-5 minutes)
6. App Service Plan creation
7. Web App creation
8. Configuration export
9. Configuration import
10. Connection string updates

### 10. Verify Success
After execution completes:
- Note the SQL Admin Password (displayed in output)
- Note the new SQL Server name
- Note the new Web App URL

---

## Expected Output Example

```
=== Creating SQL Server ===
Generated unique SQL Server name: sqlserver24718
Creating SQL Server sqlserver24718...
SUCCESS: SQL Server created
IMPORTANT: SQL Admin Password: P@ssw0rd247181731234567 (SAVE THIS!)

=== Configuring Firewall ===
Firewall rule created successfully

=== Copying Database WITH ALL DATA ===
Copying database from original-server to sqlserver24718...
This may take several minutes...
SUCCESS: Database copied with ALL data!

=== Creating App Service Plan ===
App Service Plan created successfully

=== Creating Web App ===
Web app mywebapp-24718 created

=== Importing Configuration ===
App settings imported: 23 settings
Connection strings updated to point to NEW SQL server

=== CLONING COMPLETE ===
New SQL Server: sqlserver24718.database.windows.net
New Database: database24718
New Web App: https://mywebapp-24718.azurewebsites.net
```

---

## Verification Checklist

After cloning completes:

### ✅ Azure Portal Verification
1. Open Azure Portal
2. Navigate to target resource group
3. Verify all resources are present:
   - [ ] SQL Server (with unique name)
   - [ ] SQL Database
   - [ ] App Service Plan
   - [ ] Web App

### ✅ Database Data Verification
1. Connect to new SQL Server using SQL Server Management Studio or Azure Portal Query Editor
2. Credentials:
   - Server: <new-sql-server-name>.database.windows.net
   - Database: <new-database-name>
   - User: sqladmin
   - Password: <from execution output>
3. Run query: `SELECT * FROM users`
4. Verify data matches original database

### ✅ Web App Verification
1. Open new Web App URL (from execution output)
2. Verify app loads
3. Test database connectivity (if app has UI for this)
4. Check app settings in Azure Portal

### ✅ Connection String Verification
1. In Azure Portal, open the new Web App
2. Go to Configuration → Connection strings
3. Verify connection strings point to NEW SQL Server
4. Connection string should contain: <new-sql-server-name>.database.windows.net

---

## Common Issues & Solutions

### Issue 1: Database Copy Takes Long Time
- **Normal**: Large databases can take 10-30 minutes
- **Solution**: Be patient, monitor Azure Portal for progress

### Issue 2: Web App Shows 500 Error
- **Cause**: Connection string not updated correctly
- **Solution**: Manually verify connection string in Azure Portal

### Issue 3: SQL Server Firewall Blocking
- **Cause**: Your IP not in firewall rules
- **Solution**: Add your IP in Azure Portal → SQL Server → Firewalls and virtual networks

### Issue 4: Authentication Error During Execution
- **Cause**: Azure CLI session expired
- **Solution**: Script auto-authenticates with service principal

---

## Troubleshooting Commands

If you need to verify manually:

```bash
# Check if SQL Server was created
az sql server show --name <new-server-name> --resource-group <target-rg>

# Check if database was created
az sql db show --name <new-db-name> --server <new-server-name> --resource-group <target-rg>

# Check if web app was created
az webapp show --name <new-webapp-name> --resource-group <target-rg>

# List all resources in target RG
az resource list --resource-group <target-rg> --output table
```

---

## Success Criteria

✅ Target resource group created  
✅ SQL Server created with unique name  
✅ SQL Database copied WITH data  
✅ Users table exists in new database  
✅ User data matches original (row count and content)  
✅ App Service Plan created  
✅ Web App created  
✅ Web App configuration imported  
✅ Connection strings point to NEW SQL Server  
✅ Web App loads successfully  

---

## Next Steps After Successful Test

1. Take screenshots for DevOps presentation
2. Document any issues encountered
3. Note execution time for each step
4. Clean up test resources if needed:
   ```bash
   az group delete --name <target-rg> --yes --no-wait
   ```

