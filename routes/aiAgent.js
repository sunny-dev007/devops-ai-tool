const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService');
const executionService = require('../services/executionService');
const { v4: uuidv4 } = require('uuid');
const AzureService = require('../services/azureService');
const azureValidationService = require('../services/azureValidationService');

// Create an instance of Azure service for cost management
const azureServiceInstance = new AzureService();

/**
 * AI Agent Routes for Azure Resource Cloning
 */

// Get list of resource groups
router.get('/resource-groups', async (req, res) => {
  try {
    const token = await aiAgentService.getAccessToken();
    const axios = require('axios');
    
    const url = `https://management.azure.com/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourcegroups?api-version=2021-04-01`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    res.json({
      success: true,
      data: response.data.value
    });
  } catch (error) {
    console.error('❌ Failed to get resource groups:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve resource groups',
      message: error.message
    });
  }
});

// Discover resources in a resource group
router.post('/discover', async (req, res) => {
  try {
    const { resourceGroupName } = req.body;
    
    if (!resourceGroupName) {
      return res.status(400).json({
        success: false,
        error: 'Resource group name is required'
      });
    }
    
    console.log(`🔍 Discovering resources in: ${resourceGroupName}`);
    
    const resourceGroupData = await aiAgentService.discoverResourceGroup(resourceGroupName);
    
    res.json({
      success: true,
      data: resourceGroupData
    });
  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Resource discovery failed',
      message: error.message
    });
  }
});

