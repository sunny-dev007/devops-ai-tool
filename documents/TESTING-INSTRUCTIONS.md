# 🧪 Testing Instructions - Clone Validation Feature

## ⚠️ IMPORTANT: Fresh Session Required

If you analyzed resources BEFORE the fix was deployed, you need to start fresh to see the new validation flow.

---

## ✅ Step-by-Step Testing Guide

### **Step 1: Refresh the Application**

```
1. Open browser
2. Go to: http://localhost:3000/ai-agent
3. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
4. Wait for page to fully load
```

**Why?** This ensures you're using the latest frontend code with validation support.

---

### **Step 2: Discover Resources (Fresh Start)**

```
1. Select source resource group: "Nitor-Project"
2. Enter target resource group: "Nitor-Project-Clone" (or any name)
3. Click "Discover Resources" button
4. ✅ Wait for discovery to complete
5. ✅ You should see: "I found 2 resources in 'Nitor-Project'. Ready to analyze..."
```

**Check:**
- ✅ Discovered Resources shows: (2)
- ✅ basic-plan-248859
- ✅ nit-webapp-10901

---

### **Step 3: Analyze with AI (NEW - Validation Flow)**

```
1. Click "Analyze with AI" button
2. ✅ WAIT for validation to complete (~5-10 seconds)
3. ✅ A MODAL should appear with title: "Cloning Validation Complete"
```

**What You Should See:**

**Validation Modal Content:**
```
┌─────────────────────────────────────────────────────┐
│  Cloning Validation Complete                        │
│  Review validated configurations for all resources  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📦 Source Resource Group: Nitor-Project            │
│  🎯 Target Resource Group: Nitor-Project-Clone      │
│                                                     │
│  ✅ Validated Resources (2):                        │
│                                                     │
│  1. basic-plan-248859                               │
│     New Name: basic-plan-248859-827463              │
│     Status: corrected                               │
│     Corrections:                                    │
│       - Generated unique name with timestamp        │
│                                                     │
│  2. nit-webapp-10901                                │
│     New Name: nit-webapp-10901-827463               │
│     Status: corrected                               │
│     Corrections:                                    │
│       - Generated globally unique name              │
│       - Corrected runtime format                    │
│                                                     │
│  💰 Estimated Cost: ₹3,500 - ₹4,000/month          │
│  ⏱️ Estimated Time: 20-30 minutes                   │
│                                                     │
│  [Cancel]  [Confirm & Proceed with Cloning]        │
└─────────────────────────────────────────────────────┘
```

**⚠️ CRITICAL: If you DON'T see this modal:**
- Something is wrong with the validation endpoint
- Check browser console for errors (F12)
- Check network tab for failed API calls

---

### **Step 4: Confirm Validation**

```
1. Review the validated resources in the modal
2. Note the NEW unique names (e.g., nit-webapp-10901-827463)
3. Click "Confirm & Proceed with Cloning" button
4. ✅ Modal should close
5. ✅ You should see: "Analysis complete! All resources have been validated..."
```

**Chat Messages You Should See:**
```
20:35 🤖
✅ Pre-validation complete! I've analyzed all resources and validated 
the cloning configuration. Please review and confirm to proceed.

20:35 🤖
✅ Analysis complete! All resources have been validated and optimized. 
Ready to generate scripts with corrected configurations!
```

---

### **Step 5: Generate Azure CLI Script (THE CRUCIAL TEST)**

```
1. Click "Generate Azure CLI" button (blue button, marked RECOMMENDED)
2. ✅ Wait for script generation (~5-10 seconds)
3. ✅ You should see script generated successfully
4. ✅ NO ERROR should appear
```

**What to Check in the Generated Script:**

Look for these EXACT patterns:

```bash
#!/bin/bash

# Variables with VALIDATED names (NOT $RANDOM!)
TARGET_RG="Nitor-Project-Clone"
LOCATION="centralindia"

# Validated resource names (should have timestamp suffix)
APP_PLAN_NAME="basic-plan-248859-827463"  # ← Should have timestamp
WEB_APP_NAME="nit-webapp-10901-827463"    # ← Should have timestamp

# NOT like this (wrong):
# WEB_APP_NAME="nit-webapp-$RANDOM"        # ❌ WRONG!
# APP_PLAN_NAME="plan-$RANDOM"             # ❌ WRONG!

# Corrected runtime format
RUNTIME="node|18-lts"  # ← Should be lowercase with pipe |

# Create App Service Plan
echo "Creating App Service Plan: $APP_PLAN_NAME"
az appservice plan create \
  --name "$APP_PLAN_NAME" \
  --resource-group "$TARGET_RG" \
  --location "$LOCATION" \
  --sku B1 \
  --is-linux

# Create Web App with validated name
echo "Creating Web App: $WEB_APP_NAME"
az webapp create \
  --name "$WEB_APP_NAME" \
  --resource-group "$TARGET_RG" \
  --plan "$APP_PLAN_NAME"

echo "✅ Cloning complete!"
```

