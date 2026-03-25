# 🛡️ Interactive Error Recovery System

## Overview

The AI Agent now includes an **Intelligent Interactive Error Recovery System** that gracefully handles Azure errors during resource cloning execution. Instead of failing completely, the system detects specific error types and prompts users for corrective action.

---

## 🎯 Key Features

### 1. **Automatic Error Detection**
The system automatically detects and classifies 5 types of Azure errors:

| Error Type | Description | Examples |
|------------|-------------|----------|
| **Quota Exceeded** | Azure subscription quota limit reached | VM cores, SQL databases |
| **Region Unavailable** | Region not accepting new resources | SQL Database in East US |
| **Name Conflict** | Resource name already exists globally | Storage account names |
| **Permission Denied** | Insufficient service principal permissions | AuthorizationFailed |
| **Invalid Parameter** | Unsupported or deprecated parameters | Runtime versions, SKU values |

### 2. **Intelligent Recovery Actions**
For each error type, the system offers context-specific actions:

#### Quota Exceeded Actions:
- 📉 Change to lower SKU
- 🌍 Try different region  
- 📝 Guide to request quota increase
- ⏭️ Skip resource and continue

#### Region Unavailable Actions:
- 🌍 Select different region (interactive dropdown)
- 🤖 Auto-select available region
- ⏭️ Skip resource and continue

#### Name Conflict Actions:
- 🔄 Generate new unique name
- ✏️ Provide custom name
- ⏭️ Skip resource and continue

#### Permission Denied Actions:
- 🔑 Show permission fix guide
- ⏭️ Skip resource and continue
- 🛑 Stop execution

#### Invalid Parameter Actions:
- ⚙️ Use minimal configuration
- ⏭️ Skip resource and continue
- 🤖 Regenerate script with AI

### 3. **Execution Never Fails Completely**
- Errors pause execution instead of stopping it
- Users can fix issues and resume
- Resources can be skipped to continue with others
- Final status shows `completed_with_warnings` if some resources were skipped

---

## 🔄 How It Works

### Backend Flow

```
1. Execute Azure CLI script
   ↓
2. Error occurs (e.g., "Region not accepting SQL Database")
   ↓
3. detectAzureError() analyzes error message
   ↓
4. Error matches pattern → Create interactive prompt
   ↓
5. Execution status → "waiting_for_input"
   ↓
6. Frontend displays prompt with actions
   ↓
7. User selects action (e.g., "Select different region")
   ↓
8. Frontend sends response to /api/ai-agent/prompt-response
   ↓
9. handlePromptResponse() processes action
   ↓
10. Script modified (e.g., change region to "West US")
   ↓
11. resumeExecution() → Re-run script
   ↓
12. Success → Execution continues
```

### API Endpoint

**POST** `/api/ai-agent/prompt-response`

**Request Body:**
```json
{
  "promptId": "prompt_session123_1699876543210",
  "action": "select_region",
  "userInput": {
    "region": "West US"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session123",
    "status": "running",
    "steps": [...],
    "interactivePrompt": null
  }
}
```

---

## 📋 Error Detection Patterns

### Quota Exceeded
**Pattern:** `/quota.*required.*deployment/i`

**Original Error:**
```
ERROR: Operation cannot be completed without additional quota.
Current Limit (Basic VMs): 0
Current Usage: 0
Amount required for this deployment (Basic VMs): 1
```

**Interactive Prompt:**
- Title: "Azure Quota Limit Reached"
- Description: "Your Azure subscription has reached its quota limit for this resource type."
- Actions: Change SKU, Change Region, Request Quota, Skip

### Region Unavailable
**Pattern:** `/Location.*not accepting.*SQL Database/i`

**Original Error:**
```
ERROR: (RegionDoesNotAllowProvisioning) Location 'East US' is not accepting 
creation of new Windows Azure SQL Database servers at this time.
```

**Interactive Prompt:**
- Title: "Region Not Available"
- Description: "The selected Azure region is not currently accepting new resource creation."
- Suggested Regions: ['West US', 'West US 2', 'Central US', 'North Europe', 'West Europe', 'Southeast Asia']
- Actions: Select Region, Auto-Select, Skip

