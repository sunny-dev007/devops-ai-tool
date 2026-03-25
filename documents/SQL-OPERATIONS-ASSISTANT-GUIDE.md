# 🗄️ SQL Operations Assistant - Complete Guide

## ✨ Overview

The **SQL Operations Assistant** is a new AI-powered component that allows you to perform any Azure SQL Database operation using **natural language queries**. The AI generates executable Azure CLI scripts which you can review and execute directly from the UI.

---

## 🎯 Key Features

### 1. **Natural Language Script Generation**
- Ask in plain English: "Change password for SQL server myserver to NewPass123!"
- AI generates executable Azure CLI scripts automatically
- No need to remember command syntax

### 2. **Quick Action Templates**
- **Change Password**: Update SQL admin password securely
- **Add Firewall Rule**: Allow IP addresses instantly
- **Create Database**: Spin up new databases with one click
- **Enable Auditing**: Turn on security features

### 3. **AI Chat Assistant**
- Ask questions about SQL operations
- Get best practices and recommendations
- Troubleshoot issues interactively

### 4. **Visual SQL Server Management**
- See all your SQL servers at a glance
- View databases and firewall rules
- Select servers to auto-populate context

### 5. **Safe Script Execution**
- Review generated scripts before execution
- Hide/show passwords in scripts
- Real-time execution feedback
- Step-by-step progress tracking

---

## 📍 How to Access

### Option 1: Navigation Menu
1. Open the application at http://localhost:3000
2. Look for **"SQL Operations"** in the left sidebar (with Database icon 🗄️)
3. Click to open

### Option 2: Direct URL
Navigate to: **http://localhost:3000/sql-operations**

---

## 🚀 How to Use

### Method 1: Using Quick Actions (Easiest)

1. **Select your SQL Server** from the list
2. **Click a Quick Action button**:
   - Change Password
   - Add Firewall Rule
   - Create Database
   - Enable Auditing
3. **Review the generated script**
4. **Click "Execute Script"**
5. **Monitor progress** in the execution modal

### Method 2: Custom Natural Language Query

1. **Type your request** in the text area, for example:
   ```
   Change the admin password for SQL server 'azdevopsai-2666' 
   in resource group 'clone-M' to 'MyNewSecurePass123!'
   ```

2. **Click "Generate Azure CLI Script"**

3. **Review the generated script**:
   ```bash
   #!/bin/bash
   set -e

   RESOURCE_GROUP="clone-M"
   SQL_SERVER="azdevopsai-2666"
   NEW_PASSWORD="MyNewSecurePass123!"

   echo "Updating SQL server admin password..."
   az sql server update \
     --name "$SQL_SERVER" \
     --resource-group "$RESOURCE_GROUP" \
     --admin-password "$NEW_PASSWORD"
   
   if [ $? -eq 0 ]; then
     echo "SUCCESS: Password updated for $SQL_SERVER"
   else
     echo "ERROR: Failed to update password"
     exit 1
   fi
   ```

4. **Click "Execute Script"**

5. **Watch execution in real-time**:
   - See each command being run
   - View output and status
   - Get notified on completion

### Method 3: Using AI Chat

1. **Type a question** in the chat panel:
   ```
   How do I add my current IP to the firewall rules?
   ```

2. **Get AI guidance** with best practices

3. **Follow AI's instructions** or ask follow-up questions

---

## 💡 Example Use Cases

### 1. Change SQL Server Password

**Query:**
```
Change password for SQL server 'myserver' in resource group 'production-rg' to 'SecureP@ss2025!'
```

**Generated Script:**
```bash
az sql server update \
  --name myserver \
  --resource-group production-rg \
  --admin-password 'SecureP@ss2025!'
```

---

### 2. Add Firewall Rule for Your IP

**Query:**
```
Add a firewall rule named 'MyOfficeIP' to SQL server 'prod-sql' 
in resource group 'prod-rg' for IP address 203.0.113.5
```

**Generated Script:**
```bash
az sql server firewall-rule create \
  --name MyOfficeIP \
  --server prod-sql \
  --resource-group prod-rg \
  --start-ip-address 203.0.113.5 \
  --end-ip-address 203.0.113.5
```

---

### 3. Create a New Database