// Validate cloning configuration before analysis
router.post('/validate-clone', async (req, res) => {
  try {
    const { sourceResourceGroup, targetResourceGroup, discoveredResources, resources } = req.body;
    
    if (!sourceResourceGroup || !targetResourceGroup || !discoveredResources) {
      return res.status(400).json({
        success: false,
        error: 'Source RG, target RG, and discovered resources are required'
      });
    }
    
    console.log(`🔍 Validating cloning configuration...`);
    console.log(`Source: ${sourceResourceGroup} → Target: ${targetResourceGroup}`);
    console.log(`Resources to validate: ${resources?.length || 0}`);
    
    const timestamp = Date.now().toString().slice(-6);
    
    // Step 1: Perform REAL Azure validation checks
    console.log(`🔍 Step 1: Performing Azure availability checks...`);
    const azureValidation = await azureValidationService.validateResourceGroupForCloning(
      sourceResourceGroup,
      targetResourceGroup,
      resources || []
    );
    
    console.log(`✅ Azure validation completed:`, {
      isValid: azureValidation.isValid,
      criticalIssues: azureValidation.criticalIssues.length,
      warnings: azureValidation.warnings.length
    });
    
    // Step 1.5: Check quota availability across regions (CRITICAL for preventing execution errors)
    console.log(`🔍 Step 1.5: Checking quota availability across multiple regions...`);
    const quotaCheck = await azureValidationService.checkQuotaAcrossRegions('B1');
    
    console.log(`✅ Quota check completed:`, {
      availableRegions: quotaCheck.availableRegions.length,
      exhaustedRegions: quotaCheck.exhaustedRegions.length,
      skipped: quotaCheck.skippedValidation
    });
    
    // Log top 3 available regions for visibility
    if (quotaCheck.availableRegions.length > 0) {
      console.log(`   Top regions with quota:`);
      quotaCheck.availableRegions.slice(0, 3).forEach(r => {
        console.log(`   • ${r.region}: ${r.available} available (${r.percentUsed}% used)`);
      });
    }
    
    // Build validation context
    const validationContext = {
      sourceResourceGroup,
      targetResourceGroup,
      resourceCount: resources?.length || 0,
      resources: resources || [],
      discoveredResources,
      azureValidation, // Include real Azure validation results
      quotaCheck // Include quota availability across regions
    };
    
    // System prompt for cloning validation (Step 2: AI analysis with Azure validation results)
    console.log(`🔍 Step 2: AI analysis with Azure validation results...`);
    
    const systemPrompt = `You are an expert Azure resource cloning validation specialist with real-time Azure availability data.

Your task is to analyze discovered Azure resources and validate their configurations for cloning, considering ACTUAL Azure availability checks.

SOURCE RESOURCE GROUP: ${sourceResourceGroup}
TARGET RESOURCE GROUP: ${targetResourceGroup}
RESOURCES TO CLONE: ${resources.length}

DISCOVERED RESOURCES:
${JSON.stringify(discoveredResources, null, 2)}

🔍 REAL AZURE VALIDATION RESULTS:
${JSON.stringify(azureValidation, null, 2)}

🎯 QUOTA AVAILABILITY ACROSS REGIONS (CRITICAL!):
${JSON.stringify(quotaCheck, null, 2)}

CRITICAL: Use the REAL Azure validation and quota results above to make recommendations!
- If quota is exhausted in source region, RECOMMEND a region from availableRegions list
- Priority order: centralindia > southindia > westus > westus2 (based on quota availability)
- Show user TOP 3 regions with available quota in the validation modal
- If current region has quota, validate it can accommodate all resources
- If quota is exhausted, provide clear alternatives and reasoning

⚠️ QUOTA VALIDATION REQUIREMENTS:
1. Check if source region appears in exhaustedRegions list
2. If yes, RECOMMEND top region from availableRegions (highest quota first)
3. Include quota details in recommendedRegion field (e.g., "centralindia (10 available)")
4. Add WARNING if quota is low (< 3 available)
5. If NO regions have quota, flag as CRITICAL BLOCKER

CRITICAL VALIDATION RULES:

1. UNIQUE NAMES FOR ALL RESOURCES:
   - Web Apps: MUST be globally unique
   - Storage Accounts: MUST be globally unique (lowercase, no hyphens, 3-24 chars)
   - SQL Servers: MUST be globally unique
   - SQL Databases: Must be unique within server
   - App Service Plans: Must be unique within subscription
   - Add timestamp suffix: -${timestamp} or -clone-${timestamp}

2. RUNTIME FORMATS (for Web Apps on Linux):
   - Correct format matches az webapp list-runtimes --os-type linux: "NODE:20-lts", "PYTHON:3.12", "DOTNETCORE:8.0"
   - Use STACK:version (uppercase stack, colon). Node 18 is not available — map to NODE:20-lts
   - If discovery provides webAppConfig.deploymentDetails.runtime, use that value

3. LOCATION/REGION:
   - Use same location as source resource group
   - Convert friendly names to Azure codes (e.g., "India" → "centralindia")
   - Avoid EUAP/preview regions

4. SKU/TIER VALIDATION:
   - Check quota availability
   - Recommend Free → Basic → Standard tiers
   - Warn about quota limits

5. RESOURCE GROUP:
   - Target RG will be created if doesn't exist
   - Inherit location from source RG

6. DEPENDENCIES:
   - Web Apps depend on App Service Plans
   - SQL Databases depend on SQL Servers
   - Validate dependency order

7. CONFIGURATIONS TO PRESERVE:
   - Connection strings (with new resource names)
   - App settings
   - Firewall rules
   - Network configurations
   - Tags

RESPONSE FORMAT (JSON):
{
  "sourceInfo": {
    "resourceGroup": "${sourceResourceGroup}",
    "location": "detected-location",
    "resourceCount": ${resources.length}
  },
  "targetInfo": {
    "resourceGroup": "${targetResourceGroup}",
    "location": "same-as-source-or-recommended",
    "willBeCreated": true
  },
  "azureValidationStatus": {
    "regionAvailable": true|false,
    "quotaAvailable": true|false,
    "quotaDetails": "e.g., 0/10 used in eastus, quota exhausted",
    "skusAvailable": true|false,
    "criticalIssues": ["list of issues that must be resolved"],
    "recommendedRegion": "region with details e.g., 'centralindia (10 available, 0% used)'",
    "alternativeRegions": [
      {
        "region": "centralindia",
        "available": 10,
        "percentUsed": 0,
        "reason": "Best choice - highest available quota"
      },
      {
        "region": "southindia",
        "available": 5,
        "percentUsed": 50,
        "reason": "Good alternative - moderate quota"
      },
      {
        "region": "westus",
        "available": 3,
        "percentUsed": 70,
        "reason": "Fallback option - limited quota"
      }
    ],
    "recommendedSKUs": {"appServicePlan": "B1", "webApp": "NODE:20-lts"}
  },
  "validatedResources": [
    {
      "originalName": "resource-name",
      "newName": "resource-name-${timestamp}",
      "type": "WebApp|Storage|Database|Network|etc",
      "status": "validated|corrected|requires-alternatives",
      "azureStatus": "available|unavailable|quota-exceeded",
      "corrections": ["list of corrections applied"],
      "alternatives": {
        "region": ["alternative-regions if needed"],
        "sku": ["alternative-skus if needed"],
        "runtime": ["alternative-runtimes if needed"]
      },
      "config": {
        "runtime": "corrected-runtime or alternative",
        "sku": "validated-sku or alternative",
        "location": "validated-location or alternative"
      }
    }
  ],
  "validatedConfig": {
    "targetResourceGroup": "${targetResourceGroup}",
    "location": "validated-location-or-alternative",
    "timestamp": "${timestamp}",
    "resourceMappings": {
      "original-name": "new-unique-name"
    }
  },
  "globalCorrections": [
    {
      "description": "Corrected web app runtime formats",
      "fix": "Normalized Linux runtimes to az webapp list-runtimes format (e.g. NODE:20-lts); retired Node majors mapped to 20-lts",
      "reason": "Azure CLI requires STACK:version; pipe/lowercase node|18-lts is rejected"
    }
  ],
  "warnings": [
    "Warning messages based on REAL Azure validation results"
  ],
  "recommendations": [
    "Actionable recommendations based on Azure availability checks"
  ],
  "estimatedCost": "₹X,XXX - ₹X,XXX/month (based on recommended SKUs)",
  "estimatedTime": "Script: 2-5 minutes, Full deployment: 15-30 minutes",
  "summary": "All X resources validated. Y corrections applied. Z alternatives suggested. Ready for cloning with recommended configurations!",
  "requiresUserConfirmation": true|false,
  "confirmationMessage": "Please review and accept the suggested alternatives before proceeding"
}

IMPORTANT - USE REAL AZURE VALIDATION RESULTS:
- Analyze ALL resources thoroughly
- **USE the Azure validation results above to make intelligent recommendations**
- If quota is exhausted → suggest the alternatives from Azure validation
- If region is unavailable → recommend from azureValidation.recommendedRegions
- If SKU is unavailable → suggest the alternatives from Azure validation
- If runtime is not available → recommend alternatives from validation
- Generate globally unique names for EVERY resource that requires it
- Correct ALL configuration issues automatically based on REAL availability
- Set requiresUserConfirmation = true if alternatives are suggested
- Provide clear explanations for corrections with Azure validation context
- Return ONLY valid JSON, no markdown

CRITICAL: Your recommendations MUST be based on the REAL Azure validation results provided above!
Don't guess - use the actual availability data from Azure APIs!`;

    // Call AI for validation
    const aiResponse = await aiAgentService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Validate the cloning configuration and provide a complete validation report.` }
    ]);
    
    let validationResult;
    try {
      // Extract JSON from response
      const responseText = aiResponse?.message || aiResponse;
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      validationResult = JSON.parse(cleanedResponse);
      
      // Post-process: Ensure all required fields are present
      validationResult.sourceInfo = validationResult.sourceInfo || {
        resourceGroup: sourceResourceGroup,
        resourceCount: resources.length
      };
      
      validationResult.targetInfo = validationResult.targetInfo || {
        resourceGroup: targetResourceGroup
      };
      
      validationResult.validatedResources = validationResult.validatedResources || [];
      validationResult.validatedConfig = validationResult.validatedConfig || {};
      validationResult.warnings = validationResult.warnings || [];
      
      console.log(`✅ Validation complete: ${validationResult.validatedResources?.length || 0} resources validated`);
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI validation response:', parseError);
      
      // Fallback validation result
      validationResult = {
        sourceInfo: {
          resourceGroup: sourceResourceGroup,
          resourceCount: resources.length
        },
        targetInfo: {
          resourceGroup: targetResourceGroup,
          willBeCreated: true
        },
        validatedResources: resources.map(r => ({
          originalName: r.name,
          newName: `${r.name}-clone-${timestamp}`,
          type: r.type,
          status: 'validated',
          corrections: []
        })),
        validatedConfig: {
          targetResourceGroup,
          timestamp
        },
        warnings: ['AI validation encountered an error, using safe default configuration'],
        summary: 'Default validation applied. All resources will be cloned with safe configurations.'
      };
    }
    
    res.json(validationResult);
    
  } catch (error) {
    console.error('❌ Clone validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Clone validation failed',
      message: error.message
    });
  }
});

// Analyze resources and generate cloning strategy (with validated config)
router.post('/analyze', async (req, res) => {
  try {
    const { resourceGroupData, targetResourceGroupName, validatedConfig } = req.body;
    
    if (!resourceGroupData || !targetResourceGroupName) {
      return res.status(400).json({
        success: false,
        error: 'Resource group data and target name are required'
      });
    }
    
    console.log(`🤖 Analyzing resources for cloning to: ${targetResourceGroupName}`);
    if (validatedConfig) {
      console.log(`✅ Using validated configuration with ${Object.keys(validatedConfig.resourceMappings || {}).length} resource mappings`);
    }
    
    const strategy = await aiAgentService.analyzeAndGenerateStrategy(
      resourceGroupData,
      targetResourceGroupName,
      validatedConfig
    );
    
    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Resource analysis failed',
      message: error.message
    });
  }
});

// Generate Terraform configuration (with validated config)
router.post('/generate-terraform', async (req, res) => {
  try {
    const { resourceGroupData, targetResourceGroupName, validatedConfig } = req.body;
    
    if (!resourceGroupData || !targetResourceGroupName) {
      return res.status(400).json({
        success: false,
        error: 'Resource group data and target name are required'
      });
    }
    
    console.log(`📝 Generating Terraform configuration...`);
    if (validatedConfig) {
      console.log(`✅ Using validated configuration for Terraform generation`);
    }
    
    const terraformConfig = await aiAgentService.generateTerraformConfig(
      resourceGroupData,
      targetResourceGroupName,
      validatedConfig
    );
    
    res.json({
      success: true,
      data: {
        terraform: terraformConfig,
        filename: `${targetResourceGroupName}-clone.tf`
      }
    });
  } catch (error) {
    console.error('❌ Terraform generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Terraform generation failed',
      message: error.message
    });
  }
});

// Generate Azure CLI scripts (with validated config)
router.post('/generate-cli', async (req, res) => {
  try {
    const { resourceGroupData, targetResourceGroupName, validatedConfig, useStaticScript } = req.body;
    
    if (!resourceGroupData || !targetResourceGroupName) {
      return res.status(400).json({
        success: false,
        error: 'Resource group data and target name are required'
      });
    }
    
    // Check if static script toggle is ON
    if (useStaticScript === true) {
      console.log(`📝 Using static Azure CLI script (toggle is ON)...`);
      console.log(`Source RG: ${resourceGroupData.resourceGroup?.name}`);
      console.log(`Target RG: ${targetResourceGroupName}`);
      
      // Get static script with dynamic values
      const cliScript = aiAgentService.getStaticCLIScript(
        resourceGroupData,
        targetResourceGroupName,
        validatedConfig
      );
      
      console.log(`✅ Static CLI script generated successfully (${cliScript.length} characters)`);
      
      res.json({
        success: true,
        data: {
          script: cliScript,
          filename: `clone-${targetResourceGroupName}.sh`
        }
      });
      return;
    }
    
    // Original AI-generated script flow (toggle is OFF)
    console.log(`📝 Generating Azure CLI scripts with AI...`);
    console.log(`Source RG: ${resourceGroupData.resourceGroup?.name}`);
    console.log(`Target RG: ${targetResourceGroupName}`);
    console.log(`Resources to clone: ${resourceGroupData.resources?.length || 0}`);
    
    if (validatedConfig) {
      console.log(`✅ Using validated configuration for CLI script generation`);
      console.log(`Validated resources count: ${validatedConfig.validatedResources?.length || 0}`);
      console.log(`Resource mappings:`, JSON.stringify(validatedConfig.validatedConfig?.resourceMappings || validatedConfig.resourceMappings || {}, null, 2));
    } else {
      console.log(`⚠️  No validated configuration provided - generating with default names`);
    }
    
    const cliScript = await aiAgentService.generateAzureCLIScripts(
      resourceGroupData,
      targetResourceGroupName,
      validatedConfig
    );
    
    console.log(`✅ CLI script generated successfully (${cliScript.length} characters)`);
    
    // Log preview of generated script for debugging
    console.log(`📄 Script preview (first 500 chars):`);
    console.log(cliScript.substring(0, 500));
    console.log(`📄 ...`);
    
    // Check for problematic parameters in the raw script
    const problematicParams = ['multicontainer', '--container-image', '--docker-', '--runtime', '--vnet-route'];
    const foundProblems = [];
    for (const param of problematicParams) {
      if (cliScript.toLowerCase().includes(param.toLowerCase())) {
        foundProblems.push(param);
      }
    }
    
    if (foundProblems.length > 0) {
      console.error(`🚨 WARNING: Generated script contains problematic parameters: ${foundProblems.join(', ')}`);
      console.error(`   These parameters may cause "multicontainer" error!`);
      console.error(`   Script cleaner will attempt to remove them...`);
    } else {
      console.log(`✅ No problematic parameters detected in generated script`);
    }
    
    res.json({
      success: true,
      data: {
        script: cliScript,
        filename: `clone-${targetResourceGroupName}.sh`
      }
    });
  } catch (error) {
    console.error('❌ CLI script generation failed:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'CLI script generation failed',
      message: error.message
    });
  }
});

// Get current actual costs for resource group
router.post('/get-actual-costs', async (req, res) => {
  try {
    const { resourceGroupName, days } = req.body;
    
    if (!resourceGroupName) {
      return res.status(400).json({
        success: false,
        error: 'Resource group name is required'
      });
    }
    
    console.log(`💰 Fetching actual costs for resource group: ${resourceGroupName}`);
    
    const actualCosts = await azureServiceInstance.getResourceGroupCosts(resourceGroupName, days || 30);
    
    // Log the original cost from Azure API
    console.log(`📊 Original cost from Azure: ${actualCosts.totalCost.toFixed(2)} ${actualCosts.currency}`);
    
    // Convert USD to INR (1 USD = 83 INR approximately as of Nov 2025)
    const USD_TO_INR = 83;
    
    const costsInINR = {
      ...actualCosts,
      totalCost: actualCosts.totalCost * USD_TO_INR,
      originalCurrency: actualCosts.currency,
      currency: 'INR',
      exchangeRate: USD_TO_INR,
      breakdown: actualCosts.breakdown.map(item => ({
        ...item,
        totalCost: item.totalCost * USD_TO_INR,
        costByCategory: Object.fromEntries(
          Object.entries(item.costByCategory).map(([key, value]) => [key, value * USD_TO_INR])
        )
      }))
    };
    
    console.log(`💵 Converted cost to INR: ₹${costsInINR.totalCost.toFixed(2)} (Rate: ${USD_TO_INR})`);
    
    res.json({
      success: true,
      data: costsInINR
    });
  } catch (error) {
    console.error('❌ Failed to get actual costs:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get actual costs',
      message: error.message
    });
  }
});

// Estimate cost (kept for backward compatibility but deprecated)
router.post('/estimate-cost', async (req, res) => {
  try {
    const { resourceGroupData } = req.body;
    
    if (!resourceGroupData) {
      return res.status(400).json({
        success: false,
        error: 'Resource group data is required'
      });
    }
    
    console.log(`💰 Getting actual costs for ${resourceGroupData.resourceGroup.name}...`);
    
    // Use actual costs instead of AI estimation
    const actualCosts = await azureServiceInstance.getResourceGroupCosts(resourceGroupData.resourceGroup.name, 30);
    
    // Log the original cost from Azure API
    console.log(`📊 Original cost from Azure: ${actualCosts.totalCost.toFixed(2)} ${actualCosts.currency}`);
    
    // Convert to INR
    const USD_TO_INR = 83;
    
    const costsInINR = {
      ...actualCosts,
      totalCost: actualCosts.totalCost * USD_TO_INR,
      originalCurrency: actualCosts.currency,
      currency: 'INR',
      exchangeRate: USD_TO_INR,
      breakdown: actualCosts.breakdown.map(item => ({
        ...item,
        totalCost: item.totalCost * USD_TO_INR,
        costByCategory: Object.fromEntries(
          Object.entries(item.costByCategory).map(([key, value]) => [key, value * USD_TO_INR])
        )
      }))
    };
    
    console.log(`💵 Converted cost to INR: ₹${costsInINR.totalCost.toFixed(2)} (Rate: ${USD_TO_INR})`);
    
    res.json({
      success: true,
      data: costsInINR
    });
  } catch (error) {
    console.error('❌ Cost estimation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Cost estimation failed',
      message: error.message
    });
  }
});

// Chat with AI Agent
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }
    
    console.log(`💬 Processing chat message...`);
    
    const response = await aiAgentService.chat(messages, context || {});
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ Chat failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Chat failed',
      message: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  const isConfigured = Boolean(
    process.env.AZURE_OPENAI_AGENT_ENDPOINT &&
    process.env.AZURE_OPENAI_AGENT_KEY
  );
  
  res.json({
    success: true,
    data: {
      status: isConfigured ? 'configured' : 'not_configured',
      endpoint: process.env.AZURE_OPENAI_AGENT_ENDPOINT ? 'set' : 'not_set',
      apiKey: process.env.AZURE_OPENAI_AGENT_KEY ? 'set' : 'not_set',
      deployment: process.env.AZURE_OPENAI_AGENT_DEPLOYMENT || 'gpt-4o (default)'
    }
  });
});

// Execute Azure CLI script
router.post('/execute-cli', async (req, res) => {
  try {
    const { script, options } = req.body;
    
    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Script is required'
      });
    }
    
    const sessionId = uuidv4();
    
    console.log(`🚀 Starting Azure CLI execution: ${sessionId}`);
    
    // Start execution in background
    executionService.executeAzureCLI(sessionId, script, options || {})
      .catch(error => {
        console.error(`❌ Execution ${sessionId} failed:`, error.message);
      });
    
    // Return session ID immediately for polling
    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Execution started. Poll /execution-status/:sessionId for updates.'
      }
    });
  } catch (error) {
    console.error('❌ Execute CLI failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Execution failed to start',
      message: error.message
    });
  }
});

// Execute Terraform configuration
router.post('/execute-terraform', async (req, res) => {
  try {
    const { terraform, options } = req.body;
    
    if (!terraform) {
      return res.status(400).json({
        success: false,
        error: 'Terraform configuration is required'
      });
    }
    
    const sessionId = uuidv4();
    
    console.log(`🚀 Starting Terraform execution: ${sessionId}`);
    
    // Start execution in background
    executionService.executeTerraform(sessionId, terraform, options || {})
      .catch(error => {
        console.error(`❌ Execution ${sessionId} failed:`, error.message);
      });
    
    // Return session ID immediately for polling
    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Terraform execution started. Poll /execution-status/:sessionId for updates.'
      }
    });
  } catch (error) {
    console.error('❌ Execute Terraform failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Execution failed to start',
      message: error.message
    });
  }
});

// Get execution status
router.get('/execution-status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const execution = executionService.getExecution(sessionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }
    
    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    console.error('❌ Get execution status failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status',
      message: error.message
    });
  }
});

// Cancel execution
router.post('/cancel-execution/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const cancelled = await executionService.cancelExecution(sessionId);
    
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or already completed'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'Execution cancelled'
      }
    });
  } catch (error) {
    console.error('❌ Cancel execution failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel execution',
      message: error.message
    });
  }
});

/**
 * Handle interactive prompt response
 */
router.post('/prompt-response', async (req, res) => {
  try {
    const { promptId, action, userInput } = req.body;
    
    if (!promptId || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: promptId and action'
      });
    }
    
    console.log(`📥 Handling prompt response: ${promptId}`);
    console.log(`   Action: ${action}`);
    console.log(`   User input: ${JSON.stringify(userInput || {})}`);
    
    const userResponse = {
      action,
      userInput: userInput || {}
    };
    
    const execution = await executionService.handlePromptResponse(promptId, userResponse);
    
    res.json({
      success: true,
      data: execution
    });
    
  } catch (error) {
    console.error('❌ Handle prompt response failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to handle prompt response',
      message: error.message
    });
  }
});

/**
 * Generate Azure CLI script for operations
 */
router.post('/generate-operation-script', async (req, res) => {
  try {
    const { query, context, validatedConfig } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    console.log(`🤖 Generating operation script for: ${query.substring(0, 50)}...`);
    if (validatedConfig) {
      console.log(`✅ Using validated configuration:`, JSON.stringify(validatedConfig, null, 2));
    }
    
    // Build system prompt for operations
    const systemPrompt = `You are an expert Azure DevOps engineer specialized in generating executable Azure CLI scripts.

TASK: Generate a complete, executable bash script for Azure operations.

USER REQUEST: ${query}

CONTEXT:
${context?.selectedResourceGroup ? `- Selected Resource Group: ${context.selectedResourceGroup}` : ''}
${context?.discoveredResources ? `- Discovered Resources: ${JSON.stringify(context.discoveredResources, null, 2)}` : ''}

🚨🚨🚨 CRITICAL: SQL SERVER NAME FORMAT (MANDATORY!) 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IF the user request involves SQL Server or SQL Database operations:

❌ WRONG FORMAT (WILL CAUSE HANGING):
   SQL_SERVER_NAME="sqlserver-16428.database.windows.net"
   az sql db create --server "sqlserver-16428.database.windows.net" ...

✅ CORRECT FORMAT (WORKS INSTANTLY):
   SQL_SERVER_NAME="sqlserver-16428"
   az sql db create --server "sqlserver-16428" ...

🎯 MANDATORY RULES:
1. NEVER include .database.windows.net in SQL server names
2. Azure CLI automatically appends .database.windows.net internally
3. Using FQDN causes DNS resolution failure: "server.database.windows.net.database.windows.net"
4. This causes CLI to hang indefinitely at "Running..." or "Fetching more output..."

VALIDATION BEFORE ANY SQL COMMAND:
\`\`\`bash
# If extracting server name from discovered resources or user input
if [[ "$SQL_SERVER_NAME" == *.database.windows.net ]]; then
  SQL_SERVER_NAME="\${SQL_SERVER_NAME%.database.windows.net}"
  echo "Stripped .database.windows.net suffix from server name"
fi
echo "Using SQL server name: $SQL_SERVER_NAME"
\`\`\`

EXAMPLES:
✅ CORRECT: az sql db create --server "myserver" --name "mydb" ...
❌ WRONG: az sql db create --server "myserver.database.windows.net" --name "mydb" ...

✅ CORRECT: az sql db copy --server "source-server" --dest-server "target-server" ...
❌ WRONG: az sql db copy --server "source-server.database.windows.net" --dest-server "target-server.database.windows.net" ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${validatedConfig ? `
🔥 VALIDATED CONFIGURATION (MUST USE THESE EXACT LITERAL VALUES):
${JSON.stringify(validatedConfig, null, 2)}

⚠️⚠️⚠️ CRITICAL RULES - READ CAREFULLY:

1. VARIABLE ASSIGNMENTS - USE EXACT LITERAL VALUES (NO $RANDOM, NO VARIABLES):
   ${validatedConfig.resourceName || validatedConfig.name ? `WEB_APP_NAME="${validatedConfig.resourceName || validatedConfig.name}"` : ''}
   ${validatedConfig.planName ? `APP_SERVICE_PLAN_NAME="${validatedConfig.planName}"` : ''}
   ${validatedConfig.location || validatedConfig.region ? `LOCATION="${validatedConfig.location || validatedConfig.region}"` : ''}
   ${validatedConfig.resourceGroupName || validatedConfig.resourceGroup ? `RESOURCE_GROUP="${validatedConfig.resourceGroupName || validatedConfig.resourceGroup}"` : ''}
   ${validatedConfig.runtime ? `RUNTIME="${validatedConfig.runtime}"` : ''}
   ${validatedConfig.planSku || validatedConfig.sku ? `SKU="${validatedConfig.planSku || validatedConfig.sku}"` : ''}

   ❌ WRONG: WEB_APP_NAME="nit-webapp-$RANDOM"
   ✅ RIGHT: WEB_APP_NAME="${validatedConfig.resourceName || validatedConfig.name || 'exact-validated-name'}"

2. RESOURCE GROUP - ALWAYS CREATE OR VERIFY FIRST:
   echo "Ensuring Resource Group exists..."
   az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none || true

3. APP SERVICE PLAN - DO NOT USE --no-wait (must wait for completion):
   echo "Creating App Service Plan..."
   az appservice plan create \\
     --name "$APP_SERVICE_PLAN_NAME" \\
     --resource-group "$RESOURCE_GROUP" \\
     --location "$LOCATION" \\
     --sku "$SKU" \\
     --is-linux
   
   ❌ DO NOT ADD: --no-wait (plan must be ready before web app creation)
   ✅ REMOVE --no-wait or use: az appservice plan wait --name "$APP_SERVICE_PLAN_NAME" --resource-group "$RESOURCE_GROUP" --created

4. WEB APP CREATION - OPTION A (RECOMMENDED - WAIT FOR COMPLETION):
   echo "Creating Web App..."
   az webapp create \\
     --name "$WEB_APP_NAME" \\
     --resource-group "$RESOURCE_GROUP" \\
     --plan "$APP_SERVICE_PLAN_NAME" \\
     --runtime "$RUNTIME"
   
   ❌ DO NOT ADD: --no-wait (will cause verification to fail)
   
   OPTION B (IF USING --no-wait, MUST ADD WAIT COMMAND):
   az webapp create ... --no-wait
   echo "Waiting for Web App to be ready..."
   az webapp wait --name "$WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --created

5. VERIFICATION - ONLY AFTER CREATION IS COMPLETE:
   echo "Verifying Web App..."
   WEB_APP_URL=$(az webapp show --name "$WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
   echo "✅ Web App URL: https://$WEB_APP_URL"

🚨 ABSOLUTELY FORBIDDEN:
- DO NOT use $RANDOM in variable assignments when validated config is provided
- DO NOT use --no-wait for App Service Plan creation
- DO NOT verify web app immediately after --no-wait (must wait first)
- DO NOT skip resource group creation/verification
` : ''}

🚨🚨🚨 WEB APP CREATION - ULTRA-STRICT ANTI-HANG RULES (MANDATORY!) 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❗ CRITICAL: Web app creation hangs at "Fetching more output..." due to 5 reasons:
   1. ❌ Non-unique names → Azure rejects silently → CLI hangs FOREVER
   2. ❌ Wrong runtime format → Invalid → CLI hangs FOREVER
   3. ❌ Microsoft.Web provider not registered → CLI hangs FOREVER
   4. ❌ Plan is Linux but script uses Windows runtime → CLI hangs FOREVER
   5. ❌ Name collision not detected pre-creation → CLI hangs FOREVER

🔥 CONSEQUENCE: numberOfSites stays 0, user waits 30-40 minutes, NOTHING HAPPENS!

✅ SOLUTION (MANDATORY 5-STEP ANTI-HANG PROCESS):

📋 STEP 1: GENERATE GLOBALLY UNIQUE NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${validatedConfig ? `
# Use validated name (already unique)
WEB_APP_NAME="${validatedConfig.resourceName || validatedConfig.name || 'validated-name'}"
` : `
# Generate unique name with random suffix
BASE_NAME="my-webapp"
WEB_APP_NAME="\${BASE_NAME}-$RANDOM"
echo "Generated unique web app name: $WEB_APP_NAME"
`}

📋 STEP 2: CHECK MICROSOFT.WEB PROVIDER REGISTRATION (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${validatedConfig ? `
# Provider already validated
echo "Using validated subscription with registered providers"
` : `
# MANDATORY: Check if Microsoft.Web is registered (common cause of hanging!)
echo "Checking Microsoft.Web provider registration..."
PROVIDER_STATE=$(az provider show --namespace Microsoft.Web --query "registrationState" -o tsv 2>/dev/null || echo "NotRegistered")

if [ "$PROVIDER_STATE" != "Registered" ]; then
  echo "⚠️  WARNING: Microsoft.Web provider is '$PROVIDER_STATE'"
  echo "   This WILL cause web app creation to hang!"
  echo "   Registering provider (takes 2-3 minutes)..."
  az provider register --namespace Microsoft.Web --wait
  az provider register --namespace Microsoft.DomainRegistration --wait
  az provider register --namespace Microsoft.Storage --wait
  echo "✅ Providers registered successfully"
else
  echo "✅ Microsoft.Web provider already registered"
fi
`}

📋 STEP 3: ULTRA-STRICT NAME AVAILABILITY VALIDATION (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${validatedConfig ? `
# Skip pre-validation (already validated by system)
echo "Using pre-validated name: $WEB_APP_NAME"
` : `
# MANDATORY: TRIPLE-CHECK name availability using multiple methods
echo "Step 3a: Validating web app name globally (Method 1)..."
EXISTING_APP_COUNT=$(az webapp list --query "[?name=='$WEB_APP_NAME']" | jq 'length' 2>/dev/null || echo "0")

if [ "$EXISTING_APP_COUNT" != "0" ]; then
  echo "❌ ERROR: Name '$WEB_APP_NAME' already exists globally (found $EXISTING_APP_COUNT match)"
  echo "   Regenerating with timestamp..."
  WEB_APP_NAME="\${BASE_NAME}-$(date +%s | tail -c 7)-$RANDOM"
  echo "   New name: $WEB_APP_NAME"
fi

echo "Step 3b: Validating web app name globally (Method 2 - DNS check)..."
# Check if DNS name is available (web apps use <name>.azurewebsites.net)
DNS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://\${WEB_APP_NAME}.azurewebsites.net" || echo "000")
if [ "$DNS_CHECK" != "000" ] && [ "$DNS_CHECK" != "404" ]; then
  echo "⚠️  WARNING: DNS name '\${WEB_APP_NAME}.azurewebsites.net' responds (code: $DNS_CHECK)"
  echo "   This indicates the name may be taken. Regenerating..."
  WEB_APP_NAME="\${BASE_NAME}-$(date +%s | tail -c 7)-$RANDOM"
  echo "   New name: $WEB_APP_NAME"
fi

echo "Step 3c: Final name validation..."
FINAL_CHECK=$(az webapp list --query "[?name=='$WEB_APP_NAME'].name" -o tsv)
if [ -n "$FINAL_CHECK" ]; then
  echo "❌ FATAL: Name '$WEB_APP_NAME' STILL conflicts after regeneration!"
  echo "   Solution: Use a more unique base name (not 'webapp', 'app', 'test', etc.)"
  exit 1
fi

echo "✅ Web app name validated as GLOBALLY UNIQUE: $WEB_APP_NAME"
echo "   DNS: \${WEB_APP_NAME}.azurewebsites.net (will be available after creation)"
`}

📋 STEP 4: VALIDATE APP SERVICE PLAN PLATFORM (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${validatedConfig ? `
# Platform already validated
echo "Using validated platform configuration"
` : `
# MANDATORY: Check if App Service Plan is Linux or Windows
echo "Checking App Service Plan platform..."
PLAN_KIND=$(az appservice plan show --name "$APP_PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query "kind" -o tsv 2>/dev/null || echo "unknown")
PLAN_RESERVED=$(az appservice plan show --name "$APP_PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query "reserved" -o tsv 2>/dev/null || echo "false")

if [[ "$PLAN_KIND" == *"linux"* ]] || [ "$PLAN_RESERVED" == "true" ]; then
  echo "✅ Detected Linux App Service Plan"
  PLATFORM="linux"
else
  echo "✅ Detected Windows App Service Plan"
  PLATFORM="windows"
fi

echo "   Plan: $APP_PLAN_NAME"
echo "   Kind: $PLAN_KIND"
echo "   Platform: $PLATFORM"
`}

📋 STEP 5: USE CORRECT RUNTIME FORMAT FOR PLATFORM (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: Linux --runtime must match az webapp list-runtimes --os-type linux

FOR LINUX APPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CORRECT FORMATS (STACK:version from list-runtimes):
   --runtime "NODE:20-lts"     # ← Node 20 LTS (Node 18 removed from App Service)
   --runtime "NODE:22-lts"    # ← Node 22 LTS
   --runtime "PYTHON:3.12"   # ← Python
   --runtime "DOTNETCORE:8.0" # ← .NET 8
   --runtime "PHP:8.2"       # ← PHP
   
❌ WRONG FORMATS (CLI error "not supported"):
   --runtime "node|18-lts"    # ← pipe + lowercase — invalid
   --runtime "node|20-lts"    # ← same issue

FOR WINDOWS APPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Use: az webapp list-runtimes --os-type windows (format differs from Linux)

🎯 RECOMMENDATION: Prefer webAppConfig.deploymentDetails.runtime from discovery (already normalized)

🚨 COMPLETE WEB APP CREATION EXAMPLE (COPY THIS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#!/bin/bash
set -e
set -o pipefail

echo "🚀 ANTI-HANG WEB APP CREATION SCRIPT - 5-STEP VALIDATION"
echo "=========================================================="

# Variables
BASE_NAME="my-webapp"
RESOURCE_GROUP="my-rg"
LOCATION="centralindia"
APP_PLAN_NAME="my-plan"
SKU="B1"
RUNTIME="NODE:20-lts"  # ← Must match az webapp list-runtimes --os-type linux

echo ""
echo "STEP 1: Generating globally unique web app name..."
WEB_APP_NAME="\${BASE_NAME}-$RANDOM"
echo "✅ Generated name: $WEB_APP_NAME"

echo ""
echo "STEP 2: Checking Microsoft.Web provider registration..."
PROVIDER_STATE=$(az provider show --namespace Microsoft.Web --query "registrationState" -o tsv 2>/dev/null || echo "NotRegistered")
if [ "$PROVIDER_STATE" != "Registered" ]; then
  echo "⚠️  Provider not registered. Registering now (takes 2-3 minutes)..."
  az provider register --namespace Microsoft.Web --wait
  az provider register --namespace Microsoft.DomainRegistration --wait
  echo "✅ Providers registered"
else
  echo "✅ Microsoft.Web already registered"
fi

echo ""
echo "STEP 3: TRIPLE-checking web app name availability..."
echo "  3a. Method 1: Azure CLI query..."
EXISTING_COUNT=$(az webapp list --query "[?name=='$WEB_APP_NAME']" | jq 'length' 2>/dev/null || echo "0")
if [ "$EXISTING_COUNT" != "0" ]; then
  echo "  ⚠️  Name exists, regenerating..."
  WEB_APP_NAME="\${BASE_NAME}-$(date +%s | tail -c 7)-$RANDOM"
  echo "  New name: $WEB_APP_NAME"
fi

echo "  3b. Method 2: DNS availability check..."
DNS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://\${WEB_APP_NAME}.azurewebsites.net" 2>/dev/null || echo "000")
if [ "$DNS_CHECK" != "000" ] && [ "$DNS_CHECK" != "404" ]; then
  echo "  ⚠️  DNS responds, regenerating..."
  WEB_APP_NAME="\${BASE_NAME}-$(date +%s | tail -c 7)-$RANDOM"
fi

echo "  3c. Final validation..."
FINAL_CHECK=$(az webapp list --query "[?name=='$WEB_APP_NAME'].name" -o tsv)
if [ -n "$FINAL_CHECK" ]; then
  echo "  ❌ FATAL: Name still conflicts!"
  exit 1
fi
echo "✅ Name validated as GLOBALLY UNIQUE: $WEB_APP_NAME"

echo ""
echo "STEP 4: Creating/verifying resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none || true
echo "✅ Resource group ready"

echo ""
echo "STEP 5: Creating App Service Plan..."
az appservice plan create \\
  --name "$APP_PLAN_NAME" \\
  --resource-group "$RESOURCE_GROUP" \\
  --location "$LOCATION" \\
  --sku "$SKU" \\
  --is-linux
echo "✅ App Service Plan created"

echo ""
echo "STEP 6: Validating plan platform..."
PLAN_RESERVED=$(az appservice plan show --name "$APP_PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query "reserved" -o tsv)
if [ "$PLAN_RESERVED" == "true" ]; then
  echo "✅ Confirmed Linux plan - using Linux runtime format"
else
  echo "⚠️  WARNING: Plan may be Windows - adjust runtime if needed"
fi

echo ""
echo "STEP 7: Creating Web App with all validations complete..."
echo "  Name: $WEB_APP_NAME (validated unique)"
echo "  Plan: $APP_PLAN_NAME (Linux)"
echo "  Runtime: $RUNTIME (list-runtimes STACK:version format)"
az webapp create \\
  --name "$WEB_APP_NAME" \\
  --resource-group "$RESOURCE_GROUP" \\
  --plan "$APP_PLAN_NAME" \\
  --runtime "$RUNTIME"
echo "✅ Web app created successfully!"

echo ""
echo "STEP 8: Verifying deployment..."
WEB_APP_URL=$(az webapp show --name "$WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
APP_COUNT=$(az appservice plan show --name "$APP_PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query "numberOfSites" -o tsv)

echo ""
echo "=========================================================="
echo "✅ SUCCESS! Web app created in 45-60 seconds (NOT 30-40 minutes!)"
echo "=========================================================="
echo "  Name: $WEB_APP_NAME"
echo "  URL: https://$WEB_APP_URL"
echo "  Plan: $APP_PLAN_NAME (numberOfSites: $APP_COUNT)"
echo "  Status: READY"
echo "=========================================================="

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 CRITICAL ANTI-HANG REQUIREMENTS (MANDATORY FOR WEB APP CREATION!):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Generate ONLY executable bash script code (no markdown fences, no explanations after script)
2. Start with #!/bin/bash shebang
3. Add: set -e (exit on error) and set -o pipefail
4. Use Azure CLI commands (az ...)
${validatedConfig ? '5. USE EXACT LITERAL VALUES from validated config (NO $RANDOM, NO modifications)' : '5. MANDATORY: Generate globally unique names using $RANDOM + timestamp'}
6. Add detailed echo statements before each operation for visibility
7. Handle errors gracefully with error messages

${validatedConfig ? `
8. SKIP ALL validation steps (already validated by system)
9. Use validated provider, platform, and name configurations
` : `
8. MANDATORY: Check Microsoft.Web provider registration (STEP 2)
   - Query: az provider show --namespace Microsoft.Web --query "registrationState"
   - If not "Registered" → Register with --wait flag
   - This prevents CLI hanging due to unregistered provider

9. MANDATORY: TRIPLE-validate web app name availability (STEP 3)
   - Method 1: az webapp list --query "[?name=='$NAME']" | jq 'length'
   - Method 2: curl DNS check (https://$NAME.azurewebsites.net)
   - Method 3: Final az webapp list confirmation
   - If any conflict detected → Regenerate with timestamp + $RANDOM

10. MANDATORY: Validate App Service Plan platform (STEP 4)
    - Query plan "kind" and "reserved" properties
    - Detect if Linux or Windows
    - This prevents mixing incompatible runtimes

11. MANDATORY: Use correct runtime format for platform (STEP 5)
    - Linux: "NODE:20-lts" style from az webapp list-runtimes --os-type linux
    - Windows: use az webapp list-runtimes --os-type windows
    - NEVER: "node|18-lts" (pipe format — CLI rejects)
`}

12. NO emojis or special Unicode characters in script output
13. Create/verify resource group FIRST before any other resource
14. Wait for App Service Plan creation to complete (DO NOT use --no-wait for plan)
15. For Web App: Use ONLY minimal required parameters (--name, --resource-group, --plan, --runtime)
16. Verify resources ONLY after creation is complete (az webapp show)
17. Display final success with: name, URL, numberOfSites count
18. Output total execution time for user visibility

🚫 ABSOLUTELY FORBIDDEN (WILL CAUSE HANGING OR CLI ERRORS!):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ❌ Wrong Linux runtime: "node|18-lts" / pipe + lowercase (not supported — use NODE:20-lts from list-runtimes)
   ❌ Skipping provider registration check (causes HANG!)
   ❌ Skipping name pre-validation (causes HANG!)
   ❌ Using non-unique names like "webapp", "app", "test" (causes HANG!)
   ❌ Not regenerating name on conflict (causes HANG!)
   ❌ Using --no-wait for App Service Plan creation
   ❌ Verifying web app immediately without waiting for creation
   ❌ Mixing Linux runtime on Windows plan or vice versa (causes HANG!)

SCRIPT STRUCTURE:
${validatedConfig ? `
#!/bin/bash
set -e
set -o pipefail

# Variables from validated configuration
WEB_APP_NAME="${validatedConfig.resourceName || validatedConfig.name || 'exact-name'}"
RESOURCE_GROUP="${validatedConfig.resourceGroupName || validatedConfig.resourceGroup || 'exact-rg'}"
LOCATION="${validatedConfig.location || validatedConfig.region || 'centralindia'}"
APP_SERVICE_PLAN_NAME="${validatedConfig.planName || 'exact-plan'}"
SKU="${validatedConfig.planSku || validatedConfig.sku || 'B1'}"
RUNTIME="${validatedConfig.runtime || 'NODE:20-lts'}"

echo "Checking prerequisites..."
command -v az >/dev/null || { echo "Azure CLI not installed"; exit 1; }
az account show >/dev/null || { echo "Not logged in"; exit 1; }

echo "Step 1: Ensuring Resource Group exists..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none || true

echo "Step 2: Creating App Service Plan..."
az appservice plan create \\
  --name "$APP_SERVICE_PLAN_NAME" \\
  --resource-group "$RESOURCE_GROUP" \\
  --location "$LOCATION" \\
  --sku "$SKU" \\
  --is-linux

echo "Step 3: Creating Web App..."
az webapp create \\
  --name "$WEB_APP_NAME" \\
  --resource-group "$RESOURCE_GROUP" \\
  --plan "$APP_SERVICE_PLAN_NAME" \\
  --runtime "$RUNTIME"

echo "Step 4: Verifying deployment..."
WEB_APP_URL=$(az webapp show --name "$WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)

echo "✅ Deployment Complete"
echo "Web App: $WEB_APP_NAME"
echo "URL: https://$WEB_APP_URL"
` : `
1. Shebang and error handling (set -e, set -o pipefail)
2. Prerequisites check (Azure CLI, login status)
3. Variable definitions with unique names
4. Resource group creation/verification
5. App Service Plan creation (wait for completion)
6. Web App creation (wait for completion)
7. Verification and success message
`}

Generate the complete, executable script now (SCRIPT ONLY, NO EXPLANATIONS):`;

    const response = await aiAgentService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ]);
    
    let script = response?.message || response;
    
    if (typeof script !== 'string') {
      console.error('❌ AI returned invalid response type:', typeof script);
      throw new Error('AI returned invalid response type');
    }
    
    // Clean the script aggressively
    script = script.trim();
    
    // Remove markdown code fences
    script = script.replace(/^```(?:bash|sh|shell)?\n/gm, '');
    script = script.replace(/\n```$/gm, '');
    script = script.replace(/```/g, '');
    
    // Remove any explanations after the script
    // Look for common explanation markers
    const explanationMarkers = [
      /\n###\s+Explanation/i,
      /\n##\s+Explanation/i,
      /\n#\s+Explanation/i,
      /\n---\n###/,
      /\nBelow is the/i,
      /\nThe script/i,
      /\nThis script/i,
      /\nYou can execute/i,
      /\n\*\*Notes:\*\*/i,
      /\n\*\*Note:\*\*/i
    ];
    
    for (const marker of explanationMarkers) {
      const match = script.match(marker);
      if (match && match.index) {
        console.log(`✂️ Removing explanation section starting at position ${match.index}`);
        script = script.substring(0, match.index);
        break;
      }
    }
    
    script = script.trim();
    
    // Ensure script starts with shebang
    if (!script.startsWith('#!/bin/bash') && !script.startsWith('#!/usr/bin/env bash')) {
      console.warn('⚠️ Script missing shebang, adding it');
      script = '#!/bin/bash\n' + script;
    }
    
    console.log(`✅ Generated operation script (${script.length} chars, cleaned)`);
    
    res.json({
      success: true,
      data: {
        script,
        query,
        context
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to generate operation script:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate operation script',
      message: error.message
    });
  }
});

/**
 * Execute Azure CLI operation script
 */
router.post('/execute-operation-script', async (req, res) => {
  try {
    const { script, description } = req.body;
    
    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Script is required'
      });
    }
    
    console.log(`🚀 Executing Azure operation: ${description || 'Azure Operation'}`);
    
    // Execute using the execution service
    const sessionId = `aiagent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const execution = await executionService.executeAzureCLI(
      sessionId,
      script,
      description || 'Azure AI Agent Operation'
    );
    
    res.json({
      success: true,
      data: {
        sessionId,
        execution
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to execute operation script:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to execute operation script',
      message: error.message
    });
  }
});

/**
 * Get execution status (for operations tab polling)
 */
router.get('/execution/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    console.log(`📊 Getting execution status for session: ${sessionId}`);
    
    // Get execution status from execution service
    const execution = executionService.getExecution(sessionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
        message: `No execution found for session ${sessionId}`
      });
    }
    
    res.json({
      success: true,
      data: execution
    });
    
  } catch (error) {
    console.error('❌ Failed to get execution status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status',
      message: error.message
    });
  }
});