**✅ GOOD SIGNS:**
- Variable names are defined at the top
- Names have timestamp suffixes (e.g., `-827463`)
- No `$RANDOM` used in variable assignments
- Runtime format is correct (e.g., `node|18-lts`)

**❌ BAD SIGNS (means validation didn't work):**
- Variables using `$RANDOM` (e.g., `WEB_APP_NAME="app-$RANDOM"`)
- Variables not defined but referenced
- Wrong runtime format (e.g., `NODE:18-lts`)

---

### **Step 6: Execute Script (Optional)**

```
1. Click "Execute Now" button
2. ✅ Wait for execution to complete
3. ✅ Check execution output
4. ✅ Resources should be created successfully
```

---

## 🚨 If You Still Get the Error

### **Error Message:**
```json
{
  "success": false,
  "error": "CLI script generation failed",
  "message": "WEB_APP_NAME is not defined"
}
```

### **Possible Causes:**

#### **1. Validation Modal Was Not Shown**
**Check:**
- Did you see the green "Cloning Validation Complete" modal?
- Did you click "Confirm & Proceed with Cloning"?

**Solution:**
- Start from Step 1 (refresh page)
- Make sure validation modal appears
- Confirm the validation before generating script

---

#### **2. Browser Cache Issue**
**Check:**
- Are you using cached old code?

**Solution:**
```bash
# Clear browser cache
1. Open DevTools (F12)
2. Right-click on refresh button
3. Select "Empty Cache and Hard Reload"
4. Close DevTools
5. Navigate to: http://localhost:3000/ai-agent
```

---

#### **3. Server Not Restarted**
**Check:**
- Is the server running the NEW code?

**Solution:**
```bash
# Check server logs
tail -30 /path/to/backend-clone-validation-fix.log

# Restart server if needed
cd /path/to/Azure-Monitor-AI-Assistant
pkill -9 -f "node.*server.js"
sleep 2
npm start
```

---

#### **4. Frontend State Issue**
**Check:**
- Is `cloneValidationResult` state set?

**Solution:**
```javascript
// Open browser console (F12)
// After clicking "Confirm & Proceed", check:
console.log(cloneValidationResult);

// Should show:
{
  validatedResources: [...],
  validatedConfig: {
    resourceMappings: {...}
  }
}

// If it's null/undefined, validation didn't work
```

---

## 🔍 Debugging Steps

### **1. Check Browser Console**
```
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors during "Analyze with AI" click
4. Look for errors during "Generate Azure CLI" click
```

### **2. Check Network Tab**
```
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Analyze with AI"
4. Check if /api/ai-agent/validate-clone request succeeds
5. Check response - should contain validatedResources
6. Click "Confirm & Proceed"
7. Click "Generate Azure CLI"
8. Check if /api/ai-agent/generate-cli request succeeds
9. Check request body - should contain validatedConfig
```

### **3. Check Backend Logs**
```bash
# Real-time logs
tail -f backend-clone-validation-fix.log

# Look for these messages:
# "🔍 Validating cloning configuration..."
# "✅ Validation complete: X resources validated"
# "📝 Generating Azure CLI scripts..."
# "✅ Using validated configuration for CLI script generation"
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Validation modal appears after "Analyze with AI"
2. ✅ Modal shows validated resources with new names
3. ✅ After confirmation, script generation succeeds
4. ✅ Generated script has validated names (with timestamps)
5. ✅ NO error messages
6. ✅ Script execution succeeds with ~95% rate

---

## 📞 If Still Not Working

**Provide These Details:**

1. **Browser Console Errors:**
   - Open F12, copy any red errors

2. **Network Request Details:**
   - POST /api/ai-agent/validate-clone
     - Status code?
     - Response body?
   
   - POST /api/ai-agent/generate-cli
     - Status code?
     - Request body (check if validatedConfig is present)?
     - Response body?

3. **Backend Logs:**
   - Last 50 lines of backend-clone-validation-fix.log

4. **Exact Steps You Followed:**
   - Did you refresh the page?
   - Did validation modal appear?
   - Did you click "Confirm & Proceed"?

---

## 🎯 Expected Complete Flow

```
User Journey:
1. Refresh page ✓
2. Select "Nitor-Project" ✓
3. Click "Discover Resources" ✓
4. See "2 resources found" ✓
5. Click "Analyze with AI" ✓
6. See validation modal ✓ ← KEY STEP!
7. Click "Confirm & Proceed" ✓ ← KEY STEP!
8. See "Analysis complete" message ✓
9. Click "Generate Azure CLI" ✓
10. See script generated ✅ ← SHOULD WORK NOW!
11. Review script (validated names) ✅
12. Click "Execute Now" ✅
13. Resources created successfully ✅
```

---

**Last Updated:** Just now  
**Server Status:** ✅ Running on port 5000  
**Fix Status:** ✅ Deployed and ready