**Query:**
```
Create a new database named 'analytics-db' in SQL server 'data-sql' 
with Basic tier
```

**Generated Script:**
```bash
az sql db create \
  --name analytics-db \
  --server data-sql \
  --resource-group data-rg \
  --edition Basic \
  --service-objective Basic
```

---

### 4. Add Multiple Firewall Rules

**Query:**
```
Add firewall rules for SQL server 'app-sql' in 'app-rg':
- Office1: 198.51.100.10
- Office2: 198.51.100.20  
- VPN: 198.51.100.30
```

**Generated Script:**
```bash
az sql server firewall-rule create --name Office1 --server app-sql --resource-group app-rg --start-ip-address 198.51.100.10 --end-ip-address 198.51.100.10
az sql server firewall-rule create --name Office2 --server app-sql --resource-group app-rg --start-ip-address 198.51.100.20 --end-ip-address 198.51.100.20
az sql server firewall-rule create --name VPN --server app-sql --resource-group app-rg --start-ip-address 198.51.100.30 --end-ip-address 198.51.100.30
```

---

### 5. Enable Auditing

**Query:**
```
Enable auditing for SQL server 'secure-sql' with log retention of 90 days
```

**Generated Script:**
```bash
az sql server audit-policy update \
  --name secure-sql \
  --resource-group security-rg \
  --state Enabled \
  --retention-days 90
```

---

## 🔐 Security Features

### Password Protection
- **Show/Hide Toggle**: Click the eye icon to show or hide passwords in scripts
- **Default Hidden**: Passwords are hidden by default when displaying scripts
- **Secure Storage**: Passwords are never logged or stored in plain text

### Script Review
- **Always Review First**: Scripts are shown before execution
- **No Auto-Execution**: You must explicitly click "Execute" button
- **Step-by-Step Visibility**: See exactly what commands are running

### Azure Authentication
- Uses your configured Azure service principal
- All operations respect Azure RBAC permissions
- Automatic Azure CLI authentication before execution

---

## 📊 UI Components Explained

### Left Panel (60% width)
1. **SQL Servers List**: All your SQL servers with resource group and location
2. **Server Details**: Databases count and firewall rules count for selected server
3. **Operation Query**: Text area for your natural language request
4. **Quick Actions**: Pre-made buttons for common operations
5. **Generated Script**: The AI-generated executable script
6. **Execute Button**: Trigger script execution

### Right Panel (40% width)
1. **AI Chat Header**: Shows assistant status
2. **Chat Messages**: Conversation history with the AI
3. **Chat Input**: Type your questions here
4. **Send Button**: Submit your message

### Execution Modal
1. **Header**: Shows operation name and status
2. **Status Indicator**: Running/Completed/Failed with icons
3. **Execution Steps**: Detailed progress of each command
4. **Output**: Real-time command output
5. **Close Button**: Dismiss when done

---

## 🎨 Visual Indicators

| Icon | Meaning |
|------|---------|
| 🗄️ Database | SQL Operations section |
| 🔑 Key | Password operations |
| 🛡️ Shield | Firewall/Security operations |
| ➕ Plus | Create operations |
| ✨ Sparkles | AI features |
| ✅ Check | Success status |
| ⚠️ Alert | Warning or error |
| 🔄 Loader | Processing/Loading |

---

## 🚨 Error Handling

### Common Errors & Solutions

#### "Azure service not initialized"
**Solution**: Wait a few seconds and try again. The service is initializing.

#### "Failed to generate script"
**Solution**: 
- Check your query is clear and specific
- Ensure you included server name and resource group
- Try using a Quick Action template

#### "Execution failed: Authentication error"
**Solution**:
- Verify your Azure credentials in `.env`
- Ensure your service principal has sufficient permissions
- Run `az login` manually to test

#### "SQL server not found"
**Solution**:
- Double-check the server name spelling
- Verify the resource group name
- Ensure the server exists in your subscription

---