/**
 * Analyze execution errors and provide intelligent resolution
 */
router.post('/analyze-execution-error', async (req, res) => {
  try {
    const { query, output, errorOutput, status } = req.body;
    
    if (!output && !errorOutput) {
      return res.status(400).json({
        success: false,
        error: 'Output or error output is required'
      });
    }
    
    console.log(`🔍 Analyzing execution error for: ${query?.substring(0, 50)}...`);
    
    // Build system prompt for error analysis
    const systemPrompt = `You are an expert Azure AI Assistant specialized in analyzing Azure CLI errors and providing intelligent, actionable solutions.

TASK: Analyze the Azure CLI execution error and provide a comprehensive, easy-to-understand resolution guide.

USER'S ORIGINAL REQUEST: ${query || 'Azure operation'}

EXECUTION STATUS: ${status}

ERROR OUTPUT:
${errorOutput || output}

YOUR RESPONSE MUST INCLUDE:

1. **What Went Wrong** (Simple Explanation)
   - Explain the error in plain English
   - Avoid technical jargon where possible
   - Be clear and concise

2. **Why It Happened** (Root Cause)
   - Explain the underlying reason
   - Provide context about Azure limitations/requirements
   - Help user understand the system behavior

3. **How to Fix It** (Resolution Steps)
   - Provide clear, numbered steps
   - Include specific commands if needed
   - Explain each step briefly

4. **Corrected Approach** (Better Query/Command)
   - Suggest the correct way to achieve the goal
   - Provide an improved query/command
   - Explain why this approach is better

5. **Prevention** (Avoid Future Issues)
   - Tips to prevent similar errors
   - Best practices
   - Common pitfalls to avoid

6. **Recommended User Prompt** (MUST INCLUDE - VERY IMPORTANT)
   - Provide THE EXACT prompt/query the user should use to avoid this error
   - Make it copy-paste ready
   - Explain why this prompt will work
   - Make it the LAST section of your response

FORMAT REQUIREMENTS:
- Use markdown formatting for readability
- Use **bold** for important terms
- Use bullet points and numbered lists
- Use code blocks (triple backticks with bash) for commands - these will be displayed in green text on dark background
- Use inline code (single backticks) for short commands in text
- Use emoji strategically (⚠️ ❌ ✅ 💡 🔧 🎯 etc.)
- Be friendly and encouraging
- Focus on solutions, not just problems
- ALWAYS end with "Recommended User Prompt" section

EXAMPLE OUTPUT FORMAT:

## ❌ What Went Wrong

The resource group **react-nodejs-poc-rg** already exists in **eastus** region, but you're trying to create it in **centralindia**. Azure doesn't allow changing a resource group's location once created.

## 🔍 Why It Happened

Resource groups in Azure are tied to a specific location at creation time. This location cannot be changed later. When you try to create a resource group with a name that already exists but in a different location, Azure rejects it to prevent conflicts.

## 🔧 How to Fix It

You have **3 options**:

**Option 1: Use the existing resource group** (Recommended if you're okay with eastus)
\`\`\`bash
# Deploy your web app to the existing resource group in eastus
az webapp create --name myapp --resource-group react-nodejs-poc-rg --plan myplan
\`\`\`

**Option 2: Choose a different name** (Recommended for centralindia)
\`\`\`bash
# Create a new resource group with a different name
az group create --name react-nodejs-centralindia-rg --location centralindia
\`\`\`

**Option 3: Delete and recreate** (⚠️ Careful - this deletes all resources!)
\`\`\`bash
# Only if you're sure you want to delete everything
az group delete --name react-nodejs-poc-rg --yes
az group create --name react-nodejs-poc-rg --location centralindia
\`\`\`

## ✅ Corrected Query

**If you want to use Central India, ask me:**
> "Create a new web app called react-nodejs-app in a NEW resource group named react-nodejs-centralindia-rg in Central India region for React and Node.js"

**If you're okay with East US, ask me:**
> "Create a new web app called react-nodejs-app in the EXISTING resource group react-nodejs-poc-rg for React and Node.js"

## 💡 Prevention Tips

1. **Check existing resources first**: Use \`az group list\` to see what resource groups you already have
2. **Use descriptive names**: Include region in resource group names (e.g., \`myapp-eastus-rg\`, \`myapp-centralindia-rg\`)
3. **Plan your regions**: Decide on your preferred region before creating resources

## 🎯 Recommended User Prompt

**Copy and paste this exact prompt to avoid this error:**

> Create a new web app called react-nodejs-app in a NEW resource group named react-nodejs-centralindia-rg in Central India region for React and Node.js applications

**Why this works:**
- Uses a NEW resource group name (no conflict)
- Specifies the desired region (Central India)
- Clear and unambiguous
- Avoids the location conflict issue

**Alternative if you want East US:**

> Create a new web app called react-nodejs-app in the EXISTING resource group react-nodejs-poc-rg for React and Node.js applications

Generate your intelligent error analysis now:`;

    const response = await aiAgentService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please analyze this error and provide a comprehensive resolution guide.' }
    ]);
    
    let analysis = response?.message || response;
    
    if (typeof analysis !== 'string') {
      console.error('❌ AI returned invalid response type:', typeof analysis);
      throw new Error('AI returned invalid response type');
    }
    
    console.log(`✅ Generated error analysis (${analysis.length} chars)`);
    
    res.json({
      success: true,
      data: {
        analysis,
        query,
        status
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to analyze execution error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze execution error',
      message: error.message
    });
  }
});

