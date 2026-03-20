const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService');
const { normalizeLinuxRuntimeForAzCli } = require('../services/webAppRuntimeUtils');

/**
 * POST /api/ai-agent-validation/analyze-request
 * Analyzes user's request and validates configuration before script generation
 */
router.post('/analyze-request', async (req, res) => {
  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log('🔍 Analyzing user request for validation...');
    console.log('Query:', query);

    // System prompt for intelligent configuration analysis
    const systemPrompt = `You are an expert Azure configuration validator and advisor.

Your job is to analyze the user's request for creating Azure resources and:
1. Extract the configuration they want (web app name, runtime, region, SKU, etc.)
2. Validate each parameter against Azure requirements
3. Detect and correct any errors
4. Provide warnings and recommendations
5. Return a validated configuration for user confirmation

CRITICAL VALIDATION RULES:

1. WEB APP NAMES:
   - Must be globally unique across all of Azure
   - If user provides a name like "react-app" or "myapp", it's likely NOT unique
   - ALWAYS recommend adding a random suffix: "react-app-$RANDOM" or "react-app-TIMESTAMP"
   - Explain: "Web app names must be globally unique. I'll add a random suffix."

2. RUNTIME FORMAT (Linux — az webapp create):
   - User might say: "Node 18", "node|18-lts", "Python 3.11"
   - Correct format matches az webapp list-runtimes --os-type linux:
     * Node.js: "NODE:20-lts", "NODE:22-lts" (Node 18 is not available — use NODE:20-lts)
     * Python: "PYTHON:3.12", "PYTHON:3.11"
     * .NET: "DOTNETCORE:8.0"
   - Use STACK:version (uppercase stack, colon). Never use pipe/lowercase for Linux.
   - If wrong format detected, correct it and explain

3. REGIONS:
   - Common user inputs: "India", "US", "East US"
   - Valid Azure regions: "centralindia", "eastus", "westus2", "southeastasia"
   - Convert user-friendly names to Azure region codes
   - Warn if region might have quota issues
   - Recommend: "centralindia" for India, "eastus" or "westus2" for US

4. APP SERVICE PLAN SKU:
   - User might say: "free", "basic", "standard"
   - Valid SKUs: "F1" (free), "B1" (basic), "S1" (standard), "P1v2" (premium)
   - Recommend B1 for development, S1 for production
   - Warn about quota limits for F1

5. DEFAULT VALUES (if not specified):
   - Runtime: "NODE:20-lts" (stable Linux Node LTS)
   - Region: "centralindia" (based on context)
   - SKU: "B1" (good balance of cost and performance)
   - Deployment: "--deployment-local-git" (simple and reliable)

RESPONSE FORMAT (JSON ONLY - NO MARKDOWN):

{
  "isValid": true/false,
  "originalRequest": "user's original query",
  "analysis": {
    "resourceType": "Web App",
    "detectedIntent": "Create a React/Node.js web application",
    "extractedConfig": {
      "name": "what user said or 'Not specified'",
      "runtime": "detected runtime or 'Not specified'",
      "region": "detected region or 'Not specified'",
      "resourceGroup": "detected or from context",
      "planSku": "detected or 'Not specified'"
    }
  },
  "validatedConfig": {
    "resourceName": "unique-name-$RANDOM or unique-name-TIMESTAMP",
    "name": "unique-name-$RANDOM or unique-name-TIMESTAMP",
    "nameGeneration": "Will generate unique suffix at execution time",
    "runtime": "NODE:20-lts",
    "location": "centralindia",
    "region": "centralindia",
    "resourceGroupName": "nit-resource",
    "resourceGroup": "nit-resource",
    "planName": "plan-$RANDOM",
    "planSku": "B1",
    "sku": "B1",
    "deployment": "--deployment-local-git"
  },
  "corrections": [
    {
      "parameter": "name",
      "issue": "Name 'myapp' is not globally unique",
      "correction": "Will generate unique name: myapp-$RANDOM",
      "reason": "Azure web app names must be globally unique"
    },
    {
      "parameter": "runtime",
      "issue": "Runtime format 'node|18-lts' is invalid for current CLI",
      "correction": "Corrected to 'NODE:20-lts'",
      "reason": "az webapp create expects values from az webapp list-runtimes (STACK:version)"
    }
  ],
  "warnings": [
    {
      "type": "quota",
      "message": "Free tier (F1) may have quota limits",
      "recommendation": "Using B1 (Basic) tier for better reliability"
    }
  ],
  "recommendations": [
    "Web app will be created with --no-wait for fast execution",
    "Deployment will complete in background (5-10 minutes)",
    "Pre-validation will check name availability before creation"
  ],
  "estimatedCost": "$13-15/month for B1 tier in Central India",
  "deploymentTime": "Script completes in 30-60 seconds, full deployment in 5-10 minutes",
  "requiresConfirmation": true,
  "confirmationMessage": "Ready to create web app with validated configuration. Proceed?"
}

IMPORTANT:
- Be intelligent and context-aware
- If user doesn't specify something, use sensible defaults
- Always validate and correct runtime formats
- Always ensure unique names (add $RANDOM or TIMESTAMP placeholders)
- Provide clear explanations for corrections
- Return ONLY valid JSON, no markdown, no code blocks
- Use BOTH standardized field names (e.g., both "resourceName" and "name", both "location" and "region")
- Generate unique plan names with $RANDOM suffix
- For web apps, prefer B1 SKU over F1 to avoid quota issues

CRITICAL: In validatedConfig, always include:
- resourceName AND name (both with same value)
- location AND region (both with same value)  
- resourceGroupName AND resourceGroup (both with same value)
- planSku AND sku (both with same value)

Analyze the request now:`;

    // Get AI analysis
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `User Query: ${query}\n\nContext: ${JSON.stringify(context || {})}` }
    ];

    const aiResponse = await aiAgentService.chat(messages);
    
    // Extract message from AI response
    const responseText = aiResponse?.message || aiResponse;
    
    console.log('🤖 AI Analysis Response:', responseText);

    // Parse JSON response
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysis = JSON.parse(cleanedResponse);
      
      // Post-process: Generate actual unique names with timestamp and standardize fields
      if (analysis.validatedConfig) {
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        
        // If name contains $RANDOM or TIMESTAMP placeholders, replace them
        if (analysis.validatedConfig.name) {
          analysis.validatedConfig.name = analysis.validatedConfig.name
            .replace(/\$RANDOM/g, timestamp)
            .replace(/TIMESTAMP/g, timestamp);
        }
        
        // Standardize: Ensure both resourceName and name are set
        if (analysis.validatedConfig.name && !analysis.validatedConfig.resourceName) {
          analysis.validatedConfig.resourceName = analysis.validatedConfig.name;
        }
        if (analysis.validatedConfig.resourceName && !analysis.validatedConfig.name) {
          analysis.validatedConfig.name = analysis.validatedConfig.resourceName;
        }
        
        // Generate unique plan name if not specified
        if (!analysis.validatedConfig.planName || analysis.validatedConfig.planName.includes('generated')) {
          analysis.validatedConfig.planName = `plan-${timestamp}`;
        }
        
        // Replace $RANDOM in planName
        if (analysis.validatedConfig.planName) {
          analysis.validatedConfig.planName = analysis.validatedConfig.planName
            .replace(/\$RANDOM/g, timestamp)
            .replace(/TIMESTAMP/g, timestamp);
        }
        
        // Ensure resourceGroup is set (standardize both fields)
        const rgName = analysis.validatedConfig.resourceGroup || 
                       analysis.validatedConfig.resourceGroupName || 
                       context?.selectedResourceGroup || 
                       'default-rg';
        analysis.validatedConfig.resourceGroup = rgName;
        analysis.validatedConfig.resourceGroupName = rgName;
        
        // Ensure location/region is set (standardize both fields)
        const location = analysis.validatedConfig.location || 
                        analysis.validatedConfig.region || 
                        context?.selectedRegion || 
                        'centralindia';
        analysis.validatedConfig.location = location;
        analysis.validatedConfig.region = location;
        
        // Ensure SKU is set (standardize both fields)
        const sku = analysis.validatedConfig.planSku || 
                   analysis.validatedConfig.sku || 
                   'B1';
        analysis.validatedConfig.planSku = sku;
        analysis.validatedConfig.sku = sku;
        
        // Match az webapp create --runtime (preserve Windows dotnet:8 style; fix pipe/lowercase Node)
        let rt = (analysis.validatedConfig.runtime || 'NODE:20-lts').trim();
        if (/^dotnet:/i.test(rt)) {
          analysis.validatedConfig.runtime = rt;
        } else {
          analysis.validatedConfig.runtime = normalizeLinuxRuntimeForAzCli(rt);
        }
        
        console.log('✅ Post-processed validated config:', analysis.validatedConfig);
      }
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback response with actual unique names
      const timestamp = Date.now().toString().slice(-6);
      analysis = {
        isValid: true,
        originalRequest: query,
        analysis: {
          resourceType: 'Web App',
          detectedIntent: 'Create Azure resource',
          extractedConfig: {}
        },
        validatedConfig: {
          resourceName: `webapp-${timestamp}`,
          name: `webapp-${timestamp}`,
          nameGeneration: `Using timestamp-based unique name: webapp-${timestamp}`,
          runtime: 'NODE:20-lts',
          location: context?.selectedRegion || 'centralindia',
          region: context?.selectedRegion || 'centralindia',
          resourceGroupName: context?.selectedResourceGroup || 'default-rg',
          resourceGroup: context?.selectedResourceGroup || 'default-rg',
          planName: `plan-${timestamp}`,
          planSku: 'B1',
          sku: 'B1',
          deployment: '--deployment-local-git'
        },
        corrections: [{
          parameter: 'name',
          issue: 'Using fallback due to parsing error',
          correction: `Generated unique name: webapp-${timestamp}`,
          reason: 'Ensuring global uniqueness'
        }],
        warnings: [{
          type: 'parsing',
          message: 'Could not parse AI response, using validated default configuration',
          recommendation: 'Configuration has been automatically validated for safety'
        }],
        recommendations: [
          'Using timestamp-based unique naming',
          'Web app will be created with --no-wait for fast execution',
          'Deployment will complete in background'
        ],
        estimatedCost: '₹1,100 - ₹1,300/month for B1 tier',
        deploymentTime: 'Script: 30-60 seconds, Full deployment: 5-10 minutes',
        requiresConfirmation: true,
        confirmationMessage: 'Configuration validated and ready. Proceed with deployment?'
      };
    }

    res.json(analysis);

  } catch (error) {
    console.error('❌ Error analyzing request:', error);
    res.status(500).json({ 
      error: 'Failed to analyze request',
      details: error.message 
    });
  }
});

module.exports = router;

