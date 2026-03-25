# 🔍 DEBUG GUIDE - Find the Root Cause

## ⚠️ I've Added Comprehensive Logging

The server now has detailed logging to help us understand exactly what's happening.

---

## 🧪 Step-by-Step Debugging

### **Step 1: Open Two Terminal Windows**

**Terminal 1:** Watch server logs in real-time
```bash
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant
tail -f backend-debug.log
```

**Terminal 2:** Available for commands

---

### **Step 2: Open Browser Console**

1. Open http://localhost:3000/ai-agent
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Clear console (click trash icon)

---

### **Step 3: Perform the Test**

Now do these actions and **watch both logs**:

#### **Action 1: Discover Resources**
```
1. Select: "Nitor-Project"
2. Target: "Nitor-Project-Clone"
3. Click: "Discover Resources"
```

**Check Browser Console for:**
```
✓ "Discovered resources" log
```

---

#### **Action 2: Generate Azure CLI** (THIS IS WHERE IT FAILS)
```
1. Click: "Generate Azure CLI" button
```

**Watch BOTH logs simultaneously:**

**Browser Console Should Show:**
```
🔍 Generating Azure CLI script...
Discovered Resources: {resourceGroup: {...}, resources: [...]}
Target Resource Group: "Nitor-Project-Clone"
Clone Validation Result: null or {...}  ← IMPORTANT: Is this null?
```

**Terminal (backend-debug.log) Should Show:**
```
📝 Generating Azure CLI scripts...
Source RG: Nitor-Project
Target RG: Nitor-Project-Clone
Resources to clone: 2
✅ Using validated configuration OR ⚠️ No validated configuration
🤖 Calling Azure OpenAI for script generation...
User prompt length: XXXX characters
✅ AI response received
Generated script length: XXXX characters
First 200 chars: #!/bin/bash ...
```

---

## 🎯 Critical Questions to Answer

### **Question 1: Is `cloneValidationResult` null or populated?**

**Look in Browser Console after clicking "Generate Azure CLI":**

```javascript
Clone Validation Result: null
```

#### **If NULL:**
- You **skipped** the validation step
- You need to click "Analyze with AI" FIRST before "Generate Azure CLI"
- This is the most likely cause!

#### **If POPULATED:**
```javascript
Clone Validation Result: {
  validatedResources: [...],
  validatedConfig: {...}
}
```
- Validation was done correctly
- The issue is elsewhere

---

### **Question 2: What does the backend log show?**

**Look in Terminal (backend-debug.log):**

#### **If you see:**
```
⚠️  No validated configuration provided - generating with default names
```

**This confirms you skipped validation!**

**Solution:** Click "Analyze with AI" first, then confirm the modal, THEN click "Generate Azure CLI"

#### **If you see:**
```
✅ Using validated configuration for CLI script generation
Validated resources count: 2
Resource mappings: {...}
```

**This means validation WAS used. Let's see what AI generated:**

Look for:
```
First 200 chars: #!/bin/bash ...
```

---

### **Question 3: What error appears?**

#### **If error is:**
```json
{
  "error": "CLI script generation failed",
  "message": "WEB_APP_NAME is not defined"
}
```

**This means the AI generated a script that references WEB_APP_NAME without defining it.**

**Check backend log for:**
```
First 200 chars: #!/bin/bash ...
```

If it starts with `#!/bin/bash` but no variable definitions, the AI prompt isn't working correctly.

---

## 📋 Test Scenario Matrix

### **Scenario A: Validation NOT Done** (Most Likely!)

**Steps:**
1. Discover Resources ✓
2. **SKIP** "Analyze with AI"
3. Click "Generate Azure CLI" ❌

**Browser Console:**
```
Clone Validation Result: null
```

**Backend Log:**
```
⚠️  No validated configuration provided
```

**Expected:** Script should still generate with $RANDOM names

**If it fails:** AI prompt issue

---

### **Scenario B: Validation Done Correctly**

**Steps:**
1. Discover Resources ✓
2. Click "Analyze with AI" ✓
3. **See validation modal** ✓
4. Click "Confirm & Proceed" ✓
5. Click "Generate Azure CLI" ✓