/**
 * Analyze cloning execution errors (for AI Chat tab)
 */
router.post('/analyze-cloning-error', async (req, res) => {
  try {
    const { sourceResourceGroup, targetResourceGroup, output, errorOutput, status } = req.body;
    
    if (!output && !errorOutput) {
      return res.status(400).json({
        success: false,
        error: 'Output or error output is required'
      });
    }
    
    console.log(`🔍 Analyzing cloning error: ${sourceResourceGroup} → ${targetResourceGroup}`);
    
    // Build system prompt for cloning error analysis
    const systemPrompt = `You are an expert Azure AI Assistant specialized in analyzing Azure resource cloning errors and providing comprehensive, intelligent solutions.

TASK: Analyze the cloning execution error and provide a detailed, user-friendly resolution guide that helps the user successfully clone their resources.

CLONING CONTEXT:
- **Source Resource Group**: ${sourceResourceGroup}
- **Target Resource Group**: ${targetResourceGroup}
- **Operation**: Cloning Azure resources with exact configurations

EXECUTION STATUS: ${status}

FULL OUTPUT:
${output || 'No output available'}

ERROR DETAILS:
${errorOutput || 'No specific errors captured'}

YOUR COMPREHENSIVE RESPONSE MUST INCLUDE:

## ❌ **What Went Wrong** (Clear Explanation)
- Explain the error in **plain English**
- Identify which resource failed (e.g., App Service Plan, Web App, SQL Database)
- Be specific about what happened at which step

## 🔍 **Root Cause Analysis** (Why It Happened)
- Explain the underlying reason (quota, region, naming, permissions, etc.)
- Provide context about Azure limitations
- Identify cascading failures if any (e.g., Web App failed because Plan failed)

## 🔧 **Step-by-Step Resolution** (How to Fix It)
Provide **numbered, actionable steps** with specific commands:

1. **Immediate Fix** (What to do right now)
   - Specific Azure CLI commands
   - Portal navigation steps
   - Configuration changes

2. **Verification** (How to confirm it's fixed)
   - Check commands
   - What to look for

3. **Retry Cloning** (How to proceed after fix)
   - Updated parameters
   - Modified approach

## ✅ **Corrected Cloning Strategy** (Better Approach)
- Suggest the correct way to clone these resources
- Provide specific recommendations:
  * Different region? (with exact region name)
  * Different SKU/tier? (with exact SKU)
  * Request quota increase? (with exact quota type)
  * Skip problematic resources? (with alternatives)

## 💡 **Prevention & Best Practices**
- How to avoid this error in future cloning operations
- Pre-cloning checks to perform
- Best practices for Azure resource cloning
- Quota planning tips

## 🎯 **Recommended Next Steps** (What to Do Now)
Provide **THE EXACT actions** the user should take:
- Numbered list of immediate actions
- Expected outcome of each action
- Make it copy-paste ready where possible

FORMAT REQUIREMENTS:
- Use **markdown** with proper headings (##)
- Use **bold** for important terms and resource names
- Use emoji for visual organization (❌ 🔍 🔧 ✅ 💡 🎯 ⚠️ etc.)
- Use code blocks (\`\`\`bash) for commands
- Use inline code (\`) for resource names, SKUs, regions
- Use bullet points and numbered lists extensively
- Be friendly, encouraging, and solution-focused
- Assume the user will try cloning again after following your advice

CRITICAL FOCUS AREAS:
1. **Quota Issues**: If quota error → explain how to request increase, provide alternative regions/SKUs
2. **Cascading Failures**: If Plan failed → explain why Web App also failed
3. **Region Limitations**: If region error → suggest alternative regions
4. **Naming Conflicts**: If name exists → explain uniqueness requirements
5. **Permission Issues**: If auth error → explain required roles

EXAMPLE STRUCTURE FOR QUOTA ERROR:

## ❌ What Went Wrong

The cloning operation from **${sourceResourceGroup}** to **${targetResourceGroup}** failed when trying to create the **App Service Plan** \`basic-plan-248859-189412\`.

Azure rejected the creation because:
- Current quota limit for **Basic VMs in East US**: **5**
- Current usage: **5** (fully utilized)
- Required for this deployment: **1**
- **Total needed: 6** (exceeds current limit)

As a result:
1. ❌ App Service Plan creation **failed** (quota exceeded)
2. ❌ Web App creation **failed** (no plan to attach to)

## 🔍 Root Cause Analysis

**Primary Issue**: Quota Exhaustion
- Your Azure subscription has a limit of 5 Basic VMs in the East US region
- You're already using all 5 VMs
- The new App Service Plan (B1/B2/B3 tier) requires VM resources
- Azure cannot allocate additional VMs without a quota increase

**Cascading Effect**:
- The Web App \`nit-webapp-10901-189412\` couldn't be created because it depends on the App Service Plan
- This is expected behavior - Web Apps require an existing Plan

## 🔧 Step-by-Step Resolution

### **Option 1: Request Quota Increase** (Best for production)

1. **Request increase via Azure Portal:**
   \`\`\`bash
   # Or use this direct link
   https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest
   \`\`\`
   - Issue type: **Service and subscription limits (quotas)**
   - Quota type: **Compute-VM (cores-vCPUs) subscription limit increase**
   - Location: **East US**
   - Current limit: **5**
   - New limit: **10** (or more based on needs)
   - Justification: "Need additional capacity for cloning production resources"
   - **Approval time**: Usually 15 minutes to 24 hours

2. **Wait for approval email**

3. **Retry cloning** using the same validated configuration

### **Option 2: Use Different Region** (Fastest solution)

Clone to a region where you have available quota:

\`\`\`bash
# Check quota in other regions
az vm list-usage --location "centralindia" --query "[?name.value=='StandardBSFamily'].{Name:name.localizedValue, Current:currentValue, Limit:limit}" -o table

# Or try West US, West US 2, Central US
\`\`\`

**Retry cloning with:**
- Source: **${sourceResourceGroup}**
- Target: **${targetResourceGroup}-centralindia** (new name)
- Location: **Central India** (or any region with available quota)

### **Option 3: Use Free Tier** (Development/testing only)

\`\`\`bash
# F1 (Free) tier doesn't count against Basic VM quota
# But has limitations: 1 GB RAM, 60 min/day compute, 1 GB storage
\`\`\`

**Retry cloning and specify:**
- App Service Plan SKU: **F1 (Free)**
- ⚠️ Note: Not suitable for production workloads

### **Option 4: Delete Unused Resources** (Free up quota)

\`\`\`bash
# List all Basic tier App Service Plans
az appservice plan list --query "[?sku.tier=='Basic'].{Name:name, ResourceGroup:resourceGroup, SKU:sku.name}" -o table

# Delete unused plans (⚠️ This will delete associated web apps!)
az appservice plan delete --name <unused-plan> --resource-group <rg-name> --yes
\`\`\`

## ✅ Corrected Cloning Strategy

**Recommended Approach**: Use **Option 2** (Different Region)

1. Click **"Discover Resources"** again
2. Click **"Analyze with AI"**
3. When validation modal appears, note the validated names
4. Click **"Confirm & Proceed"**
5. Click **"Generate Azure CLI"**
6. **Before executing**, modify the script:
   - Change \`LOCATION="eastus"\` to \`LOCATION="centralindia"\`
   - Or use **West US 2**, **Central US**, **West Europe**
7. Execute the modified script

**Why this works**:
- Different regions have separate quota limits
- Central India likely has available Basic VM quota
- Same resource types, just different physical location

## 💡 Prevention & Best Practices

**Before cloning, always check:**

1. **Quota availability**:
   \`\`\`bash
   az vm list-usage --location "eastus" --query "[?name.value=='StandardBSFamily']" -o table
   \`\`\`

2. **Current resource usage**:
   \`\`\`bash
   az appservice plan list --query "[].{Name:name, Tier:sku.tier, Location:location}" -o table
   \`\`\`

3. **Alternative regions**:
   - Have 2-3 backup regions identified
   - Check quota in each before starting

4. **Plan capacity**:
   - Know your subscription limits
   - Request increases proactively for production

## 🎯 Recommended Next Steps

**Do this RIGHT NOW (Choose one):**

**Fast Track** (15 minutes):
\`\`\`
1. Go back to AI Agent
2. Click "Discover Resources" for ${sourceResourceGroup}
3. Change target region to "Central India" or "West US 2"
4. Proceed with cloning to new region
\`\`\`

**OR**

**Request Quota** (Wait 15 min - 24 hours):
\`\`\`
1. Go to: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest
2. Select: Service limits → Compute-VM → East US → Request increase to 10
3. Submit request
4. Wait for approval email
5. Retry cloning to East US
\`\`\`

**Expected Outcome**:
- ✅ All resources cloned successfully
- ✅ App Service Plan created
- ✅ Web App created and running
- ✅ No quota errors

**Need help?** Ask me: *"Clone ${sourceResourceGroup} to Central India region instead of East US"*

Generate your comprehensive cloning error analysis now:`;

    const response = await aiAgentService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please analyze this cloning error and provide a comprehensive, actionable resolution guide.' }
    ]);
    
    let analysis = response?.message || response;
    
    if (typeof analysis !== 'string') {
      console.error('❌ AI returned invalid response type:', typeof analysis);
      throw new Error('AI returned invalid response type');
    }
    
    console.log(`✅ Generated cloning error analysis (${analysis.length} chars)`);
    
    res.json({
      success: true,
      data: {
        analysis,
        sourceResourceGroup,
        targetResourceGroup,
        status
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to analyze cloning error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze cloning error',
      message: error.message
    });
  }
});

