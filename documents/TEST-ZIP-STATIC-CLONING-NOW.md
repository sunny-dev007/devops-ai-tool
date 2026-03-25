# 🧪 Quick Test Guide: ZIP-Static Web App Cloning

## ⚡ 5-Minute Test (Your Hello World App)

---

## 🎯 What You're Testing

Cloning your **hello-world-static-1763324087** Next.js app to a new resource group.

### Expected Result:
✅ New web app created with unique name  
✅ All content copied (including web.config)  
✅ New URL opens and shows "Hello World"  
✅ Same functionality as original  

---

## 📋 Test Steps

### Step 1: Open AI Agent
```
1. Start your backend server (if not running):
   cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant
   node server.js

2. Open browser: http://localhost:3001

3. Navigate to: "AI Agent" section → "Cloning" tab
```

---

### Step 2: Configure Cloning

```
Source Resource Group:
┌──────────────────────────────────────┐
│ hello-world-nextjs-rg           [▼] │
└──────────────────────────────────────┘

Target Resource Group:
┌──────────────────────────────────────┐
│ hello-world-clone-test-rg       [▼] │  ← Create new or select existing
└──────────────────────────────────────┘

Resources to Clone:
☑️ hello-world-static-1763324087 (Web App)
```

---

### Step 3: Start Cloning

Click: **"Clone Selected Resources"** button

---

### Step 4: Watch the Magic ✨

**Expected Console Output:**
```bash
🔍 Discovering resources in source resource group...
✅ Found 1 web app(s)

📦 Analyzing web app: hello-world-static-1763324087
   📋 Fetching web app config...
   📦 No source control found - likely ZIP deployment
   ⚙️ web.config detected - Windows IIS static site
   ✅ Detected ZIP-deployed static site on Windows IIS

✅ Deployment type detected: zip-static
   Type: zip
   Platform: windows
   Has web.config: true
   Deployment method: config-zip

🤖 Generating Azure CLI script...
   📝 CASE D: ZIP-STATIC DEPLOYMENT
   📥 Content download enabled
   📤 ZIP deployment enabled

🚀 Executing cloning script...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: Creating web app shell...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Web app created: hello-world-clone-1700123456

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2: Getting deployment credentials...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Credentials retrieved

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3: Downloading content from source...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Downloading: https://hello-world-static-1763324087.scm.azurewebsites.net/api/zip/site/wwwroot/
✅ Content downloaded: 1.2 MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4: Extracting and re-packaging...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Extracted 45 files
✅ Created deploy.zip

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: Deploying to target web app...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 Uploading deploy.zip...
✅ Deployment successful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 6: Restarting target web app...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Web app restarted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 7: Cleanup...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Temporary files removed

🎉 CLONING COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Original: https://hello-world-static-1763324087.azurewebsites.net
Clone:    https://hello-world-clone-1700123456.azurewebsites.net
```

---

### Step 5: Verify the Clone

**1. Open the clone URL** (shown in output):
```
https://hello-world-clone-{timestamp}.azurewebsites.net
```

**2. Expected Result:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              Hello World                        │
│                                                 │
│   Welcome to your Next.js app deployed         │
│   on Azure!                                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**3. Verify it matches the original:**
```
Original: https://hello-world-static-1763324087.azurewebsites.net
Clone:    https://hello-world-clone-{timestamp}.azurewebsites.net
```

Both should look identical! ✅

---

## ✅ Success Criteria

| Check | Expected Result |
|-------|-----------------|
| ✅ Clone URL opens | Should load within 5-10 seconds |
| ✅ Content matches | Same HTML/CSS/JS as original |
| ✅ Title is correct | "Hello World" |
| ✅ Styling works | CSS loaded properly |
| ✅ No 404 errors | All assets found |
| ✅ web.config preserved | URL rewriting works |

---

## 🐛 Troubleshooting

### Issue 1: Clone URL shows "Service Unavailable"
**Solution:** Wait 30 seconds for web app to warm up, then refresh

### Issue 2: Clone URL shows "Directory Listing"
**Solution:** Check if web.config was preserved (likely not - report as bug)

### Issue 3: "No source control found" not appearing
**Solution:** The detection still works! This is just a log message

### Issue 4: Deployment hangs at "Downloading content"
**Possible Causes:**
- Large file size (wait longer)
- Network timeout (retry)
- SCM site not accessible (check firewall)

### Issue 5: "Deployment credentials not found"
**Solution:** 
```bash
# Manually reset deployment credentials in Azure Portal:
az webapp deployment user set \
  --user-name "{your-username}" \
  --password "{secure-password}"
```

---

## 📊 What to Check in Azure Portal

### 1. Target Resource Group
```
Navigate: Resource Groups → hello-world-clone-test-rg
Expected: New web app listed with unique name
```

### 2. Web App Configuration
```
Navigate: Web App → Configuration
Expected:
- No runtime stack (empty)
- No container settings
- Platform: Windows
```

### 3. Kudu Console
```
Navigate: Web App → Development Tools → Advanced Tools → Go
Then: Debug console → CMD → site → wwwroot

Expected Files:
✅ index.html
✅ web.config
✅ _next/ directory
✅ All static assets
```

---

## 🎯 Quick Validation Commands

```bash
# Check if clone web app exists
az webapp show \
  --name hello-world-clone-{timestamp} \
  --resource-group hello-world-clone-test-rg

# Check clone URL status
curl -I https://hello-world-clone-{timestamp}.azurewebsites.net

# Expected: HTTP/1.1 200 OK

# Check if web.config exists
curl https://hello-world-clone-{timestamp}.scm.azurewebsites.net/api/vfs/site/wwwroot/web.config \
  --user "$USERNAME:$PASSWORD"

# Expected: XML content of web.config
```

---

## 🚨 If Test Fails

**Please report with:**

1. **Console output** (copy entire output from UI)
2. **Browser console errors** (F12 → Console tab)
3. **Clone URL** (the generated URL)
4. **Error message** (if any)

**Where to report:**
- Create an issue in the project
- Or directly in this chat window

---

## ✅ Test Passed? What's Next?

1. **Try cloning to different resource groups**
2. **Test with other static web apps** (if you have any)
3. **Verify existing cloning still works** (runtime-based apps, containers)
4. **Use in production** with confidence! 🚀

---

## 🎉 Expected Timeline

| Phase | Duration | What's Happening |
|-------|----------|------------------|
| Discovery | 5-10 sec | Fetching resource info from Azure |
| Detection | 2-5 sec | Checking web app type |
| Script Generation | 3-5 sec | AI creates CLI script |
| Web App Creation | 30-60 sec | Azure provisions new web app |
| Content Download | 10-30 sec | Downloads from source via Kudu |
| ZIP Creation | 2-5 sec | Re-packages content |
| Deployment | 30-60 sec | Uploads and deploys ZIP |
| Restart | 10-20 sec | Restarts target web app |
| **TOTAL** | **~2-4 min** | End-to-end cloning |

---

**Ready to test? Let's clone your Hello World app! 🚀**