## 🛠️ Technical Details

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sql-operations/sql-servers` | GET | List all SQL servers |
| `/api/sql-operations/sql-servers/:rg/:server/databases` | GET | List databases for a server |
| `/api/sql-operations/sql-servers/:rg/:server/firewall-rules` | GET | List firewall rules |
| `/api/sql-operations/generate-script` | POST | Generate Azure CLI script from query |
| `/api/sql-operations/execute-script` | POST | Execute a script |
| `/api/sql-operations/execution/:sessionId` | GET | Get execution status |
| `/api/sql-operations/chat` | POST | Chat with AI assistant |

### Frontend Component
- **Path**: `/Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant/client/src/pages/SQLOperationsAssistant.js`
- **Route**: `/sql-operations`
- **Framework**: React with Framer Motion animations
- **Styling**: Tailwind CSS

### Backend Route
- **Path**: `/Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant/routes/sqlOperations.js`
- **API Base**: `/api/sql-operations`

---

## 🔧 Configuration

### Environment Variables Required
```env
# Azure Credentials (already configured)
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure OpenAI (for AI features)
AZURE_OPENAI_AGENT_ENDPOINT=your-openai-endpoint
AZURE_OPENAI_AGENT_KEY=your-openai-key
AZURE_OPENAI_AGENT_DEPLOYMENT=your-deployment-name
```

### Required Azure Permissions
Your service principal needs these roles:
- **Reader**: To list SQL servers and resources
- **Contributor**: To modify SQL servers (change password, firewall rules, etc.)
- **SQL DB Contributor**: For database operations

---

## 📝 Best Practices

### 1. Always Use Strong Passwords
```
✅ Good: 'MyS3cure!P@ssw0rd2025'
❌ Bad: 'password123'
```

### 2. Be Specific in Queries
```
✅ Good: "Change password for SQL server 'prod-sql' in resource group 'production-rg' to 'NewPass123!'"
❌ Bad: "change password"
```

### 3. Review Scripts Before Execution
- Always check the generated script
- Verify server names and resource groups
- Ensure parameters are correct

### 4. Use Quick Actions for Common Tasks
- Faster than typing queries
- Pre-validated syntax
- Context-aware (uses selected server)

### 5. Test with Non-Production First
- Try operations on dev/test servers first
- Verify scripts work as expected
- Then apply to production

---

## 🎯 Coming Soon (Future Enhancements)

1. **Bulk Operations**: Perform actions on multiple servers at once
2. **Scheduled Operations**: Schedule password rotations
3. **Operation History**: View and replay past operations
4. **Script Templates**: Save and reuse custom scripts
5. **Multi-Step Workflows**: Chain multiple operations together
6. **Backup/Restore**: Database backup and restore operations
7. **Performance Tuning**: AI-powered performance recommendations
8. **Cost Optimization**: Suggest tier/SKU optimizations

---

## ❓ FAQ

### Q: Can I execute any Azure CLI command?
**A**: Yes! The AI can generate scripts for any Azure SQL operation. Just describe what you want in natural language.

### Q: Are passwords secure?
**A**: Yes. Passwords are:
- Hidden by default in the UI
- Not logged to console
- Transmitted securely to Azure CLI
- Only visible when you click "Show"

### Q: What if I make a mistake?
**A**: You can:
- Review the script before execution
- Cancel if you notice an error
- Run a corrective script immediately

### Q: Can I use this for production?
**A**: Yes, but:
- Test on non-production first
- Always review generated scripts
- Ensure you have proper Azure permissions
- Follow your organization's change management process

### Q: Does this replace Azure Portal?
**A**: No, it complements it:
- Faster for common operations
- Great for automation
- Portal still needed for complex scenarios
- Use whichever is most convenient

---

## 🎉 Summary

The **SQL Operations Assistant** makes Azure SQL management **fast, easy, and safe**:

✅ **No CLI expertise required** - Use natural language  
✅ **AI-powered** - Smart script generation  
✅ **Visual interface** - See all your servers and operations  
✅ **Safe execution** - Review before running  
✅ **Real-time feedback** - Watch progress live  
✅ **Chat support** - Get help when needed  

---

## 🚀 Get Started Now!

1. **Open**: http://localhost:3000/sql-operations
2. **Select** a SQL server from the list
3. **Click** a Quick Action or type a custom query
4. **Review** the generated script
5. **Execute** and watch it work!

---

**🎊 That's it! You're now ready to manage Azure SQL databases with AI! 🎊**

Need help? Just ask the AI Assistant in the chat panel! 💬