/**
 * Analyze execution output and generate user-friendly summary
 */
router.post('/analyze-execution-output', async (req, res) => {
  try {
    const { query, output, status } = req.body;
    
    if (!output) {
      return res.status(400).json({
        success: false,
        error: 'Output is required'
      });
    }
    
    console.log(`🤖 Analyzing execution output for: ${query?.substring(0, 50)}...`);
    
    // Build system prompt for analysis
    const systemPrompt = `You are an expert Azure AI Assistant specialized in analyzing Azure CLI command outputs and presenting them in a beautiful, user-friendly format.

TASK: Analyze the Azure CLI execution output and create a comprehensive, well-formatted summary that's easy to understand.

USER'S ORIGINAL REQUEST: ${query || 'Azure operation'}

EXECUTION STATUS: ${status}

AZURE CLI OUTPUT:
${output}

YOUR RESPONSE SHOULD:
1. Start with a clear summary of what was accomplished
2. Extract and present key information in a structured format
3. Use markdown formatting for better readability:
   - Use headings (##, ###) to organize sections
   - Use bullet points for lists
   - Use **bold** for important information
   - Use tables when listing multiple items with properties
   - Use code blocks for resource IDs or names
4. If listing resources:
   - Show count of items found
   - Create a well-formatted table with key columns
   - Highlight important properties (name, location, status, SKU)
5. Provide insights or observations
6. End with a brief conclusion or next steps if applicable

FORMAT REQUIREMENTS:
- Use emoji strategically for visual appeal (✅ ❌ 📊 🌍 💾 etc.)
- Keep it concise but informative
- Be friendly and conversational
- Focus on the information most useful to the user
- If there are errors in the output, explain them clearly

EXAMPLE OUTPUT FORMAT:

## ✅ Execution Summary
Successfully retrieved [X] resource groups from your Azure subscription.

## 📊 Resource Groups Found

| Name | Location | Status |
|------|----------|--------|
| demo-rg | East US | Succeeded |
| prod-rg | West US | Succeeded |

## 💡 Key Insights
- Most resources are in East US region
- All resource groups are in "Succeeded" state
- Total: X resource groups

Generate your user-friendly analysis now:`;

    const response = await aiAgentService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please analyze this output and provide a user-friendly summary.' }
    ]);
    
    let summary = response?.message || response;
    
    if (typeof summary !== 'string') {
      console.error('❌ AI returned invalid response type:', typeof summary);
      throw new Error('AI returned invalid response type');
    }
    
    console.log(`✅ Generated user-friendly summary (${summary.length} chars)`);
    
    res.json({
      success: true,
      data: {
        summary,
        query,
        status
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to analyze execution output:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze execution output',
      message: error.message
    });
  }
});

module.exports = router;

