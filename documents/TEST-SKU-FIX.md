# 🧪 TEST INVALID SKU FIX - QUICK GUIDE

## ✅ What Was Fixed

**Error:** `'LinuxFree' is not a valid value for '--sku'`

**Fix:** AI now uses ONLY valid SKU values (F1, B1, P1V2, etc.)

---

## 🚀 Quick Test (3 Minutes)

### **Step 1: Start Cloning (1 min)**

```
1. Open: http://localhost:3000/ai-agent
2. Select: Any resource group with App Service Plan
3. Click: "Discover Resources"
4. Enter target: "test-sku-fix"
5. Click: "Analyze Resources"
```

### **Step 2: Check Generated Script (30 sec)**

```
1. Click: "Generate Azure CLI"
2. Look for App Service Plan creation section
3. Verify SKU value:

   ✅ SHOULD SEE:
   --sku F1
   OR
   --sku B1
   OR
   --sku P1V2

   ❌ SHOULD NOT SEE:
   --sku LinuxFree
   --sku WindowsFree
   --sku Free
   --sku Basic
```

### **Step 3: Execute & Monitor (1-2 min)**

```
1. Click: "Execute Now"
2. Watch execution output:

   Expected:
   ✓ Creating target resource group...
   ✓ Creating App Service Plan: [name]...
   ✓ SUCCESS: App Service Plan created with Free tier (F1)
   ✓ Creating Web App: [name]...
   ✓ Web App created successfully!
   ✅ All resources cloned successfully

   Should NOT see:
   ❌ ERROR: 'LinuxFree' is not a valid value
   ❌ ERROR: The plan doesn't exist
```

### **Step 4: Verify Azure Portal (30 sec)**

```
1. Open: portal.azure.com
2. Go to: Resource Groups → test-sku-fix
3. Check:
   ✅ App Service Plan exists
   ✅ Pricing Tier: F1 (Free) or B1 (Basic)
   ✅ Web App exists
   ✅ Web App Status: Running
```

---

## ✅ Expected Results

### **Generated Script:**
```bash
# Should use valid SKU:
az appservice plan create \
  --name "my-plan-123" \
  --resource-group "test-sku-fix" \
  --location "westus" \
  --sku F1 \  ← VALID!
  --is-linux
```

### **Execution Output:**
```
Creating App Service Plan: my-plan-123...
✓ SUCCESS: App Service Plan created with Free tier (F1)

Creating Web App: my-webapp-456...
✓ Web App created successfully!

✅ All resources cloned successfully.
```

### **Azure Portal:**
```
Resource Group: test-sku-fix
   ✅ App Service Plan (my-plan-123)
      Pricing Tier: F1 (Free)
      Status: Ready
   ✅ Web App (my-webapp-456)
      Status: Running
```

---

## 🎯 Valid SKU Values

**Use ONLY these:**

| Tier | Valid SKUs | Cost |
|------|-----------|------|
| Free | F1, FREE | $0 |
| Shared | D1, SHARED | ~$10/mo |
| Basic | B1, B2, B3 | ~$55-220/mo |
| Standard | S1, S2, S3 | ~$70-280/mo |
| Premium V2 | P1V2, P2V2, P3V2 | ~$150-600/mo |

**Never use:**
- ❌ LinuxFree
- ❌ WindowsFree
- ❌ Free (use F1 or FREE)
- ❌ Basic (use B1, B2, or B3)
- ❌ Any made-up name

---

## 🔍 If Something Goes Wrong

### **Still Getting "LinuxFree" Error:**

```bash
# 1. Check generated script:
grep "\-\-sku" your-generated-script.sh

# 2. If you see "--sku LinuxFree":
#    - The AI didn't follow the new rules
#    - Clear browser cache
#    - Restart server
#    - Try again

# 3. Manual fix:
#    - Replace "LinuxFree" with "F1"
#    - Re-execute the script
```

### **Quota Error (Even with F1):**

```
ERROR: Operation cannot be completed without additional quota

Solution:
1. Try B1 instead (requires payment)
2. Or request quota increase in Azure Portal
3. Or use different subscription
```

### **Web App Creation Failed:**

```
ERROR: The plan 'xxx' doesn't exist

Solution:
1. Verify App Service Plan was created first
2. Check plan name matches in webapp create command
3. Check plan is in same resource group
```

---

## ✅ Success Criteria

**Test Passes If:**

✅ No "LinuxFree" in generated script
✅ Script uses valid SKU (F1, B1, P1V2, etc.)
✅ No "invalid SKU" errors during execution
✅ App Service Plan created successfully
✅ Web App created successfully
✅ All resources visible in Azure Portal
✅ Status: COMPLETED

**Test Fails If:**

❌ "LinuxFree" appears in script
❌ Any invalid SKU error
❌ App Service Plan not created
❌ Web App not created
❌ Status: FAILED

---

## 🎉 **Ready to Test!**

**Server Status:** ✅ Running with SKU fix on port 5000

**Your Action:**
1. ✅ Open http://localhost:3000/ai-agent
2. ✅ Try cloning a resource group
3. ✅ Verify valid SKU in script (F1, B1, etc.)
4. ✅ Execute and watch for success

**Expected:** ✅ All resources cloned with valid SKUs - no errors!

---

**Test now and enjoy error-free cloning!** 🚀

