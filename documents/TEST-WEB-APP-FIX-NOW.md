# 🧪 Test Web App Fix - Quick Guide (2 Minutes)

## 🎯 What Was Fixed

**Before**: AI was mixing `--runtime` with `--multicontainer-*` and adding `--vnet-route-all-enabled` ❌
**After**: AI MUST detect type FIRST and use ONLY allowed parameters per type ✅

---

## ✅ Quick Test

### **Step 1: Open AI Agent**
```
http://localhost:3000/ai-agent
```

### **Step 2: Start Cloning**
- **Source**: Resource group with a web app
- **Target**: Any name (e.g., `webapp-test-rg`)
- Click **"Discover Resources"**

### **Step 3: Check Discovery Logs**

Open backend logs:
```bash
tail -f backend-webapp-type-aware-strict.log
```

**Look for**:
```
🔍 Detecting Web App type for: <your-webapp-name>
✅ Web App type detected: runtime
   Details: {
     "deploymentType": "runtime",
     "deploymentDetails": {
       "runtime": "node|22-lts",
       "type": "node"
     }
   }
```

**Expected**: Clear deployment type (`runtime`, `single-container`, or `multi-container-compose`)

### **Step 4: Generate Script**

Click **"Analyze with AI"** → **"Confirm"** → **"Generate Azure CLI"**

### **Step 5: 🚨 CRITICAL CHECKS**

**Check 1: No Forbidden Parameters**

Scan the script for these **FORBIDDEN** parameters:
- ❌ `--vnet-route-all-enabled` → Should NOT appear
- ❌ `--no-wait` (for webapp create) → Should NOT appear
- ❌ `--deployment-local-git` (with runtime/container) → Should NOT appear

**If ANY of these appear**: ❌ **FIX FAILED** - Report immediately

**Check 2: Type-Aware Logic**

Look for this pattern:
```bash
DEPLOYMENT_TYPE="runtime"  # (or "single-container" or "multi-container-compose")
echo "Source deployment type: $DEPLOYMENT_TYPE"

if [[ "$DEPLOYMENT_TYPE" == "runtime" ]]; then
  az webapp create \
    --name "$WEB_APP_NAME" \
    --resource-group "$TARGET_RG" \
    --plan "$APP_PLAN_NAME" \
    --runtime "node|22-lts"
fi
```

**If pattern is missing**: ❌ **FIX FAILED** - Report immediately

**Check 3: No Parameter Mixing**

Search the script for these **CONFLICTS**:
- ❌ `--runtime` + `--deployment-container-image-name` → NEVER TOGETHER!
- ❌ `--runtime` + `--multicontainer-config-type` → NEVER TOGETHER!

**If ANY conflict found**: ❌ **FIX FAILED** - Report immediately

### **Step 6: Execute Script**

Click **"Execute Now"**

**Expected Output**:
```
Creating RUNTIME-BASED web app...
Using runtime: node|22-lts
✓ Web app 'webapp-name-12345' created successfully!
✓ Web app URL: https://webapp-name-12345.azurewebsites.net
```

**Expected**: NO warnings, NO errors!

---

## 🔍 What to Look For

### **✅ SUCCESS Indicators**:

1. **Discovery Logs**:
   ```
   ✅ Web App type detected: runtime
   ```

2. **Generated Script**:
   ```bash
   DEPLOYMENT_TYPE="runtime"
   if [[ "$DEPLOYMENT_TYPE" == "runtime" ]]; then
     az webapp create --name X --resource-group Y --plan Z --runtime "node|22-lts"
   fi
   ```

3. **No Forbidden Params**:
   - ❌ No `--vnet-route-all-enabled`
   - ❌ No `--no-wait` for webapp create
   - ❌ No parameter mixing

4. **Execution Output**:
   ```
   ✓ Web app created successfully!
   ✓ NO "vnet_route_all_enabled" warning!
   ✓ NO "multicontainer" error!
   ```

### **❌ FAILURE Indicators**:

1. **Script has forbidden params**:
   ```bash
   az webapp create --name X --vnet-route-all-enabled true  ← FAIL!
   ```

2. **Script mixes parameters**:
   ```bash
   az webapp create --name X --runtime "node|22-lts" --multicontainer-config-type compose  ← FAIL!
   ```

3. **Execution shows error**:
   ```
   WARNING: vnet_route_all_enabled is not a known attribute  ← FAIL!
   ERROR: Please specify both --multicontainer-config-type...  ← FAIL!
   ```

---

## 🐛 If Still Failing

If you still see errors:

### **1. Check Discovery**

```bash
tail -n 100 backend-webapp-type-aware-strict.log | grep "Detecting Web App type"
```

**Expected**:
```
🔍 Detecting Web App type for: <webapp-name>
✅ Web App type detected: runtime
```

**If missing**: Discovery might have failed, check for errors

### **2. Check Script Generation**

Open the generated script and search for:
- `DEPLOYMENT_TYPE=` → Should be present with correct value
- `if [[ "$DEPLOYMENT_TYPE" ==` → Should have type-aware logic

**If missing**: AI is not following the new prompt, restart backend

### **3. Restart Backend**

```bash
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant
pkill -9 -f "node.*server.js"
npm start
```

Wait 10 seconds, then try again from Step 1

---

## 📸 Share These Screenshots

Please share screenshots of:

1. **Backend Discovery Logs** (showing detected type)
2. **Generated Script** (showing type-aware if-then-else logic)
3. **Execution Output** (showing success or error)

So I can verify the fix is working!

---

## 🎯 Expected Result

After successful test:

### **Generated Script**:
```bash
#!/bin/bash

# Variables
SOURCE_WEBAPP_NAME="nitor-devops-webapp"
DEPLOYMENT_TYPE="runtime"  # ← Detected from webAppConfig

WEB_APP_NAME="nitor-devops-webapp-$RANDOM"
echo "Source deployment type: $DEPLOYMENT_TYPE"

# Type-aware creation
if [[ "$DEPLOYMENT_TYPE" == "runtime" ]]; then
  echo "Creating RUNTIME-BASED web app..."
  RUNTIME="node|22-lts"
  az webapp create \
    --name "$WEB_APP_NAME" \
    --resource-group "$TARGET_RG" \
    --plan "$APP_PLAN_NAME" \
    --runtime "$RUNTIME"
  # NO forbidden params!
  # NO container params!
  # NO vnet params!
fi

# Verify
az webapp show --name "$WEB_APP_NAME" --resource-group "$TARGET_RG"
```

### **Execution**:
```
Creating RUNTIME-BASED web app...
Using runtime: node|22-lts
✓ Web app 'nitor-devops-webapp-18472' created successfully!
✓ Web app URL: https://nitor-devops-webapp-18472.azurewebsites.net
✓ NO WARNINGS!
✓ NO ERRORS!
```

---

**Status**:
- ✅ Server Running
- ✅ Ultra-Strict Type-Aware Rules Active
- ✅ Forbidden Parameters Blocked
- ✅ Ready to Test

**Test now!** 🚀