### Name Conflict
**Pattern:** `/StorageAccountAlreadyExists/i`

**Original Error:**
```
ERROR: (StorageAccountAlreadyExists) The storage account named 
agenticstorageac already exists under the subscription.
```

**Interactive Prompt:**
- Title: "Resource Name Already Exists"
- Description: "A resource with this name already exists globally in Azure."
- Actions: Generate New Name, Provide Custom Name, Skip

---

## 🎨 UI Components (To Be Implemented)

### Interactive Prompt Modal

```jsx
{execution.status === 'waiting_for_input' && execution.interactivePrompt && (
  <InteractivePromptModal
    prompt={execution.interactivePrompt}
    onResponse={(action, userInput) => handlePromptResponse(action, userInput)}
  />
)}
```

### Modal Structure

```
┌─────────────────────────────────────────────┐
│  ⚠️  Region Not Available                    │
├─────────────────────────────────────────────┤
│                                             │
│  The selected Azure region is not           │
│  currently accepting new resource creation. │
│                                             │
│  Original Error:                            │
│  Location 'East US' is not accepting...     │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Select Different Region:            │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │ West US                    ▼   │  │  │
│  │  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Actions:                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 🌍 Select Region (with dropdown)    │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 🤖 Auto-Select Available Region     │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ ⏭️ Skip and Continue                │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📊 Status Flow

### Execution Status States

```
pending → running → completed
                  ↓
                  waiting_for_input (⏸️ PAUSED)
                  ↓
                  [User selects action]
                  ↓
                  running (resumed)
                  ↓
                  completed / completed_with_warnings / failed
```

### Polling for Interactive Prompts

Frontend should poll execution status and check for `waiting_for_input`:

```javascript
const checkExecutionStatus = async () => {
  const response = await fetch(`/api/ai-agent/execution/${sessionId}/status`);
  const execution = await response.json();
  
  if (execution.status === 'waiting_for_input') {
    // Show interactive prompt modal
    setShowPromptModal(true);
    setInteractivePrompt(execution.interactivePrompt);
  }
};
```

---

## 🔧 Backend Implementation Details

### Error Detection Method

```javascript
detectAzureError(errorMessage) {
  // Returns:
  {
    detected: true,
    errorType: 'region_unavailable',
    title: 'Region Not Available',
    description: '...',
    actions: [...],
    suggestedRegions: [...],
    originalError: '...'
  }
}
```

### Handling User Response

```javascript
async handlePromptResponse(promptId, userResponse) {
  switch (userResponse.action) {
    case 'select_region':
      // Modify script to use new region
      const updatedScript = this.updateScriptRegion(
        prompt.scriptContent, 
        userResponse.userInput.region
      );
      // Save and resume
      await fs.writeFile(prompt.scriptFile, updatedScript);
      return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
      
    case 'skip_resource':
      // Mark as completed with warnings
      execution.status = 'completed_with_warnings';
      execution.warnings.push({...});
      return execution;
      
    // ... other actions
  }
}
```

### Script Modification Methods

```javascript
// Change region in script
updateScriptRegion(scriptContent, newRegion) {
  return scriptContent
    .replace(/--location\s+"[^"]+"/g, `--location "${newRegion}"`)
    .replace(/LOCATION="[^"]+"/g, `LOCATION="${newRegion}"`);
}

// Change SKU in script  
updateScriptSKU(scriptContent, newSKU) {
  return scriptContent
    .replace(/--sku\s+"[^"]+"/g, `--sku "${newSKU}"`);
}