**Browser Console:**
```
Clone Validation Result: {
  validatedResources: [...],
  ...
}
```

**Backend Log:**
```
✅ Using validated configuration
Validated resources count: 2
```

**Expected:** Script should use validated names

**If it fails:** Structure mismatch issue

---

## 🔧 What To Send Me

After you run the test, please send me **screenshots** of:

### **1. Browser Console Output**
```
Screenshot showing:
- "🔍 Generating Azure CLI script..."
- "Discovered Resources: ..."
- "Clone Validation Result: ..." ← THIS IS CRITICAL!
```

### **2. Backend Log Output**
```
Screenshot or copy-paste of terminal showing:
- "📝 Generating Azure CLI scripts..."
- "✅ Using validated configuration" OR "⚠️ No validated configuration"
- "🤖 Calling Azure OpenAI..."
- "First 200 chars: ..."
```

### **3. Error Message**
```
Screenshot of the exact error that appears in the UI
```

---

## 🎯 Quick Diagnostic

**Run this command to see what the AI is generating:**

```bash
cd /Users/sunny.kushwaha/projects/Personal/Azure-Monitor-AI-Assistant
tail -100 backend-debug.log | grep -A5 "First 200 chars"
```

This will show you the first 200 characters of what the AI generated.

**Expected Output:**
```
First 200 chars: #!/bin/bash

set -e

# Variables
SOURCE_RG="Nitor-Project"
TARGET_RG="Nitor-Project-Clone"
LOCATION="centralindia"

# Validated resource names
WEB_APP_NAME="nit-webapp-10901-827463"  ← Should be defined!
```

**Bad Output:**
```
First 200 chars: Below is the bash script to clone...

```bash
#!/bin/bash
...
```

(This means AI is adding prose/markdown despite instructions)

---

## 💡 Most Likely Causes (Ranked)

### **1. You're Skipping Validation** (90% probability)
- Fix: Click "Analyze with AI" → Confirm → Then generate

### **2. Azure OpenAI is Not Configured** (5% probability)
- Check: Is `AZURE_OPENAI_AGENT_KEY` set in `.env`?
- Server log shows: "AI Service: FAILED" or "FALLBACK MODE"

### **3. AI Prompt Not Working** (5% probability)
- AI is generating malformed scripts
- Need to see actual AI output from logs

---

## 🚀 Action Plan

### **Right Now:**

1. **Open two terminals:**
   - Terminal 1: `tail -f backend-debug.log`
   - Terminal 2: Ready for commands

2. **Open browser with F12 console open**

3. **Do this test:**
   - Refresh browser (Cmd+Shift+R)
   - Discover resources
   - Click "Generate Azure CLI"
   - **WATCH BOTH LOGS**

4. **Take screenshots of:**
   - Browser console output
   - Backend log output
   - Error message

5. **Send me the screenshots**

---

## ✅ What I'm Looking For

### **In Browser Console:**
```javascript
Clone Validation Result: null or {...}
```
↑ **This tells me if validation was done or skipped**

### **In Backend Log:**
```
⚠️ No validated configuration OR ✅ Using validated configuration
```
↑ **This confirms what backend received**

### **In Backend Log:**
```
First 200 chars: #!/bin/bash ...
```
↑ **This shows what AI actually generated**

---

## 🎯 Expected Result After Fix

**Browser Console:**
```
🔍 Generating Azure CLI script...
Clone Validation Result: {validatedResources: [...]}
✅ Script generation response: {success: true, ...}
```

**Backend Log:**
```
📝 Generating Azure CLI scripts...
✅ Using validated configuration for CLI script generation
Validated resources count: 2
🤖 Calling Azure OpenAI...
✅ AI response received
First 200 chars: #!/bin/bash

# Variables
WEB_APP_NAME="nit-webapp-10901-827463"
...
```

**UI:**
```
✅ Toast: "Azure CLI script generated with validated parameters!"
✅ Script appears in UI
✅ Script contains validated names
❌ NO error message
```

---

**Server Status:** ✅ Running with comprehensive logging

**Action Required:** 🧪 **RUN THE TEST AND SEND ME THE LOGS**

This will help me identify the EXACT cause of the issue!