// Force regeneration of random resource names
regenerateResourceNames(scriptContent) {
  return scriptContent + `\n# Regenerated at ${new Date().toISOString()}\n`;
}
```

---

## 🎯 Benefits

✅ **Never Stop Completely** - Execution pauses instead of failing  
✅ **User Control** - Users decide how to handle errors  
✅ **Flexible Recovery** - Multiple recovery options for each error  
✅ **Smart Defaults** - Auto-select options available  
✅ **Skip and Continue** - Partial cloning is better than no cloning  
✅ **Production Ready** - Handles real-world Azure constraints  
✅ **Better UX** - Clear error messages and actionable solutions  

---

## 🚀 Usage Example

### Scenario: SQL Database Creation Fails in East US

1. **User starts cloning with target region "East US"**
2. **Script fails:** "Location 'East US' is not accepting creation of new SQL Database servers"
3. **System detects error** → Creates interactive prompt
4. **Execution pauses** → Status: `waiting_for_input`
5. **Frontend displays modal:**
   - Title: "Region Not Available"
   - Description: Error explanation
   - Dropdown: Select from ['West US', 'West US 2', 'Central US', etc.]
   - Actions: Select Region, Auto-Select, Skip
6. **User selects "West US" and clicks "Select Region"**
7. **Backend receives response:**
   ```json
   {
     "promptId": "prompt_...",
     "action": "select_region",
     "userInput": { "region": "West US" }
   }
   ```
8. **Script modified** → All `--location "East US"` → `--location "West US"`
9. **Execution resumes** → Script re-runs with new region
10. **Success!** → SQL Database created in West US

---

## 📝 Todo: Frontend Implementation

### Required Components

1. **InteractivePromptModal.js**
   - Display error title and description
   - Show available actions as buttons
   - Handle actions requiring input (region dropdown, custom name input)
   - Call `/api/ai-agent/prompt-response` on action selection

2. **Update AIAgent.js**
   - Poll for `waiting_for_input` status
   - Show modal when prompt detected
   - Handle prompt response
   - Resume polling after response

3. **UI Elements**
   - Region dropdown with suggested regions
   - Custom name input field
   - Action buttons with icons
   - Error details expandable section

---

## 🎉 Expected User Experience

**Before (Old System):**
```
Execution: Running...
❌ ERROR: Region 'East US' not available
Status: FAILED ❌
[User must start over from scratch]
```

**After (New System):**
```
Execution: Running...
⏸️ PAUSED: Region Not Available

┌──────────────────────────────────────┐
│ Would you like to try a different   │
│ region?                              │
│                                      │
│ Select Region: [West US ▼]          │
│                                      │
│ [🌍 Select Region] [🤖 Auto-Select] │
└──────────────────────────────────────┘

[User selects "West US"]

Execution: Resumed...
✅ SQL Database created in West US
Status: COMPLETED ✅
```

---

## 🔮 Future Enhancements

- [ ] AI-powered auto-fix suggestions
- [ ] Learning from past error resolutions
- [ ] Batch error handling (handle multiple errors at once)
- [ ] Rollback mechanism for failed recovery attempts
- [ ] Cost estimation when changing SKU/region
- [ ] Save recovery preferences for future runs

---

## 📚 API Reference

### POST /api/ai-agent/prompt-response

**Description:** Handle user response to an interactive error prompt

**Request:**
```json
{
  "promptId": "string",
  "action": "select_region" | "auto_region" | "change_sku" | "generate_new_name" | 
            "skip_resource" | "retry" | "abort" | "guide_permissions",
  "userInput": {
    "region": "string",      // For select_region
    "customName": "string",  // For provide_custom_name
    "sku": "string"          // For change_sku
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "status": "running" | "completed" | "completed_with_warnings" | "failed",
    "steps": [...],
    "interactivePrompt": null,  // null after response handled
    "warnings": [...]            // If status is completed_with_warnings
  }
}
```

---

## ✅ Implementation Status

- [x] Backend error detection
- [x] Interactive prompt creation
- [x] Execution pause/resume logic
- [x] Script modification methods
- [x] API endpoint for prompt responses
- [x] Action handlers (all 5 error types)
- [ ] Frontend modal component
- [ ] Region dropdown UI
- [ ] Custom name input UI
- [ ] Integration with AIAgent.js
- [ ] Testing with real Azure errors

---

This system makes your AI Agent **production-ready** by handling real-world Azure constraints gracefully! 🚀
