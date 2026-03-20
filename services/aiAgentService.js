const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
const axios = require('axios');
const { normalizeLinuxRuntimeForAzCli } = require('./webAppRuntimeUtils');

/**
 * AI Agent Service for Azure Resource Cloning
 * Uses Azure OpenAI GPT-4o for intelligent resource discovery and cloning
 */
class AIAgentService {
  constructor() {
    // Azure OpenAI Configuration
    this.endpoint = process.env.AZURE_OPENAI_AGENT_ENDPOINT || 'https://smartdocs-hive.openai.azure.com/';
    this.apiKey = process.env.AZURE_OPENAI_AGENT_KEY || '';
    this.deploymentName = process.env.AZURE_OPENAI_AGENT_DEPLOYMENT || 'gpt-4o'; // Recommended: gpt-4o or gpt-4.1
    
    // Azure Management Configuration
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    
    this.client = null;
    this.accessToken = null;
    
    this.initializeClient();
  }
  
  /**
   * Initialize Azure OpenAI Client
   */
  initializeClient() {
    try {
      if (this.apiKey && this.endpoint) {
        this.client = new OpenAIClient(
          this.endpoint,
          new AzureKeyCredential(this.apiKey)
        );
        console.log('✅ AI Agent Service initialized with Azure OpenAI');
      } else {
        console.warn('⚠️ Azure OpenAI credentials not configured for AI Agent');
      }
    } catch (error) {
      console.error('❌ Failed to initialize AI Agent Service:', error.message);
    }
  }
  
  /**
   * Get Azure Access Token for ARM API calls
   */
  async getAccessToken() {
    if (this.accessToken) return this.accessToken;
    
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://management.azure.com/.default',
        grant_type: 'client_credentials'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      this.accessToken = response.data.access_token;
      
      // Refresh token before expiry
      setTimeout(() => {
        this.accessToken = null;
      }, (response.data.expires_in - 300) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to get access token:', error.message);
      throw new Error('Authentication failed');
    }
  }
  
  /**
   * Discover all resources in a resource group
   */
  async discoverResourceGroup(resourceGroupName) {
    try {
      const token = await this.getAccessToken();
      
      // Get resource group details
      const rgUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}?api-version=2021-04-01`;
      const rgResponse = await axios.get(rgUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Get all resources in the resource group
      const resourcesUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}/resources?api-version=2021-04-01`;
      const resourcesResponse = await axios.get(resourcesUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const resources = resourcesResponse.data.value;
      
      // Get detailed configuration for each resource
      const detailedResources = await Promise.all(
        resources.map(async (resource) => {
          try {
            const detailUrl = `https://management.azure.com${resource.id}?api-version=2021-04-01`;
            const detailResponse = await axios.get(detailUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            let resourceData = detailResponse.data;
            
            // CRITICAL: For Web Apps, fetch deployment configuration to detect type
            if (resource.type === 'Microsoft.Web/sites') {
              console.log(`🔍 Detecting Web App type for: ${resource.name}`);
              try {
                const webAppConfig = await this.getWebAppConfig(resourceGroupName, resource.name, token);
                resourceData.webAppConfig = webAppConfig;
                console.log(`✅ Web App type detected: ${webAppConfig.deploymentType}`);
                console.log(`   Details: ${JSON.stringify(webAppConfig, null, 2)}`);
              } catch (error) {
                console.warn(`⚠️  Could not fetch web app config for ${resource.name}:`, error.message);
              }
            }
            
            return resourceData;
          } catch (error) {
            console.warn(`⚠️ Could not get details for ${resource.name}:`, error.message);
            return resource;
          }
        })
      );
      
      return {
        resourceGroup: rgResponse.data,
        resources: detailedResources,
        totalResources: resources.length
      };
    } catch (error) {
      console.error('❌ Failed to discover resource group:', error.message);
      throw error;
    }
  }
  
  /**
   * Get Web App configuration to detect deployment type
   * CRITICAL: Determines if web app is runtime-based, single-container, multi-container, or zip-deployed
   * ENHANCED: Now detects static/zip deployments on Windows IIS
   */
  async getWebAppConfig(resourceGroupName, webAppName, token) {
    try {
      // Fetch site config (contains linuxFxVersion, windowsFxVersion, etc.)
      const configUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${webAppName}/config/web?api-version=2022-03-01`;
      const configResponse = await axios.get(configUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const config = configResponse.data.properties;
      
      // ENHANCED: Fetch deployment source configuration to detect zip deployments
      let deploymentSource = null;
      let isZipDeployed = false;
      let hasWebConfig = false;
      
      try {
        const deploymentUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${webAppName}/sourcecontrols/web?api-version=2022-03-01`;
        const deploymentResponse = await axios.get(deploymentUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        deploymentSource = deploymentResponse.data.properties;
        
        // Check if deployed via zip (no source control)
        if (!deploymentSource.repoUrl || deploymentSource.repoUrl === null) {
          isZipDeployed = true;
        }
      } catch (error) {
        // No source control configured = likely zip deployment or manual deployment
        if (error.response?.status === 404) {
          isZipDeployed = true;
          console.log(`   📦 No source control found for ${webAppName} - likely ZIP deployment`);
        }
      }
      
      // Check if web.config exists (indicates Windows IIS static site)
      try {
        const vfsUrl = `https://${webAppName}.scm.azurewebsites.net/api/vfs/site/wwwroot/web.config`;
        const vfsResponse = await axios.head(vfsUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (vfsResponse.status === 200) {
          hasWebConfig = true;
          console.log(`   ⚙️ web.config detected - Windows IIS static site`);
        }
      } catch (error) {
        // web.config doesn't exist or not accessible
        console.log(`   ℹ️ No web.config detected`);
      }
      
      // Determine deployment type based on configuration
      let deploymentType = 'unknown';
      let deploymentDetails = {};
      
      // Check for Linux runtime
      if (config.linuxFxVersion) {
        const fxVersion = config.linuxFxVersion;
        
        if (fxVersion.startsWith('DOCKER|')) {
          // Single container
          deploymentType = 'single-container';
          deploymentDetails = {
            containerImage: fxVersion.replace('DOCKER|', ''),
            type: 'docker'
          };
        } else if (fxVersion.startsWith('COMPOSE|') || config.appCommandLine?.includes('docker-compose')) {
          // Multi-container (docker-compose)
          deploymentType = 'multi-container-compose';
          deploymentDetails = {
            type: 'compose',
            composeFile: config.appCommandLine
          };
        } else if (fxVersion.includes('|') || fxVersion.includes(':')) {
          // Runtime-based; CLI expects STACK:version from list-runtimes (not lowercase pipe)
          deploymentType = 'runtime';
          const runtimeForCli = normalizeLinuxRuntimeForAzCli(fxVersion);
          const verPart = runtimeForCli.includes(':')
            ? runtimeForCli.split(':').slice(1).join(':')
            : '';
          deploymentDetails = {
            runtime: runtimeForCli,
            platform: 'linux',
            version: verPart
          };
        }
      }
      
      // Check for Windows runtime
      if (config.windowsFxVersion) {
        deploymentType = 'runtime';
        deploymentDetails = {
          runtime: config.windowsFxVersion,
          platform: 'windows'
        };
      }
      
      // ENHANCED: Check for ZIP-deployed static site (highest priority for Windows apps)
      if (isZipDeployed && hasWebConfig) {
        deploymentType = 'zip-static';
        deploymentDetails = {
          type: 'zip',
          platform: 'windows',
          hasWebConfig: true,
          deploymentMethod: 'config-zip',
          note: 'Static site deployed via ZIP with IIS configuration (web.config)'
        };
        console.log(`   ✅ Detected ZIP-deployed static site on Windows IIS`);
      } else if (isZipDeployed && !config.linuxFxVersion && !config.windowsFxVersion) {
        // ZIP deployed without specific runtime = static content
        deploymentType = 'zip-static';
        deploymentDetails = {
          type: 'zip',
          platform: config.reserved ? 'linux' : 'windows', // reserved = true means Linux
          hasWebConfig: hasWebConfig,
          deploymentMethod: 'config-zip',
          note: 'Static site deployed via ZIP'
        };
        console.log(`   ✅ Detected ZIP-deployed static site`);
      }
      
      // If still unknown, check for container settings
      if (deploymentType === 'unknown') {
        if (config.windowsContainerSettings || config.linuxContainerSettings) {
          deploymentType = 'single-container';
          deploymentDetails = {
            type: 'container',
            settings: config.windowsContainerSettings || config.linuxContainerSettings
          };
        } else {
          // Default to runtime if nothing else is detected
          deploymentType = 'runtime';
          deploymentDetails = {
            runtime: 'none',
            note: 'No specific runtime detected - will create basic web app shell'
          };
        }
      }
      
      return {
        deploymentType,
        deploymentDetails,
        linuxFxVersion: config.linuxFxVersion,
        windowsFxVersion: config.windowsFxVersion,
        appSettings: config.appSettings || [],
        connectionStrings: config.connectionStrings || [],
        alwaysOn: config.alwaysOn,
        http20Enabled: config.http20Enabled,
        ftpsState: config.ftpsState,
        minTlsVersion: config.minTlsVersion,
        // CRITICAL: Platform detection for App Service Plan creation
        isLinux: config.reserved || false,  // reserved = true means Linux
        platform: deploymentDetails.platform || (config.reserved ? 'linux' : 'windows'),
        // Exclude unsupported attributes
        // vnetRouteAllEnabled is NOT included - it's unsupported by CLI
      };
    } catch (error) {
      console.error(`❌ Failed to fetch web app config for ${webAppName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Analyze resources using AI and generate cloning strategy (with optional validated config)
   */
  async analyzeAndGenerateStrategy(resourceGroupData, targetResourceGroupName, validatedConfig = null) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }
    
    try {
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.getUserPrompt(resourceGroupData, targetResourceGroupName);
      
      console.log('🤖 Analyzing resources with AI...');
      
      const response = await this.client.getChatCompletions(
        this.deploymentName,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.3, // Lower temperature for more deterministic code generation
          maxTokens: 4000,
          topP: 0.95,
          frequencyPenalty: 0,
          presencePenalty: 0
        }
      );
      
      const aiResponse = response.choices[0].message.content;
      
      // Parse AI response (expects JSON format)
      try {
        const strategy = JSON.parse(aiResponse);
        return strategy;
      } catch (parseError) {
        // If not JSON, return as text
        return {
          analysis: aiResponse,
          format: 'text'
        };
      }
    } catch (error) {
      console.error('❌ AI analysis failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate Terraform configuration for cloning (with optional validated config)
   */
  async generateTerraformConfig(resourceGroupData, targetResourceGroupName, validatedConfig = null) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }
    
    try {
      const systemPrompt = `You are an expert Azure and Terraform specialist. Your task is to generate accurate, production-ready Terraform configuration files to clone Azure resources.

CRITICAL REQUIREMENTS:
1. Generate valid Terraform HCL syntax
2. Use azurerm provider
3. Include all resource properties and configurations
4. Handle dependencies correctly
5. Use variables for resource group name and location
6. Include resource naming conventions
7. Add comments for clarity
8. Ensure idempotency

OUTPUT FORMAT: Provide only valid Terraform code, no markdown formatting.`;

      const userPrompt = `Generate Terraform configuration to clone the following Azure resource group and all its resources:

SOURCE RESOURCE GROUP: ${resourceGroupData.resourceGroup.name}
TARGET RESOURCE GROUP: ${targetResourceGroupName}
LOCATION: ${resourceGroupData.resourceGroup.location}

RESOURCES TO CLONE:
${JSON.stringify(resourceGroupData.resources, null, 2)}

🚨 CRITICAL TERRAFORM REQUIREMENTS 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate complete Terraform configuration that:
1. Creates the target resource group
2. Creates ALL resources from the source group with the same configuration
3. Properly handles resource dependencies (use depends_on if needed)
4. Includes all necessary properties and settings
5. Uses appropriate azurerm resource blocks for each resource type
6. Includes provider configuration
7. Uses variables for resource group name and location
8. Adds outputs for created resources

IMPORTANT: The Terraform configuration MUST actually CREATE all resources.
DO NOT use data sources only. Use resource blocks to create new resources.

Example structure:
resource "azurerm_resource_group" "target" {
  name     = var.target_resource_group_name
  location = var.location
}

resource "azurerm_storage_account" "cloned" {
  name                = "<name>"
  resource_group_name = azurerm_resource_group.target.name
  location            = azurerm_resource_group.target.location
  # ... all other properties
}

Ensure all resource dependencies are properly handled.`;

      const response = await this.client.getChatCompletions(
        this.deploymentName,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.2,
          maxTokens: 8000,
          topP: 0.9
        }
      );
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('❌ Terraform generation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate Azure CLI scripts for cloning (with optional validated config)
   */
  async generateAzureCLIScripts(resourceGroupData, targetResourceGroupName, validatedConfig = null) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }
    
    try {
      const systemPrompt = `You are an expert Azure CLI specialist. Generate accurate, production-ready Azure CLI scripts to clone Azure resources.

CRITICAL OUTPUT FORMAT REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT include ANY explanatory text, prose, or markdown
DO NOT start with "Below is the script..." or similar
DO NOT end with "### Explanation:" or "### Notes:" or ANY explanation
DO NOT use markdown code fences (\`\`\`bash or \`\`\`)
DO NOT add any text before, after, or outside the script
DO NOT use emojis or special unicode characters (✅ ❌ 🚨 ✓ ✗ etc.)
DO NOT use box-drawing characters or unicode symbols
ONLY output the raw bash script itself
START immediately with: #!/bin/bash
END immediately after the last command (e.g., echo "...completed.")
USE shell comments (# ...) for any explanations INSIDE the script ONLY
USE ONLY ASCII characters (A-Z, a-z, 0-9, and standard punctuation)

SCRIPT REQUIREMENTS:
1. Use Azure CLI commands only
2. Include error handling with graceful degradation
3. Check for existing resources
4. Handle dependencies and deployment order
5. Add comments (# ...) for clarity inside the script
6. Use proper quoting and escaping
7. Include validation steps
8. Make scripts idempotent
9. For complex resources (web apps with containers, databases with data), create basic shell and add NOTE for manual configuration
10. NEVER fail entire script if one resource fails - continue with others and report issues at end

CRITICAL BASH SAFETY REQUIREMENTS (MUST FOLLOW):
11. ALWAYS initialize variables with default values before use
12. ALWAYS check if variable is empty before integer comparisons
13. Use double brackets [[ ]] for string comparisons, not single [ ]
14. For integer comparisons, ALWAYS check variable is not empty first:
    WRONG: if [ $QUOTA -gt 0 ]; then
    RIGHT: if [[ -n "$QUOTA" ]] && [[ "$QUOTA" -gt 0 ]]; then
15. When parsing JSON with jq or --query, ALWAYS provide default value:
    QUOTA=$(az vm list-usage ... -o tsv || echo "0")
    # Always provide fallback value with || echo
16. Skip special Azure regions (EUAP, canary, preview zones):
    - Exclude: eastus2euap, westus2euap, centraluseuap, etc.
    - Only use: production regions from standard list

EXAMPLE CORRECT QUOTA CHECK:
# Get quota with default value
CURRENT_QUOTA=$(az vm list-usage --location centralindia --query "[?name.value=='virtualMachines'].currentValue" -o tsv 2>/dev/null || echo "0")
QUOTA_LIMIT=$(az vm list-usage --location centralindia --query "[?name.value=='virtualMachines'].limit" -o tsv 2>/dev/null || echo "0")

# Safe integer comparison with empty check
if [[ -n "$CURRENT_QUOTA" ]] && [[ -n "$QUOTA_LIMIT" ]] && [[ "$CURRENT_QUOTA" -lt "$QUOTA_LIMIT" ]]; then
  echo "Sufficient quota available"
else
  echo "Insufficient quota or unable to check"
fi

EXAMPLE REGION ITERATION (Skip EUAP zones):
PRODUCTION_REGIONS="westus eastus westus2 eastus2 centralus northcentralus southcentralus westcentralus canadacentral canadaeast brazilsouth northeurope westeurope uksouth ukwest francecentral germanywestcentral norwayeast switzerlandnorth swedencentral polandcentral austriaeast spaincentral italynorth belgiumcentral israelcentral qatarcentral uaenorth southafricanorth australiaeast australiasoutheast australiacentral newzealandnorth centralindia southindia westindia jioindiawest eastasia southeastasia japaneast japanwest koreacentral koreasouth indonesiacentral malaysiawest chilecentral mexicocentral"

for REGION in $PRODUCTION_REGIONS; do
  echo "Checking region: $REGION"
  # Your logic here
done

OUTPUT EXAMPLE (CORRECT):
#!/bin/bash

# Variables
SOURCE_RG="demoai"
TARGET_RG="target"
...
echo "All resources cloned successfully."

OUTPUT EXAMPLE (WRONG - Prose before):
Below is the bash script that clones resources...
\`\`\`bash
#!/bin/bash
...
\`\`\`

OUTPUT EXAMPLE (WRONG - Explanation after):
#!/bin/bash
...
echo "All resources cloned successfully."

### Explanation:
1. **Error Handling**: The script checks...
2. **Idempotency**: The script checks...

⚠️ STOP OUTPUT IMMEDIATELY after the last bash command!`;

      // Build user prompt with validated config if available
      let userPrompt = `Generate Azure CLI script to clone the following Azure resource group and all its resources:

SOURCE RESOURCE GROUP: ${resourceGroupData.resourceGroup.name}
TARGET RESOURCE GROUP: ${targetResourceGroupName}
LOCATION: ${resourceGroupData.resourceGroup.location}

RESOURCES TO CLONE:
${JSON.stringify(resourceGroupData.resources, null, 2)}

🚨🚨🚨 CRITICAL WEB APP INSTRUCTIONS 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR EVERY WEB APP IN THE RESOURCES ABOVE:

1. 🚨 MANDATORY: Extract SOURCE web app name AND App Service Plan name in the Variables section at the TOP of your script!
   
   You MUST add this code in your Variables section (right after SOURCE_RG, TARGET_RG, LOCATION):
   
   # 🚨 CRITICAL: Extract SOURCE web app name from RESOURCES TO CLONE JSON above
   # Look at the RESOURCES TO CLONE JSON provided in the prompt
   # Find the resource where type = "Microsoft.Web/sites"
   # Extract the "name" field value from that resource
   # 
   # Example: If the JSON shows:
   #   {
   #     "name": "hello-world-static-1763324087",
   #     "type": "Microsoft.Web/sites",
   #     ...
   #   }
   # Then set: SOURCE_WEBAPP_NAME="hello-world-static-1763324087"
   #
   # 🚨 YOU MUST REPLACE THE EXAMPLE NAME WITH THE ACTUAL NAME FROM THE JSON!
   SOURCE_WEBAPP_NAME="<EXTRACT-FROM-RESOURCES-JSON>"  # Replace with actual name from RESOURCES TO CLONE JSON!
   
   # 🚨 CRITICAL: Extract App Service Plan name from RESOURCES TO CLONE JSON above
   # Find the resource where type = "Microsoft.Web/serverfarms" (App Service Plan)
   # Extract the "name" field value from that resource
   # 
   # Example: If the JSON shows:
   #   {
   #     "name": "ASP-MicroUserServices-9b44",
   #     "type": "Microsoft.Web/serverfarms",
   #     ...
   #   }
   # Then set: PLAN_NAME="ASP-MicroUserServices-9b44"
   #
   # 🚨 YOU MUST REPLACE THE EXAMPLE NAME WITH THE ACTUAL NAME FROM THE JSON!
   # ⚠️ IMPORTANT: If you CREATE a NEW plan during cloning, use the NEW plan's name instead!
   PLAN_NAME="<EXTRACT-FROM-RESOURCES-JSON>"  # Replace with actual plan name from RESOURCES TO CLONE JSON!
   
   # Generate TARGET web app name (only if web app exists)
   if [ -n "$SOURCE_WEBAPP_NAME" ] && [ "$SOURCE_WEBAPP_NAME" != "<EXTRACT-FROM-RESOURCES-JSON>" ]; then
     TARGET_WEBAPP_NAME="\${SOURCE_WEBAPP_NAME}-$RANDOM"
   fi
   
   🚨 CRITICAL: SOURCE_WEBAPP_NAME and PLAN_NAME MUST be defined BEFORE any web app operations!
   🚨 CRITICAL: If you use $SOURCE_WEBAPP_NAME or $PLAN_NAME anywhere in your script, they MUST be defined first!
   🚨 CRITICAL: DO NOT use placeholder values - use the ACTUAL names from the RESOURCES TO CLONE JSON!
   
   # 🚨 CRITICAL: Extract SQL Server name from RESOURCES TO CLONE JSON above
   # Find the resource where type = "Microsoft.Sql/servers"
   # Extract the "name" field value from that resource
   # 
   # Example: If the JSON shows:
   #   {
   #     "name": "sqlserver-1236",
   #     "type": "Microsoft.Sql/servers",
   #     ...
   #   }
   # Then set: SOURCE_SQL_SERVER="sqlserver-1236"
   #
   # 🚨 YOU MUST REPLACE THE EXAMPLE NAME WITH THE ACTUAL NAME FROM THE JSON!
   # ⚠️ IMPORTANT: NEVER include .database.windows.net suffix - use ONLY the server name!
   SOURCE_SQL_SERVER="<EXTRACT-FROM-RESOURCES-JSON>"  # Replace with actual SQL server name from RESOURCES TO CLONE JSON!
   TARGET_SQL_SERVER="sqlserver-$RANDOM"  # Generate unique cloned server name
   
   # 🚨 CRITICAL: Extract SQL Database name from RESOURCES TO CLONE JSON above
   # Find the resource where type = "Microsoft.Sql/servers/.../databases" or contains "databases"
   # Extract the database name part (after the slash) from the "name" field
   # 
   # Example: If the JSON shows:
   #   {
   #     "name": "sqlserver-1236/sqldb-6179",
   #     "type": "Microsoft.Sql/servers/.../databases",
   #     ...
   #   }
   # Then extract: SOURCE_DB_NAME="sqldb-6179" (the part after the slash)
   #
   # 🚨 YOU MUST REPLACE THE EXAMPLE NAME WITH THE ACTUAL NAME FROM THE JSON!
   # ⚠️ IMPORTANT: Generate a UNIQUE cloned name: TARGET_DB_NAME="\${SOURCE_DB_NAME}-clone-$RANDOM"
   SOURCE_DB_NAME="<EXTRACT-FROM-RESOURCES-JSON>"  # Replace with actual database name from RESOURCES TO CLONE JSON!
   TARGET_DB_NAME="\${SOURCE_DB_NAME}-clone-$RANDOM"  # Generate unique cloned name
   
   🚨 CRITICAL: SOURCE_SQL_SERVER MUST be defined BEFORE any SQL database operations!
   🚨 CRITICAL: SOURCE_DB_NAME MUST be defined BEFORE any SQL database operations!
   🚨 CRITICAL: When using az sql db copy, use --server "$SOURCE_SQL_SERVER" (NOT TARGET_SQL_SERVER)!
   🚨 CRITICAL: TARGET_DB_NAME MUST be unique (use -clone-$RANDOM suffix)!
   
2. VERIFY the SOURCE web app name is extracted correctly:
   - Check the RESOURCES TO CLONE JSON above
   - Find resource with type: "Microsoft.Web/sites"
   - Use its "name" value as SOURCE_WEBAPP_NAME
   
3. FIND the web app resource in the JSON above
4. CHECK if it has a "webAppConfig" object
5. IF webAppConfig exists:
   a. READ webAppConfig.deploymentType  (e.g., "zip-static", "runtime", "single-container")
   b. READ webAppConfig.platform  (e.g., "windows" or "linux")
   c. READ webAppConfig.isLinux  (true or false)
   
6. USE THIS DATA to determine:
   
   🚨 CRITICAL: For content download, ALWAYS use SOURCE_WEBAPP_NAME and SOURCE_RG!
   - Download content FROM: SOURCE_WEBAPP_NAME in SOURCE_RG
   - Deploy content TO: TARGET_WEBAPP_NAME in TARGET_RG
   
7. USE THIS DATA to determine:
   
   📋 FOR APP SERVICE PLAN CREATION:
   ────────────────────────────────────────────────────────────────────
   IF webAppConfig.platform = 'windows' OR webAppConfig.isLinux = false:
      az appservice plan create --sku F1
      # NO --is-linux flag!
   
   IF webAppConfig.platform = 'linux' OR webAppConfig.isLinux = true:
      az appservice plan create --sku F1 --is-linux
      # WITH --is-linux flag!
   
   📋 FOR WEB APP CREATION AND CONTENT DEPLOYMENT:
   ────────────────────────────────────────────────────────────────────
   
   🚨 CRITICAL: Extract App Service Plan Name FIRST! 🚨
   Before creating any web app, you MUST extract the App Service Plan name:
   
   1. Look at the RESOURCES TO CLONE JSON above
   2. Find the resource where type = "Microsoft.Web/serverfarms" (App Service Plan)
   3. Extract the "name" field value from that resource
   4. Set it as a variable: PLAN_NAME="<extracted-plan-name>"
   
   Example: If JSON shows:
     {
       "name": "ASP-MicroUserServices-9b44",
       "type": "Microsoft.Web/serverfarms",
       ...
     }
   Then set: PLAN_NAME="ASP-MicroUserServices-9b44"
   
   ⚠️ IMPORTANT: If you create a NEW plan during cloning, use the NEW plan's name!
   
   IF webAppConfig.deploymentType = 'zip-static':
      # 🚨🚨🚨 MANDATORY: This is a static site - you MUST include ALL 7 steps below! 🚨🚨🚨
      # Creating the web app shell is ONLY Step 1 - you MUST deploy content!
      # WITHOUT Steps 2-7, the web app will be EMPTY and the page won't display!
      
      # 🚨🚨🚨 CRITICAL: ZIP-STATIC APPS DO NOT USE --runtime PARAMETER! 🚨🚨🚨
      # 
      # ❌ FORBIDDEN PARAMETERS (WILL CAUSE "Please specify both --multicontainer..." ERROR):
      #   --runtime
      #   --deployment-container-image-name
      #   --multicontainer-config-type
      #   --multicontainer-config-file
      #   --sitecontainers_app
      #   ANY runtime, container, or multicontainer parameters!
      # 
      # ✅ ONLY ALLOWED PARAMETERS (EXACTLY 3 - NO MORE, NO LESS!):
      #   --name
      #   --resource-group
      #   --plan
      # 
      # 🚨 IF YOU ADD ANY OTHER PARAMETER, THE COMMAND WILL FAIL WITH ERROR! 🚨
      # 🚨 The error will say: "Please specify both --multicontainer-config-type..." 🚨
      
      # STEP 1: Create empty web app shell (use TARGET name and PLAN_NAME variable)
      echo "Step 1: Creating web app shell (zip-static - NO runtime parameter)..."
      az webapp create \
        --name "$TARGET_WEBAPP_NAME" \
        --resource-group "$TARGET_RG" \
        --plan "$PLAN_NAME"
      # ⚠️ NOTE: NO --runtime parameter! Zip-static apps don't need runtime!
      
      # Verify web app was created successfully
      if ! az webapp show --name "$TARGET_WEBAPP_NAME" --resource-group "$TARGET_RG" >/dev/null 2>&1; then
        echo "ERROR: Failed to create web app shell"
        echo "  Verify the command used ONLY --name, --resource-group, and --plan"
        echo "  Check that NO --runtime parameter was used"
        exit 1
      fi
      echo "✅ Web app shell created successfully"
      
      # 🚨🚨🚨 STEP 2-7: CONTENT DEPLOYMENT (MANDATORY - DO NOT SKIP!) 🚨🚨🚨
      # 
      # ⚠️⚠️⚠️ CRITICAL WARNING: If you create a web app for zip-static deployment,
      # you MUST include ALL of the following steps IMMEDIATELY after web app creation!
      # DO NOT end the script after Step 1! DO NOT skip to other resources!
      # 
      # You MUST copy and paste ALL 7 steps from CASE D in the instructions below:
      # 
      # STEP D2: Enable Basic Auth for SCM
      # STEP D3: Get deployment credentials from SOURCE web app
      # STEP D4: Download content from SOURCE web app via Kudu API
      # STEP D5: Extract and re-package content
      # STEP D6: Deploy ZIP to TARGET web app
      # STEP D7: Restart TARGET web app
      # 
      # 🚨 CRITICAL: Use SOURCE_WEBAPP_NAME for downloading content!
      # - Download FROM: SOURCE_WEBAPP_NAME in SOURCE_RG
      # - Deploy TO: TARGET_WEBAPP_NAME in TARGET_RG
      # 
      # WITHOUT Steps D2-D7, the web app will be EMPTY and the web page will NOT display!
      # The user will see a blank/default page, NOT the original content!
      # 
      # ⚠️ DO NOT generate a script that only creates the web app shell!
      # ⚠️ You MUST include the complete content deployment process!
   
   IF webAppConfig.deploymentType = 'runtime':
      # Use --runtime parameter
      RUNTIME="\${webAppConfig.deploymentDetails.runtime}"
      az webapp create --runtime "$RUNTIME"
   
   IF webAppConfig.deploymentType = 'single-container':
      # Use --deployment-container-image-name parameter
      IMAGE="\${webAppConfig.deploymentDetails.containerImage}"
      az webapp create --deployment-container-image-name "$IMAGE"
   
   IF webAppConfig.deploymentType = 'multi-container-compose':
      # Follow CASE C from instructions below

5. NEVER GUESS THE TYPE - ALWAYS USE webAppConfig DATA!

6. 🚨 FOR ZIP-STATIC APPS: Creating the web app is only 10% done!
   You MUST include the 7-step content deployment process or the clone will be empty!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      // If validated config is provided, add it to the prompt
      if (validatedConfig) {
        console.log('🔍 RECEIVED validatedConfig:', JSON.stringify(validatedConfig, null, 2));
        console.log('🔍 validatedConfig keys:', Object.keys(validatedConfig));
        
        // Try to extract validated resources from different possible structures
        let validatedResources = [];
        let resourceMappings = {};
        
        // Structure 1: Direct validatedResources array
        if (validatedConfig.validatedResources && Array.isArray(validatedConfig.validatedResources)) {
          validatedResources = validatedConfig.validatedResources;
          console.log('✅ Found validatedResources directly');
        }
        // Structure 2: Nested in validatedConfig.validatedConfig
        else if (validatedConfig.validatedConfig?.validatedResources) {
          validatedResources = validatedConfig.validatedConfig.validatedResources;
          console.log('✅ Found validatedResources in nested validatedConfig');
        }
        // Structure 3: Resources array (fallback)
        else if (validatedConfig.resources && Array.isArray(validatedConfig.resources)) {
          validatedResources = validatedConfig.resources;
          console.log('✅ Found resources array');
        }
        
        // Extract resource mappings
        if (validatedConfig.validatedConfig?.resourceMappings) {
          resourceMappings = validatedConfig.validatedConfig.resourceMappings;
          console.log('✅ Found resourceMappings in nested validatedConfig');
        } else if (validatedConfig.resourceMappings) {
          resourceMappings = validatedConfig.resourceMappings;
          console.log('✅ Found resourceMappings directly');
        }
        
        console.log('📊 Extracted validatedResources count:', validatedResources.length);
        console.log('📊 Extracted resourceMappings:', JSON.stringify(resourceMappings, null, 2));
        
        if (validatedResources.length > 0) {
          userPrompt += `

✅ VALIDATED CONFIGURATION PROVIDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: Use the EXACT validated resource names and configurations provided below.
DO NOT generate new names. DO NOT use $RANDOM. Use these EXACT values.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATED RESOURCES:
${JSON.stringify(validatedResources, null, 2)}

RESOURCE NAME MAPPINGS (USE THESE EXACT NAMES):
${JSON.stringify(resourceMappings, null, 2)}

INSTRUCTIONS:
1. Use EXACT names from the validated configuration above
2. For each resource, use the "newName" field from validatedResources
3. Use corrected configurations (runtime, SKU, location) from validated config
4. DO NOT append random suffixes - names are already unique
5. Follow all corrections specified in each resource's config
6. In your script, assign these EXACT names to variables:

${validatedResources.map(r => {
  const varName = r.originalName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `   ${varName}="${r.newName}"  # Type: ${r.type}`;
}).join('\n')}

CRITICAL: Use these EXACT variable values above. DO NOT use $RANDOM or generate new names!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
        
        // 🚨 CRITICAL: Add quota-aware region selection
        if (validatedConfig.azureValidationStatus) {
          const azureStatus = validatedConfig.azureValidationStatus;
          console.log('🎯 QUOTA CHECK RESULTS:', JSON.stringify(azureStatus, null, 2));
          
          userPrompt += `

🎯 CRITICAL: QUOTA-VALIDATED REGION SELECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUOTA AVAILABILITY STATUS:
${JSON.stringify(azureStatus, null, 2)}

🚨 MANDATORY REGION SELECTION RULES (MUST FOLLOW!):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. IF quotaAvailable is FALSE:
   ✅ YOU MUST USE THE RECOMMENDED REGION: "${azureStatus.recommendedRegion || 'centralindia'}"
   ❌ DO NOT use the source region location
   ❌ DO NOT use any region from exhaustedRegions list
   
2. IF alternativeRegions array is provided:
   ✅ Use the FIRST region in alternativeRegions array (highest quota)
   ✅ Extract region name from: alternativeRegions[0].region
   
3. SET THIS AS THE LOCATION VARIABLE IN YOUR SCRIPT:
   ${!azureStatus.quotaAvailable && azureStatus.alternativeRegions && azureStatus.alternativeRegions.length > 0
     ? `LOCATION="${azureStatus.alternativeRegions[0].region}"  # QUOTA-VALIDATED REGION WITH ${azureStatus.alternativeRegions[0].available} AVAILABLE`
     : azureStatus.recommendedRegion
       ? `LOCATION="${azureStatus.recommendedRegion.split(' ')[0]}"  # QUOTA-VALIDATED RECOMMENDED REGION`
       : `LOCATION="${resourceGroupData.resourceGroup.location}"  # Source region (quota available)`
   }

4. EXAMPLE CORRECT SCRIPT BEGINNING:
   #!/bin/bash
   
   # Variables
   SOURCE_RG="${resourceGroupData.resourceGroup.name}"
   TARGET_RG="${targetResourceGroupName}"
   ${!azureStatus.quotaAvailable && azureStatus.alternativeRegions && azureStatus.alternativeRegions.length > 0
     ? `LOCATION="${azureStatus.alternativeRegions[0].region}"  # Quota-validated region (${azureStatus.alternativeRegions[0].available} available, ${azureStatus.alternativeRegions[0].percentUsed}% used)`
     : azureStatus.recommendedRegion
       ? `LOCATION="${azureStatus.recommendedRegion.split(' ')[0]}"  # Recommended region with available quota`
       : `LOCATION="${resourceGroupData.resourceGroup.location}"  # Source region`
   }
   
   # 🚨 CRITICAL: Extract SOURCE web app name from resources JSON
   # Look at the RESOURCES TO CLONE JSON in the prompt above
   # Find the resource with type "Microsoft.Web/sites" and extract its "name" field
   # Example: If JSON shows {"name": "hello-world-static-1763324087", "type": "Microsoft.Web/sites", ...}
   # Then set: SOURCE_WEBAPP_NAME="hello-world-static-1763324087"
   # 
   # You MUST manually extract this from the RESOURCES TO CLONE JSON provided above!
   # DO NOT use template variables - use the actual name from the JSON!
   SOURCE_WEBAPP_NAME="hello-world-static-1763324087"  # REPLACE with actual name from RESOURCES TO CLONE JSON
   
   # Generate unique TARGET web app name (only if source web app exists)
   if [ -n "$SOURCE_WEBAPP_NAME" ]; then
     TARGET_WEBAPP_NAME="\${SOURCE_WEBAPP_NAME}-$RANDOM"
     echo "Source web app: $SOURCE_WEBAPP_NAME"
     echo "Target web app: $TARGET_WEBAPP_NAME"
   fi
   
   echo "Creating resources in region: $LOCATION"
   echo "Reason: ${!azureStatus.quotaAvailable 
     ? 'Source region has no available quota - using validated alternative'
     : 'Quota available in this region'}"
   
   # Create target resource group in VALIDATED REGION
   az group create --name "$TARGET_RG" --location "$LOCATION"

🚨 ABSOLUTELY CRITICAL:
- You MUST use the LOCATION variable shown above
- DO NOT use "${resourceGroupData.resourceGroup.location}" if quotaAvailable is false
- If App Service Plan creation fails due to location (e.g., "Unsupported location"), try fallback locations
- DO NOT exit the script if web app creation fails - continue with other resources (SQL Server, Database, etc.)
- Always check if App Service Plan was created successfully before attempting web app creation
- DO NOT use any region that is not in the alternativeRegions list
- This prevents "Operation cannot be completed without additional quota" errors

REASONING:
${!azureStatus.quotaAvailable 
  ? `⚠️ Source region has EXHAUSTED QUOTA (${azureStatus.quotaDetails || 'no quota available'})
     ✅ Recommended region has ${azureStatus.alternativeRegions?.[0]?.available || 'available'} quota
     ✅ Using validated region prevents execution errors`
  : `✅ Source region has available quota
     ✅ Safe to use source region for cloning`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
      }
      
      userPrompt += `

CRITICAL CLONING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. 🚨 PREREQUISITE: Azure CLI Authentication 🚨
   At the START of your script, verify Azure CLI is authenticated:
   
   # Verify Azure CLI authentication
   echo "Verifying Azure CLI authentication..."
   if ! az account show >/dev/null 2>&1; then
     echo "ERROR: Azure CLI is not authenticated"
     echo "Please run: az login --service-principal --username \$AZURE_CLIENT_ID --password \$AZURE_CLIENT_SECRET --tenant \$AZURE_TENANT_ID"
     exit 1
   fi
   echo "✅ Azure CLI authenticated successfully"
   CURRENT_SUB=\$(az account show --query id -o tsv)
   echo "  Current subscription: \$CURRENT_SUB"

1. CREATE target resource group (if it doesn't exist)
2. For EACH resource in the source group:
   a. Generate NEW UNIQUE NAME by appending "-clone" suffix to the resource name
   b. Check if the NEW resource exists in TARGET resource group
   c. If it DOES NOT exist, CREATE it with the same configuration
   d. If it DOES exist, skip with a message
3. ACTUALLY CREATE resources - DO NOT just check and say "already exists" if they don't
4. Use proper Azure CLI create commands with VALID, MINIMAL, UNIVERSALLY SUPPORTED SYNTAX:
   
   CRITICAL: Use ONLY basic parameters that are universally supported
   DO NOT use deprecated, advanced, or optional parameters
   DO NOT use: --large-file-shares, --enable-files-aadds, --enable-hierarchical-namespace
   DO NOT specify runtime versions unless they are current (2024-2025)
   
   STORAGE ACCOUNTS (MINIMAL SYNTAX):
   az storage account create \
     --name <name> \
     --resource-group <rg> \
     --location <loc> \
     --sku <sku> \
     --kind StorageV2
   
   APP SERVICE PLANS (DETAILED CLONING):
   
   🚨 CRITICAL: Windows vs Linux Plan Detection 🚨
   
   CHECK: Look at the original web app's "reserved" property or platform info
   
   🚨 CRITICAL: Use LOCATION variable (NOT hardcoded location!) 🚨
   The LOCATION variable is set at the top of your script - ALWAYS use it!
   
   FOR WINDOWS PLANS (reserved = false OR platform = 'windows'):
   az appservice plan create \
     --name <name> \
     --resource-group <rg> \
     --location "$LOCATION" \
     --sku <sku>
   
   FOR LINUX PLANS (reserved = true OR platform = 'linux'):
   az appservice plan create \
     --name <name> \
     --resource-group <rg> \
     --location "$LOCATION" \
     --sku <sku> \
     --is-linux
   
   ⚠️ IF location error occurs (e.g., "Unsupported location"):
   - Try fallback locations: eastus, westus, westus2, centralus
   - Use the same SKU but different location
   - Continue with other resources if App Service Plan creation fails
   - DO NOT exit the script - let other resources (SQL, etc.) be cloned
   
   ⚠️ DO NOT add --is-linux for Windows plans (will fail web app creation)!
   ⚠️ ALWAYS add --is-linux for Linux plans (required)!
   
   ⚠️⚠️⚠️ CRITICAL: APP SERVICE PLAN SKU VALUES ⚠️⚠️⚠️
   
   ONLY USE THESE EXACT SKU VALUES (NO OTHERS!):
   ✅ FREE TIER: F1, FREE
   ✅ SHARED TIER: D1, SHARED
   ✅ BASIC TIER: B1, B2, B3
   ✅ STANDARD TIER: S1, S2, S3
   ✅ PREMIUM V2: P1V2, P2V2, P3V2
   ✅ PREMIUM V3: P0V3, P1V3, P2V3, P3V3, P1MV3, P2MV3, P3MV3, P4MV3, P5MV3
   ✅ PREMIUM V4: P0V4, P1V4, P2V4, P3V4, P1MV4, P2MV4, P3MV4, P4MV4, P5MV4
   ✅ ISOLATED V2: I1V2, I2V2, I3V2, I4V2, I5V2, I6V2, I1MV2, I2MV2, I3MV2, I4MV2, I5MV2
   ✅ WORKFLOW STANDARD: WS1, WS2, WS3
   
   ❌ NEVER USE (INVALID - WILL FAIL!):
   - LinuxFree (INVALID!)
   - WindowsFree (INVALID!)
   - Free (use F1 or FREE instead)
   - Basic (use B1, B2, or B3 instead)
   - Standard (use S1, S2, or S3 instead)
   - Any other made-up name!
   
   RECOMMENDED FOR CLONING (Cost-effective):
   1st choice: F1 (Free tier - costs $0/month)
   2nd choice: B1 (Basic tier - low cost)
   3rd choice: P1V2 (Premium - higher cost)
   
   EXAMPLE (CORRECT):
   az appservice plan create \
     --name "my-plan" \
     --resource-group "my-rg" \
     --location "westus" \
     --sku F1 \
     --is-linux
   
   EXAMPLE (WRONG - WILL FAIL):
   az appservice plan create \
     --name "my-plan" \
     --resource-group "my-rg" \
     --location "westus" \
     --sku LinuxFree \  ← INVALID! Use F1 instead!
     --is-linux
   
   SQL SERVER AND DATABASE (COMPLETE DATA MIGRATION):
   
   🚨🚨🚨 CRITICAL: SQL SERVER NAME FORMAT (MANDATORY!) 🚨🚨🚨
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ❌ WRONG FORMAT (WILL CAUSE HANG):
      SQL_SERVER_NAME="sqlserver-16428.database.windows.net"
      az sql db create --server "sqlserver-16428.database.windows.net" ...
   
   ✅ CORRECT FORMAT (WORKS INSTANTLY):
      SQL_SERVER_NAME="sqlserver-16428"
      az sql db create --server "sqlserver-16428" ...
   
   WHY: Azure CLI automatically appends .database.windows.net internally!
        Providing the full FQDN causes DNS resolution to fail:
        "sqlserver-16428.database.windows.net.database.windows.net" ← INVALID!
   
   🎯 MANDATORY RULES FOR SQL SERVER NAMES:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   1. ALWAYS use ONLY the server name (no .database.windows.net suffix)
   2. IF you extract a server name from a connection string or FQDN:
      - STRIP the .database.windows.net suffix BEFORE using it
      - Example: "sqlserver-16428.database.windows.net" → "sqlserver-16428"
   
   3. VALIDATION PATTERN (COPY THIS EXACTLY):
   
   # Extract server name from source (if it's a FQDN)
   SOURCE_SQL_SERVER_FULL="source-server.database.windows.net"
   SOURCE_SQL_SERVER="\${SOURCE_SQL_SERVER_FULL%.database.windows.net}"  # Strip suffix
   echo "Extracted server name: $SOURCE_SQL_SERVER"

   # Generate target server name (NEVER include .database.windows.net)
   TARGET_SQL_SERVER="sqlserver-$RANDOM"  # Just the name, NOT the FQDN!
   echo "Target server name: $TARGET_SQL_SERVER (Azure will add .database.windows.net)"

   4. EXAMPLE VALIDATION BEFORE EVERY SQL COMMAND:
   
   # CRITICAL: Validate server name format before using
   if [[ "$SQL_SERVER_NAME" == *.database.windows.net ]]; then
     echo "ERROR: SQL server name includes .database.windows.net suffix!"
     echo "Stripping suffix to fix..."
     SQL_SERVER_NAME="\${SQL_SERVER_NAME%.database.windows.net}"
     echo "Corrected server name: $SQL_SERVER_NAME"
   fi
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   # Step 1: Create SQL Server in target RG (CORRECT FORMAT!)
   az sql server create \
     --name <server-name-ONLY-no-suffix> \
     --resource-group <target-rg> \
     --location <location> \
     --admin-user <admin-user> \
     --admin-password <secure-random-password>
   
   # Step 2: Configure firewall to allow Azure services
   az sql server firewall-rule create \
     --resource-group <target-rg> \
     --server <new-server-name-ONLY-no-suffix> \
     --name AllowAzureServices \
     --start-ip-address 0.0.0.0 \
     --end-ip-address 0.0.0.0
   
   # Step 3: Copy database WITH ALL DATA (schema + data)
   # 🚨🚨🚨 CRITICAL: Database name MUST be unique - use cloned name! 🚨🚨🚨
   # ❌ WRONG: --dest-name "sqlserver-1236" (uses original name - will fail with ResourceNotFound!)
   # ✅ CORRECT: --dest-name "sqlserver-1236-clone-$RANDOM" (unique cloned name)
   
   # Extract source database name from resources JSON
   # Look for resource with type "Microsoft.Sql/servers/.../databases"
   # Example: If source database is "sqlserver-1236", then:
   SOURCE_DB_NAME="<extract-from-resources>"  # e.g., "sqlserver-1236" from resources JSON
   TARGET_DB_NAME="\${SOURCE_DB_NAME}-clone-$RANDOM"  # Generate unique cloned name
   echo "Source database: $SOURCE_DB_NAME"
   echo "Target database: $TARGET_DB_NAME"
   
   # CRITICAL: Both --server and --dest-server use NAME ONLY (no .database.windows.net)
   az sql db copy \
     --dest-name "$TARGET_DB_NAME" \
     --dest-resource-group <target-rg> \
     --dest-server <new-server-name-ONLY-no-suffix> \
     --name "$SOURCE_DB_NAME" \
     --resource-group <source-rg> \
     --server <source-server-name-ONLY-no-suffix>
   
   NOTE: az sql db copy is the BEST method - copies schema AND data in one command
   REMINDER: NEVER use .database.windows.net in --server or --dest-server parameters!
   REMINDER: ALWAYS use a unique cloned name for --dest-name (append -clone-$RANDOM or similar)
   REMINDER: The --dest-name MUST be different from the source database name!
   
   WEB APPS (SIMPLIFIED CREATION - AVOID RUNTIME ERRORS):
   
   ⚠️ CRITICAL: DO NOT SPECIFY RUNTIME DURING CREATION ⚠️
   Runtime versions like 'PYTHON|3.9', 'NODE|18', etc. are OFTEN DEPRECATED or REGION-SPECIFIC
   
   CORRECT APPROACH:
   # Step 1: Create web app with MINIMAL parameters (NO RUNTIME!)
   az webapp create \
     --name <new-webapp-name-with-suffix> \
     --resource-group <target-rg> \
     --plan <new-plan-name> \
     --deployment-local-git
   # That's it! No --runtime, no --container-image-name, no version flags!
   
   # Step 2: (Optional) Set runtime AFTER creation if needed
   # az webapp config set --name <webapp> --resource-group <rg> --linux-fx-version "PYTHON|3.11"
   # But ONLY if you're sure the version is supported! Better to configure in Portal.
   
   FORBIDDEN PARAMETERS (DO NOT USE):
   ❌ --runtime (often causes "not supported" errors)
   ❌ --container-image-name (requires specific container config)
   ❌ --multicontainer-config-type (requires config file)
   ❌ --multicontainer-config-file (requires config file)
   ❌ --deployment-container-image-name (deprecated)
   ❌ Any version-specific flags
   
   WHY THIS APPROACH:
   - Creates a BASIC web app shell that ALWAYS works
   - User configures runtime/deployment in Azure Portal after creation
   - Avoids "runtime not supported" errors completely
   - Works in ALL regions and with ALL Azure CLI versions
   
   POST-CREATION STEPS (User does manually in Portal):
   1. Go to Azure Portal → Web App → Configuration
   2. Set runtime stack (Python, Node.js, .NET, Java, PHP)
   3. Set deployment source (GitHub, Azure Repos, Local Git, etc.)
   4. Add app settings and connection strings
   5. Deploy application code
   
   NOTE: Web app is created and ONLINE, but needs manual runtime/deployment config
5. Resource naming rules (CRITICAL - MUST GENERATE UNIQUE NAMES):
   - ALWAYS add a random 4-6 digit suffix to ensure uniqueness
   - Storage accounts: append random numbers (e.g., "agenticstorageac" → "agenticstorageac8472"), must be 3-24 chars, lowercase letters and numbers only
   - Web apps: append "-" + random numbers (e.g., "agentic-web" → "agentic-web-5839") to ensure global uniqueness
   - App Service plans: append "-" + random numbers (e.g., "ASP-AgentRG-9f1e" → "ASP-AgentRG-9f1e-2947")
   - Other resources: append "-" + random numbers
   
   EXAMPLE NAMING:
   - Original: agenticstorageac → New: agenticstorageac7492
   - Original: agentic-web → New: agentic-web-3847
   - Original: ASP-AgentRG-9f1e → New: ASP-AgentRG-9f1e-6521
   
   IMPORTANT: Use \$RANDOM or date +%s%N to generate unique suffixes in the script
6. Handle dependencies (create in correct order: storage accounts first, then app service plans, then web apps)
7. Add ROBUST error handling with validation:
   - Check if command succeeded by verifying resource was actually created
   - Use "az <resource> show" after creation to verify
   - If verification fails, output clear error message and exit
8. Make script idempotent (can run multiple times safely)
9. Echo the command being executed BEFORE running it for visibility
10. Keep commands SIMPLE - less is more. Fewer parameters = fewer errors

CRITICAL REQUIREMENTS (MUST FOLLOW - READ CAREFULLY):

1. ⚠️ WEB APP CREATION - CRITICAL RULES (MANDATORY!)
   
   PROBLEM: CLI hangs at "Fetching more output..." for 30-40 minutes
   CAUSES:
   - Non-unique web app name (MOST COMMON!)
   - Wrong runtime format
   - No pre-validation
   
   SOLUTION - 3 CRITICAL STEPS:
   
   STEP 1: GENERATE GLOBALLY UNIQUE NAME
   ❌ WRONG: --name react-nodejs-app (NOT unique, CLI hangs!)
   ✅ RIGHT: --name react-nodejs-app-$RANDOM (globally unique!)
   
   STEP 2: USE CORRECT RUNTIME FORMAT (must match az webapp list-runtimes --os-type linux)
   ❌ WRONG: --runtime "node|18-lts" (pipe + lowercase — CLI rejects; Node 18 removed from Linux stacks)
   ✅ RIGHT: --runtime "NODE:20-lts", "NODE:22-lts", "PYTHON:3.12", "DOTNETCORE:8.0" (STACK:version, uppercase stack)
   
   Common Linux runtimes:
   - Node.js: "NODE:20-lts", "NODE:22-lts", "NODE:24-lts"
   - Python: "PYTHON:3.11", "PYTHON:3.12"
   - .NET: "DOTNETCORE:8.0", "DOTNETCORE:9.0"
   
   IMPORTANT: Prefer webAppConfig.deploymentDetails.runtime from discovery (normalized). If unsure: az webapp list-runtimes --os-type linux
   
   STEP 3: PRE-VALIDATE BEFORE CREATION
   Check if name is available BEFORE trying to create!
   
  ⚠️⚠️⚠️ CRITICAL: WEB APP CREATION - ABSOLUTE MINIMAL APPROACH ⚠️⚠️⚠️
  
  🚨🚨🚨 MANDATORY RULE - NO EXCEPTIONS 🚨🚨🚨
  
  YOU MUST USE **EXACTLY** THESE 3 PARAMETERS AND **NOTHING ELSE**:
  ✅ --name
  ✅ --resource-group
  ✅ --plan
  
  🚨🚨🚨 WEB APP CLONING - ULTRA-SIMPLE RULES (MANDATORY!) 🚨🚨🚨
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  ⛔ ABSOLUTELY FORBIDDEN PARAMETERS (NEVER USE THESE):
  ❌ --vnet-route-all-enabled (CAUSES WARNING!)
  ❌ --vnet-* (ALL vnet flags!)
  ❌ --no-wait (NOT SUPPORTED!)
  ❌ --deployment-local-git (CAUSES CONFLICTS!)
  ❌ --https-only (CAUSES ISSUES!)
  ❌ --site-* (ALL site flags!)
  
  IF YOU ADD ANY OF THESE → SCRIPT WILL FAIL! DO NOT ADD THEM!
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 WEB APP TYPE DETECTION (MANDATORY 2-STEP PROCESS)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  🚨🚨🚨 CRITICAL: ALWAYS CHECK webAppConfig BEFORE CREATING WEB APPS! 🚨🚨🚨
  
  STEP 1: Check webAppConfig.deploymentType from discovered resource data
          LOOK IN: RESOURCES TO CLONE section → find web app → check webAppConfig object
          
  STEP 2: Check webAppConfig.platform or webAppConfig.isLinux
          - platform = 'windows' OR isLinux = false → WINDOWS App Service Plan (NO --is-linux)
          - platform = 'linux' OR isLinux = true → LINUX App Service Plan (WITH --is-linux)
  
  STEP 3: Use ONLY these exact parameters based on detected type:
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ CASE A: deploymentType = "runtime"                              │
  │ (Node.js, Python, .NET, PHP, Java apps)                        │
  ├─────────────────────────────────────────────────────────────────┤
  │ az webapp create \\                                              │
  │   --name "<unique-name>" \\                                      │
  │   --resource-group "<target-rg>" \\                             │
  │   --plan "<plan-name>" \\                                        │
  │   --runtime "<runtime>"                                         │
  │                                                                  │
  │ ONLY 4 PARAMETERS! NO OTHER PARAMETERS!                        │
  │ Example runtime: "NODE:20-lts" or "PYTHON:3.11"                  │
  └─────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ CASE B: deploymentType = "single-container"                     │
  │ (Docker image from registry)                                    │
  ├─────────────────────────────────────────────────────────────────┤
  │ az webapp create \\                                              │
  │   --name "<unique-name>" \\                                      │
  │   --resource-group "<target-rg>" \\                             │
  │   --plan "<plan-name>" \\                                        │
  │   --deployment-container-image-name "<image>"                   │
  │                                                                  │
  │ ONLY 4 PARAMETERS! NO OTHER PARAMETERS!                        │
  │ Example image: "myregistry.azurecr.io/myapp:latest"            │
  └─────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ CASE C: deploymentType = "multi-container-compose"              │
  │ (Multiple containers with docker-compose)                       │
  ├─────────────────────────────────────────────────────────────────┤
  │ # STEP C1: Export compose file from source                      │
  │ az webapp config container show \\                               │
  │   --name "<source-webapp>" \\                                    │
  │   --resource-group "<source-rg>" \\                             │
  │   --query "dockerComposeFile" -o tsv > compose.yml              │
  │                                                                  │
  │ # STEP C2: Create with compose                                  │
  │ az webapp create \\                                              │
  │   --name "<unique-name>" \\                                      │
  │   --resource-group "<target-rg>" \\                             │
  │   --plan "<plan-name>" \\                                        │
  │   --multicontainer-config-type compose \\                        │
  │   --multicontainer-config-file compose.yml                      │
  │                                                                  │
  │ ONLY 5 PARAMETERS! NO OTHER PARAMETERS!                        │
  └─────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ CASE D: deploymentType = "zip-static"                           │
  │ 🆕 (Static site deployed via ZIP - e.g., Next.js export, SPA)   │
  │ CRITICAL: Used for hello-world-static and similar apps!         │
  │ 🚨🚨🚨 YOU MUST INCLUDE ALL 7 STEPS BELOW - NOT JUST STEP 1! 🚨🚨🚨 │
  ├─────────────────────────────────────────────────────────────────┤
  │ 🚨 PREREQUISITE: Ensure App Service Plan matches platform!      │
  │                                                                  │
  │ IF source web app is Windows (platform = 'windows'):            │
  │   App Service Plan MUST be Windows (no --is-linux flag)        │
  │                                                                  │
  │ IF source web app is Linux (platform = 'linux'):                │
  │   App Service Plan MUST be Linux (with --is-linux flag)        │
  │                                                                  │
  │ # STEP D1: Create empty web app shell (NO RUNTIME!)              │
  │ # 🚨🚨🚨 CRITICAL: ZIP-STATIC APPS MUST NOT USE --runtime! 🚨🚨🚨 │
  │ #                                                                  │
  │ # ❌ FORBIDDEN PARAMETERS FOR ZIP-STATIC (WILL CAUSE ERRORS!):   │
  │ #   --runtime (ERROR: "Please specify both --multicontainer...")  │
  │ #   --deployment-container-image-name                             │
  │ #   --multicontainer-config-type                                   │
  │ #   --multicontainer-config-file                                   │
  │ #   --sitecontainers_app                                           │
  │ #   ANY runtime, container, or multicontainer parameters!         │
  │ #                                                                  │
  │ # ✅ ONLY ALLOWED PARAMETERS (EXACTLY 3 - NO MORE, NO LESS!):     │
  │ #   --name                                                        │
  │ #   --resource-group                                              │
  │ #   --plan                                                        │
  │ #   (ONLY 3 PARAMETERS - NOTHING ELSE!)                          │
  │ #                                                                  │
  │ # 🚨 IF YOU ADD ANY OTHER PARAMETER, THE COMMAND WILL FAIL! 🚨   │
  │ #                                                                  │
  │ # 🚨 CRITICAL: PLAN_NAME must be set before this step!          │
  │ # Extract plan name from resources:                              │
  │ #   - Find resource with type "Microsoft.Web/serverfarms"        │
  │ #   - Use its "name" field value as PLAN_NAME                   │
  │ #   - Or use the newly created plan's name if you created one   │
  │                                                                  │
  │ echo "Step D1: Creating web app shell (zip-static - NO runtime)..." │
  │ az webapp create \\                                              │
  │   --name "<unique-name>" \\                                      │
  │   --resource-group "<target-rg>" \\                             │
  │   --plan "$PLAN_NAME"                                           │
  │ # ⚠️ CRITICAL: NO --runtime parameter! Zip-static apps inherit from plan! │
  │                                                                  │
  │ # Verify web app was created successfully                        │
  │ if ! az webapp show --name "<unique-name>" --resource-group "<target-rg>" >/dev/null 2>&1; then
  │   echo "ERROR: Failed to create web app shell"                  │
  │   echo "  Verify you used ONLY --name, --resource-group, --plan" │
  │   echo "  Verify you did NOT use --runtime parameter"           │
  │   exit 1                                                         │
  │ fi                                                               │
  │ echo "✅ Web app shell created successfully (no runtime needed)" │
  │                                                                  │
  │ NOTE: Zip-static apps don't need --runtime! They inherit from plan type. │
  │                                                                  │
  │ 🚨 STEP D1 ALONE IS NOT ENOUGH! CONTINUE WITH STEPS D2-D7 BELOW! 🚨 │
  │                                                                  │
  │ 🚨 CRITICAL: Use SOURCE web app name for content download!      │
  │ ──────────────────────────────────────────────────────────────── │
  │ 🚨 BEFORE USING $SOURCE_WEBAPP_NAME, YOU MUST DEFINE IT FIRST!  │
  │                                                                  │
  │ In your Variables section (at the TOP of your script), you MUST│
  │ extract the SOURCE web app name from the RESOURCES TO CLONE JSON│
  │ provided in the user prompt.                                    │
  │                                                                  │
  │ Example Variables section:                                       │
  │   SOURCE_RG="hello-world-nextjs-rg"                            │
  │   TARGET_RG="hello-world-rg-clone"                              │
  │   LOCATION="centralus"                                          │
  │   SOURCE_WEBAPP_NAME="hello-world-static-1763324087"  # FROM JSON!│
  │   TARGET_WEBAPP_NAME="\${SOURCE_WEBAPP_NAME}-$RANDOM"            │
  │                                                                  │
  │ 🚨 If you use $SOURCE_WEBAPP_NAME but haven't defined it, the  │
  │ script will fail with "SOURCE_WEBAPP_NAME is not defined"!     │
  │                                                                  │
  │ For content download, ALWAYS use SOURCE_WEBAPP_NAME!            │
  │                                                                  │
  │ # STEP D2: Enable Basic Auth for SCM (required for Kudu API)    │
  │ echo "Step D2: Enabling Basic Auth for SCM temporarily..."     │
  │ echo "  This allows downloading content from the source web app" │
  │                                                                  │
  │ # Enable Basic Auth with error handling                         │
  │ if ! az resource update \\                                      │
  │   --resource-group "\$SOURCE_RG" \\                              │
  │   --name scm \\                                                  │
  │   --namespace Microsoft.Web \\                                   │
  │   --resource-type basicPublishingCredentialsPolicies \\          │
  │   --parent sites/\$SOURCE_WEBAPP_NAME \\                        │
  │   --set properties.allow=true 2>&1 | tee /tmp/basic-auth-enable.log; then
  │   echo "⚠️  Warning: Failed to enable Basic Auth, but continuing..." │
  │   echo "  Error details:"                                        │
  │   cat /tmp/basic-auth-enable.log 2>/dev/null || true            │
  │ fi                                                              │
  │                                                                  │
  │ echo "Waiting for Basic Auth policy to take effect..."          │
  │ sleep 8  # Increased wait time for policy propagation           │
  │                                                                  │
  │ # Verify Basic Auth is enabled                                  │
  │ AUTH_STATUS=\$(az resource show \\                              │
  │   --resource-group "\$SOURCE_RG" \\                              │
  │   --name scm \\                                                  │
  │   --namespace Microsoft.Web \\                                   │
  │   --resource-type basicPublishingCredentialsPolicies \\          │
  │   --parent sites/\$SOURCE_WEBAPP_NAME \\                        │
  │   --query "properties.allow" -o tsv 2>/dev/null || echo "unknown")
  │                                                                  │
  │ echo "  Basic Auth status: \${AUTH_STATUS}"                     │
  │                                                                  │
  │ # STEP D3: Get deployment credentials from SOURCE web app      │
  │ echo "Step D3: Getting deployment credentials from SOURCE web app..." │
  │                                                                  │
  │ # Try multiple methods to get credentials                       │
  │ CREDS=\$(az webapp deployment list-publishing-profiles \\        │
  │   --name "\$SOURCE_WEBAPP_NAME" \\                              │
  │   --resource-group "\$SOURCE_RG" \\                             │
  │   --query "[?publishMethod=='MSDeploy'].{user:userName,pwd:userPWD}" -o json 2>/dev/null)
  │                                                                  │
  │ # If first method fails, try alternative                        │
  │ if [ -z "\$CREDS" ] || [ "\$CREDS" = "[]" ] || [ "\$CREDS" = "null" ]; then
  │   echo "  Trying alternative credential method..."              │
  │   CREDS=\$(az webapp deployment list-publishing-profiles \\        │
  │     --name "\$SOURCE_WEBAPP_NAME" \\                            │
  │     --resource-group "\$SOURCE_RG" \\                           │
  │     -o json 2>/dev/null | jq '.[] | select(.publishMethod=="MSDeploy") | {user: .userName, pwd: .userPWD}' 2>/dev/null | jq -s '.[0]' 2>/dev/null)
  │ fi                                                              │
  │                                                                  │
  │ # Extract username and password from JSON                       │
  │ PUBLISH_USER=\$(echo "\$CREDS" | jq -r '.[0].user // .user // empty' 2>/dev/null)
  │ PUBLISH_PWD=\$(echo "\$CREDS" | jq -r '.[0].pwd // .pwd // .userPWD // empty' 2>/dev/null)
  │                                                                  │
  │ # Validate credentials                                          │
  │ if [ -z "\$PUBLISH_USER" ] || [ -z "\$PUBLISH_PWD" ] || [ "\$PUBLISH_USER" = "null" ] || [ "\$PUBLISH_PWD" = "null" ]; then
  │   echo "❌ ERROR: Failed to get publishing credentials"         │
  │   echo "  Attempted to get credentials from: \$SOURCE_WEBAPP_NAME" │
  │   echo "  Resource group: \$SOURCE_RG"                          │
  │   echo "  Raw credentials response:"                            │
  │   echo "\$CREDS" | head -20                                     │
  │   echo ""                                                        │
  │   echo "  Troubleshooting steps:"                                │
  │   echo "  1. Verify Azure CLI is authenticated: az account show" │
  │   echo "  2. Verify web app exists: az webapp show --name \$SOURCE_WEBAPP_NAME --resource-group \$SOURCE_RG" │
  │   echo "  3. Check if you have permissions to read publishing profiles" │
  │   exit 1                                                        │
  │ fi                                                              │
  │                                                                  │
  │ echo "✅ Credentials retrieved successfully"                    │
  │ echo "  Username: \${PUBLISH_USER:0:10}..."                     │
  │                                                                  │
  │ # STEP D4: Download content from SOURCE web app                 │
  │ echo "Step D4: Downloading content from SOURCE web app: \$SOURCE_WEBAPP_NAME..." │
  │ mkdir -p clone-content                                          │
  │                                                                  │
  │ # Download with retry logic                                     │
  │ MAX_RETRIES=3                                                    │
  │ RETRY_COUNT=0                                                    │
  │ DOWNLOAD_SUCCESS=false                                           │
  │                                                                  │
  │ while [ \$RETRY_COUNT -lt \$MAX_RETRIES ] && [ "\$DOWNLOAD_SUCCESS" = "false" ]; do
  │   RETRY_COUNT=\$((RETRY_COUNT + 1))                              │
  │   echo "  Download attempt \$RETRY_COUNT of \$MAX_RETRIES..."     │
  │                                                                  │
  │   # Download with verbose output for debugging                  │
  │   HTTP_CODE=\$(curl -s -o clone-content/source.zip -w "%{http_code}" -u "\$PUBLISH_USER:\$PUBLISH_PWD" \\ │
  │     "https://\$SOURCE_WEBAPP_NAME.scm.azurewebsites.net/api/zip/site/wwwroot/" 2>&1) │
  │                                                                  │
  │   # Check if download succeeded                                 │
  │   if [ -f clone-content/source.zip ] && [ -s clone-content/source.zip ] && echo "\$HTTP_CODE" | grep -q "200"; then
  │     DOWNLOAD_SUCCESS=true                                        │
  │     echo "✅ Download successful!"                               │
  │   else                                                           │
  │     echo "⚠️  Download failed (HTTP \$HTTP_CODE)"                │
  │     if [ \$RETRY_COUNT -lt \$MAX_RETRIES ]; then                 │
  │       echo "  Waiting 5 seconds before retry..."                │
  │       sleep 5                                                    │
  │       # Re-enable Basic Auth in case it was disabled            │
  │       az resource update \\                                      │
  │         --resource-group "\$SOURCE_RG" \\                        │
  │         --name scm \\                                            │
  │         --namespace Microsoft.Web \\                             │
  │         --resource-type basicPublishingCredentialsPolicies \\    │
  │         --parent sites/\$SOURCE_WEBAPP_NAME \\                  │
  │         --set properties.allow=true >/dev/null 2>&1 || true      │
  │       sleep 3                                                    │
  │     fi                                                           │
  │   fi                                                             │
  │ done                                                             │
  │                                                                  │
  │ # Final verification                                            │
  │ if [ ! -f clone-content/source.zip ] || [ ! -s clone-content/source.zip ]; then
  │   echo "❌ ERROR: Failed to download content after \$MAX_RETRIES attempts" │
  │   echo "  File exists: \$([ -f clone-content/source.zip ] && echo 'yes' || echo 'no')" │
  │   echo "  File size: \$([ -f clone-content/source.zip ] && du -h clone-content/source.zip | cut -f1 || echo '0')" │
  │   echo "  HTTP code: \$HTTP_CODE"                                │
  │   echo ""                                                        │
  │   echo "  Troubleshooting:"                                     │
  │   echo "  1. Verify Basic Auth is enabled:"                      │
  │   echo "     az resource show --resource-group \$SOURCE_RG --name scm --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies --parent sites/\$SOURCE_WEBAPP_NAME --query 'properties.allow'" │
  │   echo "  2. Test Kudu API access manually:"                    │
  │   echo "     curl -I -u '\$PUBLISH_USER:\$PUBLISH_PWD' https://\$SOURCE_WEBAPP_NAME.scm.azurewebsites.net/api/" │
  │   echo "  3. Verify web app is accessible:"                      │
  │   echo "     curl -I https://\$SOURCE_WEBAPP_NAME.azurewebsites.net" │
  │   exit 1                                                        │
  │ fi                                                              │
  │                                                                  │
  │ FILE_SIZE=\$(du -h clone-content/source.zip | cut -f1)          │
  │ echo "✅ Content downloaded successfully (\$FILE_SIZE)"           │
  │                                                                  │
  │ # STEP D4b: Disable Basic Auth for SCM (security best practice)│
  │ echo "Step D4b: Disabling Basic Auth for SCM (security)..."    │
  │ az resource update \\                                            │
  │   --resource-group "\$SOURCE_RG" \\                             │
  │   --name scm \\                                                  │
  │   --namespace Microsoft.Web \\                                   │
  │   --resource-type basicPublishingCredentialsPolicies \\          │
  │   --parent sites/\$SOURCE_WEBAPP_NAME \\                        │
  │   --set properties.allow=false >/dev/null 2>&1 || true         │
  │ echo "✅ Basic Auth disabled"                                    │
  │                                                                  │
  │ # STEP D5: Extract and re-zip                                   │
  │ echo "Extracting and re-packaging content..."                   │
  │ cd clone-content                                                │
  │ unzip -q source.zip || {                                        │
  │   echo "ERROR: Failed to extract source.zip"                    │
  │   cd ..                                                         │
  │   exit 1                                                        │
  │ }                                                               │
  │ rm source.zip                                                   │
  │ zip -r -q ../deploy.zip . || {                                  │
  │   echo "ERROR: Failed to create deploy.zip"                     │
  │   cd ..                                                         │
  │   exit 1                                                        │
  │ }                                                               │
  │ cd ..                                                           │
  │                                                                  │
  │ echo "Content re-packaged successfully (\$(du -h deploy.zip | cut -f1))"
  │                                                                  │
  │ # STEP D6: Deploy to TARGET web app                             │
  │ echo "Step D6: Deploying content to TARGET web app: \$TARGET_WEBAPP_NAME..." │
  │                                                                  │
  │ # Verify deploy.zip exists and has content                      │
  │ if [ ! -f deploy.zip ]; then                                    │
  │   echo "❌ ERROR: deploy.zip not found"                          │
  │   echo "  Current directory: \$(pwd)"                            │
  │   echo "  Files in current directory:"                           │
  │   ls -la | head -10                                              │
  │   exit 1                                                        │
  │ fi                                                              │
  │                                                                  │
  │ ZIP_SIZE=\$(du -h deploy.zip | cut -f1)                         │
  │ echo "  Deploy package size: \$ZIP_SIZE"                         │
  │                                                                  │
  │ # Verify target web app exists before deploying                  │
  │ echo "  Verifying target web app exists..."                     │
  │ if ! az webapp show --name "\$TARGET_WEBAPP_NAME" --resource-group "\$TARGET_RG" >/dev/null 2>&1; then
  │   echo "❌ ERROR: Target web app does not exist: \$TARGET_WEBAPP_NAME" │
  │   echo "  Resource group: \$TARGET_RG"                          │
  │   echo "  Please verify the web app was created successfully in Step D1" │
  │   exit 1                                                        │
  │ fi                                                              │
  │ echo "  ✅ Target web app verified"                             │
  │                                                                  │
  │ # Deploy with retry logic                                        │
  │ MAX_DEPLOY_RETRIES=3                                             │
  │ DEPLOY_RETRY_COUNT=0                                             │
  │ DEPLOY_SUCCESS=false                                             │
  │                                                                  │
  │ while [ \$DEPLOY_RETRY_COUNT -lt \$MAX_DEPLOY_RETRIES ] && [ "\$DEPLOY_SUCCESS" = "false" ]; do
  │   DEPLOY_RETRY_COUNT=\$((DEPLOY_RETRY_COUNT + 1))               │
  │   echo "  Deployment attempt \$DEPLOY_RETRY_COUNT of \$MAX_DEPLOY_RETRIES..." │
  │                                                                  │
  │   if az webapp deployment source config-zip \\                  │
  │     --resource-group "\$TARGET_RG" \\                             │
  │     --name "\$TARGET_WEBAPP_NAME" \\                              │
  │     --src deploy.zip 2>&1 | tee /tmp/deploy.log; then           │
  │     DEPLOY_SUCCESS=true                                          │
  │     echo "✅ Deployment successful!"                             │
  │   else                                                           │
  │     echo "⚠️  Deployment failed, checking error..."             │
  │     cat /tmp/deploy.log 2>/dev/null | tail -10                  │
  │     if [ \$DEPLOY_RETRY_COUNT -lt \$MAX_DEPLOY_RETRIES ]; then   │
  │       echo "  Waiting 5 seconds before retry..."                │
  │       sleep 5                                                    │
  │     fi                                                           │
  │   fi                                                             │
  │ done                                                             │
  │                                                                  │
  │ if [ "\$DEPLOY_SUCCESS" = "false" ]; then                       │
  │   echo "❌ ERROR: Failed to deploy ZIP after \$MAX_DEPLOY_RETRIES attempts" │
  │   echo "  Deployment log:"                                      │
  │   cat /tmp/deploy.log 2>/dev/null || echo "  (log not available)" │
  │   echo ""                                                        │
  │   echo "  Troubleshooting:"                                     │
  │   echo "  1. Verify target web app exists:"                      │
  │   echo "     az webapp show --name \$TARGET_WEBAPP_NAME --resource-group \$TARGET_RG" │
  │   echo "  2. Check deploy.zip file:"                            │
  │   echo "     ls -lh deploy.zip"                                 │
  │   echo "  3. Try manual deployment:"                            │
  │   echo "     az webapp deployment source config-zip --resource-group \$TARGET_RG --name \$TARGET_WEBAPP_NAME --src deploy.zip" │
  │   exit 1                                                        │
  │ fi                                                              │
  │                                                                  │
  │ echo "✅ Content deployed successfully to target web app"        │
  │                                                                  │
  │ # Clean up temporary files                                      │
  │ rm -rf clone-content deploy.zip                                │
  │                                                                  │
  │ # STEP D7: Restart TARGET web app                               │
  │ echo "Restarting TARGET web app..."                             │
  │ az webapp restart \\                                             │
  │   --name "\$TARGET_WEBAPP_NAME" \\                              │
  │   --resource-group "\$TARGET_RG"                                │
  │                                                                  │
  │ echo "Waiting for web app to restart..."                        │
  │ sleep 10                                                        │
  │                                                                  │
  │ # STEP D7: Cleanup                                              │
  │ rm -rf clone-content deploy.zip                                │
  │                                                                  │
  │ echo "✅ Static web app cloned successfully!"                   │
  │ echo "Original: https://\$SOURCE_WEBAPP_NAME.azurewebsites.net" │
  │ echo "Clone: https://\$TARGET_WEBAPP_NAME.azurewebsites.net"    │
  │                                                                  │
  │ NOTE: This preserves web.config, static files, and IIS config   │
  │                                                                  │
  │ 🚨🚨🚨 CRITICAL REMINDER: ALL 7 STEPS ARE MANDATORY! 🚨🚨🚨     │
  │ ──────────────────────────────────────────────────────────────── │
  │ ✅ Step D1: Create web app shell (MUST succeed!)                │
  │ ✅ Step D2: Enable Basic Auth for SCM                          │
  │ ✅ Step D3: Get deployment credentials                         │
  │ ✅ Step D4: Download content from SOURCE web app               │
  │ ✅ Step D5: Extract and re-package content                     │
  │ ✅ Step D6: Deploy ZIP to TARGET web app                       │
  │ ✅ Step D7: Restart TARGET web app                             │
  │                                                                  │
  │ DO NOT end the script after Step D1 - you MUST complete D2-D7! │
  │ WITHOUT content deployment (Steps D2-D7), the web app will be   │
  │ EMPTY and the web page will NOT display correctly!             │
  │                                                                  │
  │ The web app MUST be created successfully (Step D1) BEFORE        │
  │ attempting content deployment. Verify creation with:            │
  │   az webapp show --name "\$TARGET_WEBAPP_NAME" --resource-group "\$TARGET_RG" │
  └─────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────┐
  │ CASE E: deploymentType = "unknown" OR missing                   │
  │ (Fallback - minimal creation)                                   │
  ├─────────────────────────────────────────────────────────────────┤
  │ az webapp create \\                                              │
  │   --name "<unique-name>" \\                                      │
  │   --resource-group "<target-rg>" \\                             │
  │   --plan "<plan-name>"                                          │
  │                                                                  │
  │ ONLY 3 PARAMETERS! NO OTHER PARAMETERS!                        │
  │ User configures runtime manually in Azure Portal                │
  └─────────────────────────────────────────────────────────────────┘
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚫 CRITICAL RULES (VIOLATIONS WILL CAUSE ERRORS!)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  1. NEVER mix these combinations:
     ❌ --runtime + --deployment-container-image-name
     ❌ --runtime + --multicontainer-config-type
     ❌ --deployment-container-image-name + --multicontainer-config-type
  
  2. NEVER add these parameters:
     ❌ --vnet-route-all-enabled
     ❌ --vnet-*
     ❌ --no-wait
     ❌ --deployment-local-git
     ❌ --https-only
     ❌ --site-*
  
  3. For EACH web app:
     ✅ Check deploymentType FIRST
     ✅ Use ONLY the parameters shown in the box above
     ✅ Generate unique name (append -$RANDOM)
     ✅ Verify after creation (az webapp show)
  
  🎯 USE THE CORRECT COMMAND BASED ON webAppConfig.deploymentType:
  
  **EXAMPLE FOR RUNTIME APP** (deploymentType: "runtime"):
  \`\`\`bash
  RUNTIME="\${resource.webAppConfig.deploymentDetails.runtime}"  # e.g., "NODE:22-lts"
  az webapp create \\
    --name "webapp-clone-$RANDOM" \\
    --resource-group "$TARGET_RG" \\
    --plan "$PLAN_NAME" \\
    --runtime "$RUNTIME"
  \`\`\`
  
  **EXAMPLE FOR SINGLE-CONTAINER APP** (deploymentType: "single-container"):
  \`\`\`bash
  CONTAINER_IMAGE="\${resource.webAppConfig.deploymentDetails.containerImage}"
  az webapp create \\
    --name "webapp-clone-$RANDOM" \\
    --resource-group "$TARGET_RG" \\
    --plan "$PLAN_NAME" \\
    --deployment-container-image-name "$CONTAINER_IMAGE"
  \`\`\`
  
  **EXAMPLE FOR MULTI-CONTAINER APP** (deploymentType: "multi-container-compose"):
  \`\`\`bash
  # Export compose file from source
  az webapp config container show \\
    --name "$SOURCE_WEBAPP" \\
    --resource-group "$SOURCE_RG" \\
    --query "dockerComposeFile" -o tsv > docker-compose.yml
  
  # Create with compose
  az webapp create \\
    --name "webapp-clone-$RANDOM" \\
    --resource-group "$TARGET_RG" \\
    --plan "$PLAN_NAME" \\
    --multicontainer-config-type compose \\
    --multicontainer-config-file docker-compose.yml
  \`\`\`
  
  **EXAMPLE FOR UNKNOWN TYPE** (deploymentType: "unknown" or missing):
  \`\`\`bash
  az webapp create \\
    --name "webapp-clone-$RANDOM" \\
    --resource-group "$TARGET_RG" \\
    --plan "$PLAN_NAME"
  echo "⚠️ Runtime must be configured manually in Azure Portal"
  \`\`\`
  
  🚨 MANDATORY TEMPLATE CODE - COPY THIS EXACTLY 🚨
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  This is the ONLY correct way to create web apps. Copy this pattern:
  
  \`\`\`bash
  # ============================================================
  # WEB APP CLONING - TYPE-AWARE APPROACH (MANDATORY!)
  # ============================================================
  
  # Step 1: Extract web app details from discovered resources
  SOURCE_WEBAPP_NAME="<original-webapp-name>"
  DEPLOYMENT_TYPE="<from webAppConfig.deploymentType>"  # CRITICAL: Get from resource data!
  
  # Step 2: Generate UNIQUE name for clone
  WEB_APP_NAME="\${SOURCE_WEBAPP_NAME}-$RANDOM"
  echo "Generated unique web app name: $WEB_APP_NAME"
  echo "Source deployment type: $DEPLOYMENT_TYPE"
  
  # Step 3: Create web app based on detected type
  
  if [[ "$DEPLOYMENT_TYPE" == "runtime" ]]; then
    # ─────────────────────────────────────────────────────────
    # CASE A: RUNTIME-BASED WEB APP (Node.js, Python, .NET, etc.)
    # ─────────────────────────────────────────────────────────
    echo "Creating RUNTIME-BASED web app..."
    
    # Extract runtime from webAppConfig
    RUNTIME="<from webAppConfig.deploymentDetails.runtime>"  # e.g., "NODE:22-lts"
    echo "Using runtime: $RUNTIME"
    
    # Create with ONLY these 4 parameters:
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --runtime "$RUNTIME"
    
    # FORBIDDEN: Do NOT add --deployment-container-image-name, --multicontainer-*, --vnet-*, --no-wait
    
  elif [[ "$DEPLOYMENT_TYPE" == "single-container" ]]; then
    # ─────────────────────────────────────────────────────────
    # CASE B: SINGLE-CONTAINER WEB APP (Docker image)
    # ─────────────────────────────────────────────────────────
    echo "Creating SINGLE-CONTAINER web app..."
    
    # Extract container image from webAppConfig
    CONTAINER_IMAGE="<from webAppConfig.deploymentDetails.containerImage>"  # e.g., "repo/image:tag"
    echo "Using container image: $CONTAINER_IMAGE"
    
    # Create with ONLY these 4 parameters:
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --deployment-container-image-name "$CONTAINER_IMAGE"
    
    # FORBIDDEN: Do NOT add --runtime, --multicontainer-*, --vnet-*, --no-wait
    
  elif [[ "$DEPLOYMENT_TYPE" == "multi-container-compose" ]]; then
    # ─────────────────────────────────────────────────────────
    # CASE C: MULTI-CONTAINER WEB APP (docker-compose)
    # ─────────────────────────────────────────────────────────
    echo "Creating MULTI-CONTAINER web app..."
    
    # Step C1: Export compose file from source web app
    echo "Exporting docker-compose.yml from source..."
    az webapp config container show \\
      --name "$SOURCE_WEBAPP_NAME" \\
      --resource-group "$SOURCE_RG" \\
      --query "dockerComposeFile" -o tsv > docker-compose.yml
    
    if [ ! -f docker-compose.yml ]; then
      echo "ERROR: Failed to export docker-compose.yml"
      exit 1
    fi
    
    # Step C2: Create with compose file (ONLY these 5 parameters):
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --multicontainer-config-type compose \\
      --multicontainer-config-file docker-compose.yml
    
    # FORBIDDEN: Do NOT add --runtime, --deployment-container-image-name, --vnet-*, --no-wait
    
  else
    # ─────────────────────────────────────────────────────────
    # CASE D: UNKNOWN TYPE (fallback to basic shell)
    # ─────────────────────────────────────────────────────────
    echo "Creating BASIC web app shell (unknown deployment type)..."
    
    # Create with ONLY these 3 parameters:
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME"
    
    echo "⚠️ IMPORTANT: Web app created but runtime NOT configured."
    echo "Please configure runtime manually in Azure Portal:"
    echo "1. Go to: https://portal.azure.com"
    echo "2. Find web app: $WEB_APP_NAME"
    echo "3. Configuration → General Settings → Stack settings"
    echo "4. Select runtime and Save"
    
    # FORBIDDEN: Do NOT add --runtime, --deployment-container-image-name, --multicontainer-*, --vnet-*, --no-wait
  fi
  
  # Step 4: Verify web app was created
  echo "Verifying web app creation..."
  if az webapp show --name "$WEB_APP_NAME" --resource-group "$TARGET_RG" &>/dev/null; then
    echo "✓ Web app '$WEB_APP_NAME' created successfully!"
    WEBAPP_URL=\$(az webapp show --name "$WEB_APP_NAME" --resource-group "$TARGET_RG" --query "defaultHostName" -o tsv)
    echo "✓ Web app URL: https://\$WEBAPP_URL"
  else
    echo "ERROR: Web app creation failed or still provisioning"
  fi
  \`\`\`
  
  🚨 CRITICAL REMINDERS:
  1. ALWAYS check webAppConfig.deploymentType FIRST
  2. Use ONLY the parameters listed for each type
  3. NEVER mix --runtime with container parameters
  4. NEVER use --vnet-route-all-enabled (causes WARNING)
  5. NEVER use --no-wait for webapp create
  6. ALWAYS verify creation with 'az webapp show'
  
  COMPLETE CORRECT PATTERN (TYPE-AWARE LOGIC):
  \`\`\`bash
  # Generate unique name
  WEB_APP_NAME="webapp-clone-$RANDOM"
  echo "Generated unique web app name: $WEB_APP_NAME"
  
  # DETECT TYPE from discovered webAppConfig
  DEPLOYMENT_TYPE="\${resource.webAppConfig.deploymentType}"  # e.g., "runtime"
  echo "Detected deployment type: $DEPLOYMENT_TYPE"
  
  # CREATE BASED ON TYPE
  if [[ "$DEPLOYMENT_TYPE" == "runtime" ]]; then
    echo "Creating RUNTIME-BASED web app..."
    RUNTIME="\${resource.webAppConfig.deploymentDetails.runtime}"  # e.g., "NODE:22-lts"
    echo "Using runtime: $RUNTIME"
    
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --runtime "$RUNTIME"
    
  elif [[ "$DEPLOYMENT_TYPE" == "single-container" ]]; then
    echo "Creating SINGLE-CONTAINER web app..."
    CONTAINER_IMAGE="\${resource.webAppConfig.deploymentDetails.containerImage}"
    echo "Using container image: $CONTAINER_IMAGE"
    
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --deployment-container-image-name "$CONTAINER_IMAGE"
    
  elif [[ "$DEPLOYMENT_TYPE" == "multi-container-compose" ]]; then
    echo "Creating MULTI-CONTAINER web app..."
    
    # Export compose file from source
    az webapp config container show \\
      --name "\${resource.name}" \\
      --resource-group "\${SOURCE_RG}" \\
      --query "dockerComposeFile" -o tsv > docker-compose.yml
    
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME" \\
      --multicontainer-config-type compose \\
      --multicontainer-config-file docker-compose.yml
    
  else
    echo "Creating BASIC web app (unknown type)..."
    az webapp create \\
      --name "$WEB_APP_NAME" \\
      --resource-group "$TARGET_RG" \\
      --plan "$APP_PLAN_NAME"
    
    echo "⚠️ Runtime must be configured manually in Azure Portal"
  fi
  
  # Verify creation
  if az webapp show --name "$WEB_APP_NAME" --resource-group "$TARGET_RG" &>/dev/null; then
    echo "✅ Web app created successfully!"
  else
    echo "❌ Web app creation failed!"
    exit 1
  fi
  \`\`\`
  
  # Verify creation
  if az webapp show --name "$WEB_APP_NAME" --resource-group "$TARGET_RG" &>/dev/null; then
    echo "✓ SUCCESS: Web App shell created and verified!"
    echo "URL: https://\${WEB_APP_NAME}.azurewebsites.net"
    echo "Status: Empty shell (runtime NOT configured yet)"
  else
    echo "⚠️ WARNING: Web App creation may have failed. Check Azure Portal."
  fi
  
  WHY THIS RESTRICTIVE APPROACH:
  - Azure CLI has a BUG: mixing --runtime with other flags causes "multicontainer" error
  - Even specifying JUST --runtime can cause conflicts
  - The ONLY reliable way is: create basic shell (3 params only) + configure in Portal
  - This works 100% of the time with NO errors
  - Trying to be "smart" and clone runtime via CLI = guaranteed failure

2. LONG-RUNNING OPERATIONS - USE --no-wait (EXCEPT WEB APPS!)
   ⚠️  These operations can take 5-60 minutes:
   - az webapp create (5-10 minutes) ← DO NOT USE --no-wait (not supported!)
   - az sql db create or copy (10-60 minutes) ← USE --no-wait!
   - az vm create (5-10 minutes) ← USE --no-wait!
   - az container create (2-5 minutes) ← USE --no-wait!
   
   PATTERN FOR ALL LONG OPERATIONS:
   # Start async with --no-wait
   az <command> --no-wait
   
   # Brief wait for initial provisioning
   sleep 10-30
   
   # Verify resource exists (not necessarily ready)
   az <resource> show --name X --resource-group Y
   
   # Report success (deployment continues in background)
   echo "✓ Resource created (initialization continues in background)"
   
   # Verify after completion
   if az webapp show --name <name> --resource-group <rg> &> /dev/null; then
     echo "SUCCESS: Web App created and ready!"
   else
     echo "WARNING: Web App creation may still be in progress. Check Azure Portal."
   fi
   
   BENEFITS:
   - Script doesn't hang for minutes
   - User sees progress messages
   - Multiple resources can be created in parallel
   - Script won't timeout
   
2. ⚠️⚠️⚠️ WEB APPS - ABSOLUTE MINIMAL PARAMETERS ONLY (CRITICAL!) ⚠️⚠️⚠️
   
   🚨🚨🚨 MANDATORY - NO EXCEPTIONS - WILL FAIL OTHERWISE 🚨🚨🚨
   
   YOU **MUST** USE EXACTLY 3 PARAMETERS AND **ABSOLUTELY NOTHING ELSE**:
   ✅ --name
   ✅ --resource-group  
   ✅ --plan
   
   🚨 ABSOLUTELY FORBIDDEN (WILL CAUSE "multicontainer" ERROR):
   ❌ --no-wait (NOT SUPPORTED!)
   ❌ --runtime (FORBIDDEN for zip-static — runtime apps use NODE:22-lts style from discovery)
   ❌ --container-image-name (FORBIDDEN!)
   ❌ --multicontainer-config-type (FORBIDDEN!)
   ❌ --multicontainer-config-file (FORBIDDEN!)
   ❌ --deployment-local-git (FORBIDDEN!)
   ❌ --vnet-route-all-enabled (FORBIDDEN!)
   ❌ --docker-* (ALL docker flags FORBIDDEN!)
   ❌ --deployment-* (ALL deployment flags FORBIDDEN!)
   ❌ --site-containers-app (FORBIDDEN!)
   ❌ --https-only (FORBIDDEN!)
   ❌ ANY OTHER PARAMETER!
   
   🚨 DO NOT TRY TO CLONE THE ORIGINAL RUNTIME VIA CLI!
   - Original uses Node.js 22? → DON'T specify --runtime!
   - Original uses Python 3.11? → DON'T specify --runtime!
   - Original uses container? → DON'T specify --container-*!
   - The CLI WILL FAIL if you try to specify runtime!
   
   🚨 THE ONLY VALID COMMAND:
   az webapp create --name X --resource-group Y --plan Z
   
   NOTHING MORE! NO OTHER FLAGS! PERIOD!
   
   REASON: Azure CLI has a BUG where specifying --runtime or --container-* 
           or --deployment-* causes "multicontainer" parameter conflict error
   
   SOLUTION: Create basic empty shell (3 params ONLY) + user configures runtime in Portal
   
   WHAT USER DOES AFTER (TAKES 2 MINUTES):
   1. Go to Azure Portal
   2. Find Web App → Configuration → Stack settings
   3. Choose runtime (Node.js 22, Python 3.11, etc.)
   4. Click Save
   5. Done - runtime configured without CLI bugs!
   
3. ALWAYS CREATE ACTUAL WEB APPS (App Service), not just App Service Plans
   - Use "az webapp create" to create the ACTUAL app (Microsoft.Web/sites)
   - App Service Plan alone is NOT sufficient - you MUST also create the Web App itself
   - Verify creation with "az webapp show" after creation
   
4. PREFERRED REGIONS (Avoid East US - has restrictions)
   - ✅ RECOMMENDED: "West US", "West US 2", "Central US", "North Europe", "West Europe"
   - ⚠️ AVOID: "East US" (SQL Database restrictions, quota limits)
   - If source is in East US, clone to West US or West US 2 instead
   - This prevents "Region does not allow provisioning" errors
   
4. DATABASE COPY: Complete setup with credentials, firewall, and testing
   - Database copy is async (--no-wait) and takes 10-30+ minutes
   - Script completes quickly, copy continues in background
   - SQL Server names MUST be globally unique with random suffix
   - CRITICAL: Display SQL credentials prominently (username, password, connection string)
   - CRITICAL: Copy ALL firewall rules from source SQL Server (not just Azure services)
   - CRITICAL: Test database connectivity after creation (Azure API check, optional sqlcmd)
   - CRITICAL: Provide connection details for manual testing (Azure Data Studio, SSMS)
   
5. Resource names MUST be UNIQUE with LARGE random suffixes
   - Storage: agenticstorageac → agenticstorageac8472
   - Web apps: agentic-web → agentic-web-5839
   - SQL Servers: demoai → demoai47295 (NOT demoai-clone!)
   - Use $RANDOM to generate 4-6 digit suffixes
   
6. Azure CLI syntax MUST be VALID (no deprecated/unrecognized arguments)
   - Use MINIMAL parameters only
   - More parameters = more errors
   - If unsure, use fewer parameters
   
7. The script MUST actually CREATE resources, not just check if they exist

8. QUOTA HANDLING - Try multiple SKUs with graceful fallback
   - CRITICAL: Even FREE tier (F1) may require quota in some subscriptions!
   - Strategy: Try F1 → If fails, try B1 → If fails, try P1v2 → If all fail, skip gracefully
   - App Service Plans: Attempt F1 (Free), then B1 (Basic), then P1v2 (Premium)
   - NEVER exit script if quota exceeded - continue with other resources
   - Provide clear guidance to user on how to resolve quota issues
   - Web Apps can ONLY be created if plan exists - verify before creating

Example logic for each resource (STORAGE ACCOUNT):
# Generate UNIQUE name with random suffix for cloned storage account
RANDOM_SUFFIX=\$RANDOM
STORAGE_CLONE="agenticstorageac\${RANDOM_SUFFIX}"

# Ensure name length is within 24 chars (Azure limit for storage accounts)
if [ \${#STORAGE_CLONE} -gt 24 ]; then
  STORAGE_CLONE=\${STORAGE_CLONE:0:24}
fi

echo "Generated unique storage account name: \$STORAGE_CLONE"

# Check if resource exists in TARGET
if ! az storage account show --name "$STORAGE_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
  echo "Creating storage account \$STORAGE_CLONE in \$TARGET_RG..."
  
  # Create with MINIMAL parameters only
  if az storage account create \
    --name "$STORAGE_CLONE" \
    --resource-group "$TARGET_RG" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2; then
    
    # Verify it was actually created
    if az storage account show --name "$STORAGE_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
      echo "SUCCESS: Storage account \$STORAGE_CLONE created and verified successfully."
    else
      echo "ERROR: Storage account creation reported success but resource not found!"
      exit 1
    fi
  else
    echo "ERROR: Failed to create storage account \$STORAGE_CLONE"
    exit 1
  fi
else
  echo "Storage account \$STORAGE_CLONE already exists, skipping."
fi

Example logic for APP SERVICE PLAN (handle quota limitations gracefully):
# CRITICAL: Even Free tier (F1) may require quota in some subscriptions
# Strategy: Try multiple approaches, skip if all fail

APP_PLAN_RANDOM=\$RANDOM
APP_PLAN_CLONE="plan\${APP_PLAN_RANDOM}"
APP_PLAN_CREATED=false

# 🚨🚨🚨 CRITICAL: Read platform from discovered webAppConfig 🚨🚨🚨
# YOU MUST extract this from the RESOURCES TO CLONE JSON section above!
# LOOK FOR: web app resource → "webAppConfig" object → "platform" and "isLinux" fields
# 
# EXAMPLE from discovered resources:
# {
#   "name": "hello-world-static-1763324087",
#   "type": "Microsoft.Web/sites",
#   "webAppConfig": {
#     "deploymentType": "zip-static",
#     "platform": "windows",      ← GET THIS VALUE!
#     "isLinux": false             ← GET THIS VALUE!
#   }
# }

PLATFORM="<GET FROM webAppConfig.platform>"  # MUST be extracted from JSON above
IS_LINUX="<GET FROM webAppConfig.isLinux>"    # MUST be extracted from JSON above

echo "================================================"
echo "ATTEMPTING TO CREATE APP SERVICE PLAN: \$APP_PLAN_CLONE"
echo "Platform detected from webAppConfig: \$PLATFORM"
echo "Is Linux: \$IS_LINUX"
echo "This subscription may have quota limitations..."
echo "================================================"

# Build the --is-linux flag conditionally based on detected platform
LINUX_FLAG=""
if [[ "\$PLATFORM" == "linux" ]] || [[ "\$IS_LINUX" == "true" ]]; then
  LINUX_FLAG="--is-linux"
  echo "✓ Creating LINUX App Service Plan (with --is-linux flag)"
else
  echo "✓ Creating WINDOWS App Service Plan (NO --is-linux flag)"
fi

# 🚨 CRITICAL: Handle location support for App Service Plans
# Some locations may not support App Service Plans - use fallback locations
PLAN_LOCATION="$LOCATION"
FALLBACK_LOCATIONS=("eastus" "westus" "westus2" "centralus" "southcentralus" "northcentralus")

# Function to try creating plan in a location
try_create_plan() {
  local loc=$1
  local sku=$2
  echo "  Trying location: $loc, SKU: $sku..."
if az appservice plan create \
  --name "$APP_PLAN_CLONE" \
  --resource-group "$TARGET_RG" \
    --location "$loc" \
    --sku "$sku" \
    \$LINUX_FLAG 2>&1 | tee /tmp/plan-create.log; then
    PLAN_LOCATION="$loc"
    return 0
  else
    # Check if error is location-related
    if grep -qi "unsupported location\|location.*not.*support\|not available in this location" /tmp/plan-create.log 2>/dev/null; then
      echo "  ⚠️  Location $loc does not support App Service Plans"
      return 1
    fi
    return 1
  fi
}

# Attempt 1: Try Free tier (F1) in target location
echo "Attempt 1: Trying Free tier (F1) in $PLAN_LOCATION..."
if try_create_plan "$PLAN_LOCATION" "F1"; then
  APP_PLAN_CREATED=true
  echo "✓ SUCCESS: App Service Plan created with Free tier (F1) in $PLAN_LOCATION"
fi

# Attempt 2: If target location failed, try fallback locations with F1
if [ "$APP_PLAN_CREATED" = false ]; then
  echo "Attempt 2: Target location failed, trying fallback locations with Free tier (F1)..."
  for fallback_loc in "\${FALLBACK_LOCATIONS[@]}"; do
    if [ "$fallback_loc" != "$PLAN_LOCATION" ]; then
      if try_create_plan "$fallback_loc" "F1"; then
        APP_PLAN_CREATED=true
        echo "✓ SUCCESS: App Service Plan created with Free tier (F1) in $fallback_loc (fallback location)"
        break
      fi
    fi
  done
fi

# Attempt 3: If Free failed, try Basic tier (B1) in target location
if [ "$APP_PLAN_CREATED" = false ]; then
  echo "Attempt 3: Free tier failed, trying Basic tier (B1) in $PLAN_LOCATION..."
  if try_create_plan "$PLAN_LOCATION" "B1"; then
    APP_PLAN_CREATED=true
    echo "✓ SUCCESS: App Service Plan created with Basic tier (B1) in $PLAN_LOCATION"
  fi
fi

# Attempt 4: If Basic failed in target location, try fallback locations with B1
if [ "$APP_PLAN_CREATED" = false ]; then
  echo "Attempt 4: Basic tier failed in target location, trying fallback locations with Basic tier (B1)..."
  for fallback_loc in "\${FALLBACK_LOCATIONS[@]}"; do
    if [ "$fallback_loc" != "$PLAN_LOCATION" ]; then
      if try_create_plan "$fallback_loc" "B1"; then
        APP_PLAN_CREATED=true
        echo "✓ SUCCESS: App Service Plan created with Basic tier (B1) in $fallback_loc (fallback location)"
        break
      fi
    fi
  done
fi

# Attempt 5: If Basic failed, try Premium tier (P1v2) - has separate quota
if [ "$APP_PLAN_CREATED" = false ]; then
  echo "Attempt 5: Basic tier failed, trying Premium tier (P1v2) in $PLAN_LOCATION..."
  if try_create_plan "$PLAN_LOCATION" "P1v2"; then
    APP_PLAN_CREATED=true
    echo "✓ SUCCESS: App Service Plan created with Premium tier (P1v2) in $PLAN_LOCATION"
    echo "⚠️  WARNING: Premium tier will incur significant costs!"
  fi
fi

# If all attempts failed, provide clear guidance
if [ "$APP_PLAN_CREATED" = false ]; then
  echo "================================================"
  echo "❌ UNABLE TO CREATE APP SERVICE PLAN"
  echo "================================================"
  echo "REASON: App Service Plan creation failed in all attempted locations"
  echo "  Target location: $PLAN_LOCATION"
  echo "  Fallback locations tried: \${FALLBACK_LOCATIONS[*]}"
  echo ""
  echo "POSSIBLE CAUSES:"
  echo "1. Location does not support App Service Plans"
  echo "2. Your Azure subscription has 0 quota for:"
  echo "   - Free VMs (F1 tier)"
  echo "   - Basic VMs (B1 tier)"
  echo "   - Premium VMs (P1v2 tier)"
  echo ""
  echo "SOLUTIONS:"
  echo "1. Try a different target location that supports App Service Plans"
  echo "2. Request quota increase in Azure Portal:"
  echo "   Portal → Quotas → Request Increase → App Service Plan"
  echo "3. Use a different Azure subscription with available quota"
  echo "4. Delete unused App Service Plans to free up quota"
  echo ""
  echo "SKIPPING: Web App creation (cannot proceed without plan)"
  echo "CONTINUING: Other resources (SQL Server, Database, etc.) will still be cloned"
  echo "================================================"
  # Don't exit - continue with other resources
else
  echo "================================================"
  echo "✓ App Service Plan successfully created!"
  echo "Plan Name: \$APP_PLAN_CLONE"
  echo "================================================"
fi

Example logic for WEB APP:
# CRITICAL: Only create web app if the App Service Plan exists
# Check if plan was created successfully in previous step

if [ "$APP_PLAN_CREATED" = false ]; then
  echo "================================================"
  echo "⚠️  SKIPPING WEB APP CREATION"
  echo "================================================"
  echo "REASON: App Service Plan creation failed (quota limitations)"
  echo "Cannot create Web App without an App Service Plan"
  echo ""
  echo "TO RESOLVE:"
  echo "1. Request quota increase in Azure Portal"
  echo "2. Use a different Azure subscription with available quota"
  echo "3. Delete unused App Service Plans to free up quota"
  echo "================================================"
else
  # Plan exists, proceed with web app creation
  
  # Generate UNIQUE name with random suffix for cloned web app
  WEBAPP_RANDOM=\$RANDOM
  WEBAPP_CLONE="agentic-web-\${WEBAPP_RANDOM}"
  
  echo "Generated unique web app name: \$WEBAPP_CLONE"
  
  # Verify plan exists before creating web app
  if ! az appservice plan show --name "$APP_PLAN_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
    echo "================================================"
    echo "❌ ERROR: App Service Plan \$APP_PLAN_CLONE not found!"
    echo "Cannot create web app without plan. Skipping..."
    echo "================================================"
  else
    # CRITICAL: Generate GLOBALLY UNIQUE web app name (prevents CLI hanging!)
    echo "================================================"
    echo "Generating unique web app name..."
    echo "================================================"
    
    # Generate unique name with $RANDOM
    WEBAPP_CLONE="agentic-web-$RANDOM"
    echo "Generated name: $WEBAPP_CLONE"
    
    # PRE-VALIDATION: Check if name is available (PREVENTS HANGING!)
    echo "Validating web app name availability..."
    NAME_CHECK=$(az webapp list --query "[?name=='$WEBAPP_CLONE'].name" -o tsv 2>/dev/null || echo "")
    
    if [[ -n "$NAME_CHECK" ]]; then
      echo "⚠️  Name already exists. Regenerating with timestamp..."
      WEBAPP_CLONE="agentic-web-$(date +%s)"
      echo "New unique name: $WEBAPP_CLONE"
    fi
    
    echo "✓ Web app name is globally unique: $WEBAPP_CLONE"
    
    # Create web app with CORRECT runtime format and --no-wait
    echo "================================================"
    echo "Creating Web App: $WEBAPP_CLONE"
    echo "This will run in background (ETA: 5-10 minutes)"
    echo "================================================"
    
    # IMPORTANT:
    # 1. MUST use --no-wait to avoid timeout
    # 2. MUST use runtime from az webapp list-runtimes --os-type linux (e.g. NODE:20-lts)
    # 3. Use --deployment-local-git for simple deployment
    az webapp create \
      --name "$WEBAPP_CLONE" \
      --resource-group "$TARGET_RG" \
      --plan "$APP_PLAN_CLONE" \
      --runtime "NODE:20-lts" \
      --deployment-local-git \
      --no-wait
    
    echo "Web App deployment initiated (running in background)..."
    echo "Waiting 15 seconds for initial provisioning..."
    sleep 15
    
    # Verify web app exists (may not be fully ready yet)
    if az webapp show --name "$WEBAPP_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
      echo "✓ SUCCESS: Web App created successfully!"
      echo "Deployment Status: $(az webapp show --name "$WEBAPP_CLONE" --resource-group "$TARGET_RG" --query "state" -o tsv)"
      echo "URL: https://\${WEBAPP_CLONE}.azurewebsites.net"
      echo "Note: App will be fully ready in 5-10 minutes"
    else
      echo "⚠️  Web App creation started but not yet visible"
      echo "This is normal - check Azure Portal in 5-10 minutes"
    fi
    echo "================================================"
    
    # Check if web app already exists (for idempotency)
    if ! az webapp show --name "$WEBAPP_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
      echo "================================================"
      echo "CREATING WEB APP: \$WEBAPP_CLONE"
      echo "Plan: \$APP_PLAN_CLONE"
      echo "================================================"
      
      # CRITICAL: Use ABSOLUTE MINIMAL PARAMETERS (DO NOT ADD ANYTHING ELSE!)
      # The command below is THE ONLY CORRECT FORMAT:
      # az webapp create --name NAME --resource-group RG --plan PLAN
      # 
      # ❌ FORBIDDEN PARAMETERS (WILL CAUSE ERRORS):
      # --runtime, --container-image-name, --multicontainer-config-type,
      # --multicontainer-config-file, --deployment-container-image-name,
      # --docker-registry-server-password, --docker-registry-server-user,
      # --vnet-route-all-enabled, --site-containers-app, ANY VERSION FLAGS
      # 
      # ✅ ALLOWED PARAMETERS (ONLY THESE 3):
      # --name (web app name)
      # --resource-group (target RG)
      # --plan (app service plan name)
      
      if az webapp create \
        --name "$WEBAPP_CLONE" \
        --resource-group "$TARGET_RG" \
        --plan "$APP_PLAN_CLONE"; then
    
    # CRITICAL: Verify the App Service (not just plan) was created
    sleep 3  # Brief wait for Azure to propagate
    if az webapp show --name "$WEBAPP_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
      echo "================================================"
      echo "✓ SUCCESS: Web App \$WEBAPP_CLONE is ONLINE!"
      echo "URL: https://\${WEBAPP_CLONE}.azurewebsites.net"
      echo "================================================"
      echo "⚠️  MANUAL CONFIGURATION REQUIRED:"
      echo "1. Go to Azure Portal: https://portal.azure.com"
      echo "2. Navigate to Web App: \$WEBAPP_CLONE"
      echo "3. Configuration → General Settings → Set runtime stack"
      echo "   (Python, Node.js, .NET, Java, PHP, etc.)"
      echo "4. Deployment Center → Set deployment source"
      echo "   (GitHub, Azure Repos, Local Git, etc.)"
      echo "5. Configuration → Application Settings → Add app settings"
      echo "================================================"
      echo "NOTE: Web app infrastructure is cloned, but runtime/deployment"
      echo "      must be configured manually to match source app."
      echo "================================================"
    else
      echo "================================================"
      echo "⚠️  WARNING: Web app creation returned success but verification failed"
      echo "Check Azure Portal: https://portal.azure.com"
      echo "================================================"
    fi
  else
    echo "================================================"
    echo "❌ ERROR: Failed to create web app \$WEBAPP_CLONE"
    echo "Possible reasons:"
    echo "  - App name not globally unique (try different name)"
    echo "  - App Service Plan not in correct region"
    echo "  - Quota limits reached"
    echo "================================================"
    echo "MANUAL ACTION REQUIRED:"
    echo "Create manually in Azure Portal: https://portal.azure.com"
        echo "================================================"
        # DO NOT exit - continue with other resources
        echo "Continuing with other resources..."
      fi
    else
      echo "Web app \$WEBAPP_CLONE already exists, skipping."
    fi
  fi
fi

Example logic for SQL SERVER + DATABASE (COMPLETE DATA MIGRATION):
# Generate TRULY UNIQUE SQL Server name with large random suffix
SQL_SERVER_RANDOM=\$(date +%s | tail -c 6)\$RANDOM
SQL_SERVER_CLONE="sqlserver\${SQL_SERVER_RANDOM}"
SQL_DB_CLONE="database\${SQL_SERVER_RANDOM}"
SQL_ADMIN_PASSWORD="P@ssw0rd\${RANDOM}\$(date +%s)"

# CRITICAL: Use West US or West US 2 (NOT East US - has restrictions)
SQL_LOCATION="westus"  # Reliable region for SQL Database

echo "Generated unique SQL Server name: \$SQL_SERVER_CLONE"
echo "Using location: \$SQL_LOCATION (avoiding East US restrictions)"

# Step 1: Create SQL Server
if ! az sql server show --name "$SQL_SERVER_CLONE" --resource-group "$TARGET_RG" &>/dev/null 2>&1; then
  echo "Creating SQL Server \$SQL_SERVER_CLONE in \$SQL_LOCATION..."
  
  if az sql server create \
    --name "$SQL_SERVER_CLONE" \
    --resource-group "$TARGET_RG" \
    --location "$SQL_LOCATION" \
    --admin-user sqladmin \
    --admin-password "$SQL_ADMIN_PASSWORD"; then
    
    echo "SUCCESS: SQL Server \$SQL_SERVER_CLONE created."
    echo "================================================"
    echo "🔐 DATABASE CREDENTIALS (SAVE IMMEDIATELY!)"
    echo "================================================"
    echo "Server: \${SQL_SERVER_CLONE}.database.windows.net"
    echo "Admin Username: sqladmin"
    echo "Admin Password: \$SQL_ADMIN_PASSWORD"
    echo ""
    echo "Connection String (SQL Authentication):"
    echo "Server=\${SQL_SERVER_CLONE}.database.windows.net,1433;"
    echo "Database=\${SQL_DB_CLONE};"
    echo "User Id=sqladmin;"
    echo "Password=\${SQL_ADMIN_PASSWORD};"
    echo "Encrypt=true;"
    echo "TrustServerCertificate=false;"
    echo "================================================"
    
    # Step 2: Copy firewall rules from source SQL Server
    echo "================================================"
    echo "COPYING FIREWALL RULES FROM SOURCE SQL SERVER"
    echo "Source: \$SOURCE_SQL_SERVER"
    echo "Target: \$SQL_SERVER_CLONE"
    echo "================================================"
    
    # First, allow Azure services (required for database copy)
    echo "Creating firewall rule: AllowAzureServices..."
    az sql server firewall-rule create \
      --resource-group "$TARGET_RG" \
      --server "$SQL_SERVER_CLONE" \
      --name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0 2>&1 || echo "Note: AllowAzureServices rule may already exist"
    
    # Copy all firewall rules from source SQL Server
    echo "Retrieving firewall rules from source SQL Server..."
    SOURCE_FIREWALL_RULES=\$(az sql server firewall-rule list \
      --resource-group "$SOURCE_RG" \
      --server "$SOURCE_SQL_SERVER" \
      --query "[].{name:name, start:startIpAddress, end:endIpAddress}" \
      -o json 2>/dev/null)
    
    if [ -n "$SOURCE_FIREWALL_RULES" ] && [ "$SOURCE_FIREWALL_RULES" != "[]" ]; then
      echo "Found firewall rules in source server. Copying..."
      
      # Parse and create each firewall rule
      echo "$SOURCE_FIREWALL_RULES" | jq -c '.[]' | while read -r rule; do
        RULE_NAME=\$(echo "$rule" | jq -r '.name')
        RULE_START=\$(echo "$rule" | jq -r '.start')
        RULE_END=\$(echo "$rule" | jq -r '.end')
        
        # Skip if it's the AllowAzureServices rule (already created)
        if [ "$RULE_NAME" != "AllowAzureServices" ]; then
          echo "Creating firewall rule: \$RULE_NAME (\$RULE_START - \$RULE_END)"
          az sql server firewall-rule create \
            --resource-group "$TARGET_RG" \
            --server "$SQL_SERVER_CLONE" \
            --name "$RULE_NAME" \
            --start-ip-address "$RULE_START" \
            --end-ip-address "$RULE_END" 2>&1 || echo "Note: Rule \$RULE_NAME may already exist"
        fi
      done
      
      echo "✓ Firewall rules copied successfully!"
    else
      echo "No additional firewall rules found in source server."
      echo "Only AllowAzureServices rule is configured."
    fi
    
    echo "================================================"
    echo "FIREWALL CONFIGURATION SUMMARY"
    echo "================================================"
    az sql server firewall-rule list \
      --resource-group "$TARGET_RG" \
      --server "$SQL_SERVER_CLONE" \
      --query "[].{Name:name, StartIP:startIpAddress, EndIP:endIpAddress}" \
      -o table
    echo "================================================"
    
    # Step 3: Copy database with ALL DATA (LONG-RUNNING OPERATION)
    echo "==============================================="
    echo "STARTING DATABASE COPY - THIS WILL TAKE 10-30+ MINUTES"
    echo "Source: \$SOURCE_SQL_SERVER/\$SOURCE_DB_NAME"
    echo "Target: \$SQL_SERVER_CLONE/\$SQL_DB_CLONE"
    echo "================================================"
    echo "Progress: Starting copy operation..."
    
    # Start the copy (this is ASYNC - Azure starts the job and returns immediately)
    if az sql db copy \
      --dest-name "$SQL_DB_CLONE" \
      --dest-resource-group "$TARGET_RG" \
      --dest-server "$SQL_SERVER_CLONE" \
      --name "$SOURCE_DB_NAME" \
      --resource-group "$SOURCE_RG" \
      --server "$SOURCE_SQL_SERVER" \
      --no-wait; then
      
      echo "✓ Database copy job started successfully!"
      echo "================================================"
      echo "NOTE: Database copy is running in the background."
      echo "This can take 10-30+ minutes depending on database size."
      echo "Check Azure Portal for progress: https://portal.azure.com"
      echo "Database: \$SQL_SERVER_CLONE/\$SQL_DB_CLONE"
      echo "================================================"
      
      # Wait for database to be accessible (initial creation completes quickly)
      echo "Waiting for database to become accessible..."
      sleep 10
      
      # Quick check if database is being created
      DB_STATUS=\$(az sql db show \
        --name "$SQL_DB_CLONE" \
        --resource-group "$TARGET_RG" \
        --server "$SQL_SERVER_CLONE" \
        --query "status" -o tsv 2>/dev/null || echo "Creating")
      
      echo "Current database status: \$DB_STATUS"
      
      if [ "$DB_STATUS" = "Online" ] || [ "$DB_STATUS" = "Creating" ]; then
        echo "================================================"
        echo "🧪 TESTING DATABASE CONNECTIVITY"
        echo "================================================"
        echo "Server: \${SQL_SERVER_CLONE}.database.windows.net"
        echo "Database: \$SQL_DB_CLONE"
        echo "Authentication: SQL Authentication (sqladmin)"
        echo ""
        
        # Test 1: Check if database exists and is accessible
        echo "Test 1: Verifying database accessibility..."
        if az sql db show \
          --name "$SQL_DB_CLONE" \
          --resource-group "$TARGET_RG" \
          --server "$SQL_SERVER_CLONE" &>/dev/null 2>&1; then
          echo "✓ Database is accessible via Azure API"
        else
          echo "⚠️  Database not yet accessible via Azure API (may still be initializing)"
        fi
        
        # Test 2: Get database details
        echo ""
        echo "Test 2: Retrieving database details..."
        az sql db show \
          --name "$SQL_DB_CLONE" \
          --resource-group "$TARGET_RG" \
          --server "$SQL_SERVER_CLONE" \
          --query "{Name:name, Status:status, Edition:edition, ServiceObjective:currentServiceObjectiveName, Location:location}" \
          -o table 2>&1 || echo "⚠️  Could not retrieve database details"
        
        # Test 3: List tables (requires sqlcmd - optional)
        echo ""
        echo "Test 3: SQL Connection Test"
        if command -v sqlcmd &>/dev/null; then
          echo "Attempting to connect with sqlcmd..."
          # Note: This requires the database to be fully online
          sqlcmd -S "\${SQL_SERVER_CLONE}.database.windows.net" \
            -d "\$SQL_DB_CLONE" \
            -U sqladmin \
            -P "\$SQL_ADMIN_PASSWORD" \
            -Q "SELECT @@VERSION as 'SQL Server Version', DB_NAME() as 'Database Name', GETDATE() as 'Current Time';" 2>&1 && \
            echo "✓ SQL connection successful!" || \
            echo "⚠️  SQL connection failed (database may still be copying data)"
        else
          echo "⚠️  sqlcmd not installed, skipping direct SQL connection test"
          echo "You can test manually using:"
          echo "  - Azure Data Studio"
          echo "  - SQL Server Management Studio (SSMS)"
          echo "  - Any SQL client with these credentials"
        fi
        
        echo "================================================"
        echo "📝 CONNECTION DETAILS FOR MANUAL TESTING"
        echo "================================================"
        echo "Server: \${SQL_SERVER_CLONE}.database.windows.net"
        echo "Port: 1433"
        echo "Database: \$SQL_DB_CLONE"
        echo "Authentication: SQL Server Authentication"
        echo "Username: sqladmin"
        echo "Password: \$SQL_ADMIN_PASSWORD"
        echo ""
        echo "Connection String:"
        echo "Server=\${SQL_SERVER_CLONE}.database.windows.net,1433;Database=\${SQL_DB_CLONE};User Id=sqladmin;Password=\${SQL_ADMIN_PASSWORD};Encrypt=true;"
        echo ""
        echo "Azure Data Studio / SSMS Connection:"
        echo "1. Open Azure Data Studio or SSMS"
        echo "2. New Connection → Server: \${SQL_SERVER_CLONE}.database.windows.net"
        echo "3. Authentication: SQL Login"
        echo "4. Username: sqladmin"
        echo "5. Password: [paste password above]"
        echo "6. Database: \$SQL_DB_CLONE"
        echo "7. Connect!"
        echo "================================================"
        echo ""
        echo "⏳ Note: Data copy is running in background (10-30+ min)"
        echo "   Database structure is available immediately"
        echo "   Full data will be available after copy completes"
        echo "   Monitor progress in Azure Portal: https://portal.azure.com"
        echo "================================================"
      else
        echo "⚠️  Database status: \$DB_STATUS"
        echo "Please check Azure Portal for database status"
      fi
      
    else
      echo "WARNING: Database copy command failed. Check Azure Portal for status."
    fi
  else
    echo "ERROR: Failed to create SQL Server \$SQL_SERVER_CLONE"
  fi
else
  echo "SQL Server \$SQL_SERVER_CLONE already exists, skipping."
fi`;

      console.log('🤖 Calling Azure OpenAI for script generation...');
      console.log(`User prompt length: ${userPrompt.length} characters`);
      console.log(`System prompt length: ${systemPrompt.length} characters`);
      
      // Check if web app exists in resources for post-processing
      const hasWebApp = resourceGroupData.resources?.some(r => r.type === 'Microsoft.Web/sites');
      console.log(`🔍 Web app detected in resources: ${hasWebApp}`);
      if (hasWebApp) {
        const webApp = resourceGroupData.resources.find(r => r.type === 'Microsoft.Web/sites');
        console.log(`   Web app name: ${webApp?.name || 'unknown'}`);
      }
      
      const response = await this.client.getChatCompletions(
        this.deploymentName,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.2,
          maxTokens: 8000,
          topP: 0.9
        }
      );
      
      let generatedScript = response.choices[0].message.content;
      console.log('✅ AI response received');
      console.log(`Generated script length: ${generatedScript.length} characters`);
      console.log(`First 200 chars: ${generatedScript.substring(0, 200)}`);
      
      // Post-process script to ensure SOURCE_WEBAPP_NAME and SOURCE_DB_NAME are defined
      console.log('🔧 Post-processing script to ensure required variables are defined...');
      try {
        generatedScript = this.fixSourceWebAppNameVariable(generatedScript, resourceGroupData);
        console.log('✅ Web app variable post-processing completed');
      } catch (postProcessError) {
        console.error('⚠️  Web app post-processing failed (non-fatal):', postProcessError.message);
        // Continue with original script - post-processing failure shouldn't break generation
      }
      
      try {
        generatedScript = this.fixSourceDbNameVariable(generatedScript, resourceGroupData);
        console.log('✅ Database variable post-processing completed');
      } catch (postProcessError) {
        console.error('⚠️  Database post-processing failed (non-fatal):', postProcessError.message);
        // Continue with original script - post-processing failure shouldn't break generation
      }
      
      // Check if web app was created but content deployment is missing (for zip-static apps)
      try {
        generatedScript = this.ensureZipStaticDeployment(generatedScript, resourceGroupData, targetResourceGroupName);
        console.log('✅ Zip-static deployment check completed');
      } catch (postProcessError) {
        console.error('⚠️  Zip-static deployment check failed (non-fatal):', postProcessError.message);
        // Continue with original script - post-processing failure shouldn't break generation
      }
      
      // Fix invalid parameters in az webapp create for zip-static apps
      try {
        generatedScript = this.fixWebAppCreateParameters(generatedScript, resourceGroupData);
        console.log('✅ Web app create parameters check completed');
      } catch (postProcessError) {
        console.error('⚠️  Web app parameters check failed (non-fatal):', postProcessError.message);
        // Continue with original script - post-processing failure shouldn't break generation
      }
      
      // Fix SQL server name issues (ensure SOURCE_SQL_SERVER is used correctly)
      try {
        generatedScript = this.fixSQLServerNameUsage(generatedScript, resourceGroupData);
        console.log('✅ SQL server name usage check completed');
      } catch (postProcessError) {
        console.error('⚠️  SQL server name check failed (non-fatal):', postProcessError.message);
        // Continue with original script - post-processing failure shouldn't break generation
      }
      
      return generatedScript;
    } catch (error) {
      console.error('❌ Azure CLI script generation failed:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error details:', error);
      
      // Check if it's a ReferenceError about SOURCE_WEBAPP_NAME or SOURCE_DB_NAME
      if (error.message && (error.message.includes('SOURCE_WEBAPP_NAME') || error.message.includes('SOURCE_DB_NAME'))) {
        const variableName = error.message.includes('SOURCE_DB_NAME') ? 'SOURCE_DB_NAME' : 'SOURCE_WEBAPP_NAME';
        console.error(`🚨 DETECTED: ${variableName} ReferenceError - this is a template literal issue!`);
        console.error(`   This means there is an unescaped \${${variableName}} in the prompt template.`);
        console.error('   Attempting to fix by ensuring proper escaping...');
        
        // Try to regenerate with a safer approach - wrap the entire prompt construction
        // This is a fallback if the error persists
        try {
          // If we can extract resource group data, try a simplified generation
          if (resourceGroupData && resourceGroupData.resources) {
            console.log('🔄 Attempting fallback script generation...');
            // The error is likely in prompt construction, so we'll let it throw
            // but provide a more helpful error message
            throw new Error(`Script generation failed due to template literal error. Please ensure all bash variables in prompts are properly escaped with backslashes (e.g., \\\${${variableName}}).`);
          }
        } catch (fallbackError) {
          // Re-throw with more context
          throw new Error(`Script generation failed: ${error.message}. This may be due to an unescaped template literal in the prompt. Please check the code for unescaped \${${variableName}} references.`);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Post-process generated script to ensure SOURCE_WEBAPP_NAME is defined
   * This fixes the issue where AI doesn't define the variable before using it
   */
  fixSourceWebAppNameVariable(script, resourceGroupData) {
    try {
    // Check if script uses SOURCE_WEBAPP_NAME
      const usesSourceWebAppName = /\$SOURCE_WEBAPP_NAME|\$\{SOURCE_WEBAPP_NAME\}|SOURCE_WEBAPP_NAME/.test(script);
    
    if (!usesSourceWebAppName) {
      // No web app operations, no fix needed
      return script;
    }
    
      // Check if SOURCE_WEBAPP_NAME is already defined (more flexible regex)
    const isDefined = /SOURCE_WEBAPP_NAME\s*=\s*["'][^"']+["']/.test(script);
    
    if (isDefined) {
      // Already defined, no fix needed
      console.log('✅ SOURCE_WEBAPP_NAME is already defined in script');
      return script;
    }
    
    // Find web app resource - try multiple possible type formats
    let webAppResource = resourceGroupData?.resources?.find(
      r => r.type === 'Microsoft.Web/sites' || r.type?.includes('Web/sites') || r.type?.includes('webapp')
    );
    
    // If not found, try to find it in validated resources if available
    if (!webAppResource && resourceGroupData?.validatedResources) {
      webAppResource = resourceGroupData.validatedResources.find(
        r => r.type === 'Microsoft.Web/sites' || r.type?.includes('Web/sites') || r.type?.includes('webapp')
      );
    }
    
    // Find App Service Plan resource
    let planResource = resourceGroupData?.resources?.find(
      r => r.type === 'Microsoft.Web/serverfarms' || r.type?.includes('serverfarms')
    );
    
    // If not found, try validated resources
    if (!planResource && resourceGroupData?.validatedResources) {
      planResource = resourceGroupData.validatedResources.find(
        r => r.type === 'Microsoft.Web/serverfarms' || r.type?.includes('serverfarms')
    );
    }
    
    if (!webAppResource || !webAppResource.name) {
      console.log('⚠️  No web app found in resources, but script uses SOURCE_WEBAPP_NAME');
      // Even if web app not found, if script uses it, we should add a placeholder
      // This prevents the script from failing at runtime
      let placeholderBlock = `\n\n# CRITICAL: SOURCE_WEBAPP_NAME must be set manually if web app exists\n# SOURCE_WEBAPP_NAME="<web-app-name-from-resources>"\n# TARGET_WEBAPP_NAME="\${SOURCE_WEBAPP_NAME}-$RANDOM"\n`;
      
      // Also add PLAN_NAME placeholder if plan is found
      if (planResource && planResource.name) {
        placeholderBlock += `PLAN_NAME="${planResource.name}"\n`;
      } else {
        placeholderBlock += `# PLAN_NAME="<app-service-plan-name-from-resources>"\n`;
      }
      
      // Find insertion point
      const sourceRgMatch = script.match(/SOURCE_RG\s*=\s*["'][^"']+["']/);
      const targetRgMatch = script.match(/TARGET_RG\s*=\s*["'][^"']+["']/);
      const locationMatch = script.match(/LOCATION\s*=\s*["'][^"']+["']/);
      
      let insertionPoint = 0;
      if (sourceRgMatch) {
        insertionPoint = sourceRgMatch.index + sourceRgMatch[0].length;
      } else if (targetRgMatch) {
        insertionPoint = targetRgMatch.index + targetRgMatch[0].length;
      } else if (locationMatch) {
        insertionPoint = locationMatch.index + locationMatch[0].length;
      }
      
      const lineEnd = script.indexOf('\n', insertionPoint);
      const insertAfter = lineEnd !== -1 ? lineEnd : insertionPoint;
      
      return script.slice(0, insertAfter) + placeholderBlock + script.slice(insertAfter);
    }
    
    const sourceWebAppName = webAppResource.name;
    const planName = planResource?.name || '<plan-name-from-resources>';
    console.log(`🔧 Fixing script: Adding SOURCE_WEBAPP_NAME="${sourceWebAppName}" and PLAN_NAME="${planName}"`);
    
    // Find the Variables section (after #!/bin/bash and comments)
    const bashShebangMatch = script.match(/^#!/);
    
    let insertionPoint = 0;
    
    if (bashShebangMatch) {
      // Find first non-comment line after shebang
      const lines = script.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#')) {
          insertionPoint = script.indexOf(lines[i]);
          break;
        }
        if (line.startsWith('# Variables') || line.includes('SOURCE_RG')) {
          insertionPoint = script.indexOf(lines[i]);
          break;
        }
      }
    }
    
    // Find where SOURCE_RG, TARGET_RG, or LOCATION is defined
    const sourceRgMatch = script.match(/SOURCE_RG\s*=\s*["'][^"']+["']/);
    const targetRgMatch = script.match(/TARGET_RG\s*=\s*["'][^"']+["']/);
    const locationMatch = script.match(/LOCATION\s*=\s*["'][^"']+["']/);
    
    if (sourceRgMatch) {
      // Insert after SOURCE_RG definition
      insertionPoint = sourceRgMatch.index + sourceRgMatch[0].length;
    } else if (targetRgMatch) {
      // Insert after TARGET_RG definition
      insertionPoint = targetRgMatch.index + targetRgMatch[0].length;
    } else if (locationMatch) {
      // Insert after LOCATION definition
      insertionPoint = locationMatch.index + locationMatch[0].length;
    }
    
    // Find the end of the line to insert after
    const lineEnd = script.indexOf('\n', insertionPoint);
    const insertAfter = lineEnd !== -1 ? lineEnd : insertionPoint;
    
    // Build the variable definition block
    // Note: $RANDOM is bash variable, not JavaScript, so no escaping needed in template literal
    let variableBlock = `\n\n# CRITICAL: Extract SOURCE web app name and App Service Plan name from resources\nSOURCE_WEBAPP_NAME="${sourceWebAppName}"\nTARGET_WEBAPP_NAME="${sourceWebAppName}-$RANDOM"\n`;
    
    // Add PLAN_NAME if plan resource is found
    if (planResource && planResource.name) {
      variableBlock += `PLAN_NAME="${planResource.name}"\n`;
    } else {
      // Check if PLAN_NAME is already defined in script
      const planNameDefined = /PLAN_NAME\s*=\s*["'][^"']+["']/.test(script);
      if (!planNameDefined) {
        variableBlock += `# PLAN_NAME="<app-service-plan-name-from-resources>"  # Extract from Microsoft.Web/serverfarms resource\n`;
      }
    }
    
    // Insert the variable definition
    const fixedScript = script.slice(0, insertAfter) + variableBlock + script.slice(insertAfter);
    
    console.log('✅ Fixed script: Added SOURCE_WEBAPP_NAME, TARGET_WEBAPP_NAME, and PLAN_NAME definitions');
    
    return fixedScript;
    } catch (error) {
      console.error('⚠️  Error in fixSourceWebAppNameVariable:', error.message);
      // Return original script if fix fails - don't break generation
      return script;
    }
  }
  
  /**
   * Post-process generated script to ensure SOURCE_DB_NAME is defined
   * This fixes the issue where AI doesn't define the variable before using it
   */
  fixSourceDbNameVariable(script, resourceGroupData) {
    try {
      // Check if script uses SOURCE_DB_NAME
      const usesSourceDbName = /\$SOURCE_DB_NAME|\$\{SOURCE_DB_NAME\}|SOURCE_DB_NAME/.test(script);
      
      if (!usesSourceDbName) {
        // No database operations, no fix needed
        return script;
      }
      
      // Check if SOURCE_DB_NAME is already defined (more flexible regex)
      const isDefined = /SOURCE_DB_NAME\s*=\s*["'][^"']+["']/.test(script);
      
      if (isDefined) {
        // Already defined, no fix needed
        console.log('✅ SOURCE_DB_NAME is already defined in script');
        return script;
      }
      
      // Find database resource - try multiple possible type formats
      // Database resources can be: Microsoft.Sql/servers/databases or just contain "databases"
      let dbResource = resourceGroupData?.resources?.find(
        r => (r.type === 'Microsoft.Sql/servers/databases' || 
              r.type?.includes('Sql/servers/databases') || 
              r.type?.includes('databases')) &&
             r.name && 
             !r.name.includes('/master') && // Exclude master database
             r.name.includes('/') // Database name format: server/database
      );
      
      // If not found, try to find it in validated resources if available
      if (!dbResource && resourceGroupData?.validatedResources) {
        dbResource = resourceGroupData.validatedResources.find(
          r => (r.type === 'Microsoft.Sql/servers/databases' || 
                r.type?.includes('Sql/servers/databases') || 
                r.type?.includes('databases')) &&
               r.name && 
               !r.name.includes('/master') &&
               r.name.includes('/')
        );
      }
      
      // Extract database name from format "server/database"
      let sourceDbName = null;
      if (dbResource && dbResource.name) {
        // Database name format: "sqlserver-1236/sqldb-6179"
        // Extract the part after the last slash
        const parts = dbResource.name.split('/');
        if (parts.length > 1) {
          sourceDbName = parts[parts.length - 1];
        } else {
          sourceDbName = dbResource.name;
        }
      }
      
      if (!sourceDbName) {
        console.log('⚠️  No database found in resources, but script uses SOURCE_DB_NAME');
        // Even if database not found, if script uses it, we should add a placeholder
        const placeholderBlock = `\n\n# CRITICAL: SOURCE_DB_NAME must be set manually if database exists\n# SOURCE_DB_NAME="<database-name-from-resources>"\n# TARGET_DB_NAME="\${SOURCE_DB_NAME}-clone-$RANDOM"\n`;
        
        // Find insertion point
        const sourceRgMatch = script.match(/SOURCE_RG\s*=\s*["'][^"']+["']/);
        const targetRgMatch = script.match(/TARGET_RG\s*=\s*["'][^"']+["']/);
        const locationMatch = script.match(/LOCATION\s*=\s*["'][^"']+["']/);
        const sourceWebAppMatch = script.match(/SOURCE_WEBAPP_NAME\s*=\s*["'][^"']+["']/);
        
        let insertionPoint = 0;
        if (sourceWebAppMatch) {
          // Insert after SOURCE_WEBAPP_NAME if it exists
          insertionPoint = sourceWebAppMatch.index + sourceWebAppMatch[0].length;
        } else if (sourceRgMatch) {
          insertionPoint = sourceRgMatch.index + sourceRgMatch[0].length;
        } else if (targetRgMatch) {
          insertionPoint = targetRgMatch.index + targetRgMatch[0].length;
        } else if (locationMatch) {
          insertionPoint = locationMatch.index + locationMatch[0].length;
        }
        
        const lineEnd = script.indexOf('\n', insertionPoint);
        const insertAfter = lineEnd !== -1 ? lineEnd : insertionPoint;
        
        return script.slice(0, insertAfter) + placeholderBlock + script.slice(insertAfter);
      }
      
      console.log(`🔧 Fixing script: Adding SOURCE_DB_NAME="${sourceDbName}"`);
      
      // Find the Variables section (after #!/bin/bash and comments)
      const bashShebangMatch = script.match(/^#!/);
      
      let insertionPoint = 0;
      
      if (bashShebangMatch) {
        // Find first non-comment line after shebang
        const lines = script.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#')) {
            insertionPoint = script.indexOf(lines[i]);
            break;
          }
          if (line.startsWith('# Variables') || line.includes('SOURCE_RG') || line.includes('SOURCE_WEBAPP_NAME')) {
            insertionPoint = script.indexOf(lines[i]);
            break;
          }
        }
      }
      
      // Find where SOURCE_RG, TARGET_RG, LOCATION, or SOURCE_WEBAPP_NAME is defined
      const sourceRgMatch = script.match(/SOURCE_RG\s*=\s*["'][^"']+["']/);
      const targetRgMatch = script.match(/TARGET_RG\s*=\s*["'][^"']+["']/);
      const locationMatch = script.match(/LOCATION\s*=\s*["'][^"']+["']/);
      const sourceWebAppMatch = script.match(/SOURCE_WEBAPP_NAME\s*=\s*["'][^"']+["']/);
      
      if (sourceWebAppMatch) {
        // Insert after SOURCE_WEBAPP_NAME definition
        insertionPoint = sourceWebAppMatch.index + sourceWebAppMatch[0].length;
      } else if (sourceRgMatch) {
        // Insert after SOURCE_RG definition
        insertionPoint = sourceRgMatch.index + sourceRgMatch[0].length;
      } else if (targetRgMatch) {
        // Insert after TARGET_RG definition
        insertionPoint = targetRgMatch.index + targetRgMatch[0].length;
      } else if (locationMatch) {
        // Insert after LOCATION definition
        insertionPoint = locationMatch.index + locationMatch[0].length;
      }
      
      // Find the end of the line to insert after
      const lineEnd = script.indexOf('\n', insertionPoint);
      const insertAfter = lineEnd !== -1 ? lineEnd : insertionPoint;
      
      // Build the variable definition block
      const variableBlock = `\n\n# CRITICAL: Extract SOURCE database name from resources\nSOURCE_DB_NAME="${sourceDbName}"\nTARGET_DB_NAME="${sourceDbName}-clone-$RANDOM"\n`;
      
      // Insert the variable definition
      const fixedScript = script.slice(0, insertAfter) + variableBlock + script.slice(insertAfter);
      
      console.log('✅ Fixed script: Added SOURCE_DB_NAME and TARGET_DB_NAME definitions');
      
      return fixedScript;
    } catch (error) {
      console.error('⚠️  Error in fixSourceDbNameVariable:', error.message);
      // Return original script if fix fails - don't break generation
      return script;
    }
  }
  
  /**
   * Post-process script to ensure zip-static web apps include content deployment
   * This fixes the issue where AI creates web app but doesn't deploy content
   */
  ensureZipStaticDeployment(script, resourceGroupData, targetResourceGroupName) {
    try {
      // Check if script creates a web app
      const createsWebApp = /az webapp create/.test(script);
      
      if (!createsWebApp) {
        // No web app creation, no fix needed
        return script;
      }
      
      // Check if it's a zip-static web app
      const webAppResource = resourceGroupData?.resources?.find(
        r => r.type === 'Microsoft.Web/sites' || r.type?.includes('Web/sites')
      );
      
      if (!webAppResource || !webAppResource.webAppConfig) {
        return script; // Can't determine type, skip
      }
      
      const isZipStatic = webAppResource.webAppConfig.deploymentType === 'zip-static';
      
      if (!isZipStatic) {
        // Not a zip-static app, no fix needed
        return script;
      }
      
      // Check if content deployment steps are present
      const hasBasicAuth = /Enable Basic Auth|basicPublishingCredentialsPolicies|properties\.allow=true/.test(script);
      const hasDownload = /curl.*scm\.azurewebsites\.net.*zip|Download.*content|source\.zip/.test(script);
      const hasDeploy = /az webapp deployment source config-zip|deploy\.zip/.test(script);
      
      if (hasBasicAuth && hasDownload && hasDeploy) {
        // Deployment steps already present
        console.log('✅ Zip-static deployment steps already present in script');
        return script;
      }
      
      // Deployment steps are missing - inject them
      console.log('🔧 Detected zip-static web app without content deployment - injecting deployment steps...');
      
      const sourceWebAppName = webAppResource.name;
      
      // Extract target web app name from script
      let targetWebAppName = script.match(/az webapp create[^]*?--name\s+["']?([^"'\s\\]+)["']?/)?.[1];
      if (!targetWebAppName) {
        targetWebAppName = script.match(/TARGET_WEBAPP_NAME\s*=\s*["']([^"']+)["']/)?.[1];
      }
      if (!targetWebAppName) {
        targetWebAppName = `${sourceWebAppName}-clone`;
      }
      
      // Extract TARGET_RG from script or use provided value
      let targetRg = script.match(/TARGET_RG\s*=\s*["']([^"']+)["']/)?.[1] || targetResourceGroupName || 'TARGET_RG';
      const sourceRg = resourceGroupData.resourceGroup?.name || 'SOURCE_RG';
      
      // Find where web app is created
      const webAppCreateMatch = script.match(/az webapp create[^]*?(?:\n|$)/);
      if (!webAppCreateMatch) {
        console.log('⚠️  Could not find web app creation in script');
        return script;
      }
      
      // Find insertion point (after web app creation and verification)
      let insertionPoint = webAppCreateMatch.index + webAppCreateMatch[0].length;
      
      // Look for "Web App created successfully" or similar
      const successMatch = script.substring(insertionPoint).match(/Web App.*created.*successfully[^\n]*\n/i);
      if (successMatch) {
        insertionPoint += successMatch.index + successMatch[0].length;
      }
      
      // Build deployment steps block
      const deploymentBlock = `

# 🚨🚨🚨 CRITICAL: CONTENT DEPLOYMENT FOR ZIP-STATIC WEB APP 🚨🚨🚨
# The web app shell was created above, but it's EMPTY without content!
# You MUST download content from source and deploy it to target!

# STEP D2: Enable Basic Auth for SCM (required for Kudu API)
echo "Step D2: Enabling Basic Auth for SCM temporarily..."
if ! az resource update \\
  --resource-group "${sourceRg}" \\
  --name scm \\
  --namespace Microsoft.Web \\
  --resource-type basicPublishingCredentialsPolicies \\
  --parent sites/${sourceWebAppName} \\
  --set properties.allow=true 2>&1 | tee /tmp/basic-auth-enable.log; then
  echo "⚠️  Warning: Failed to enable Basic Auth, but continuing..."
  cat /tmp/basic-auth-enable.log 2>/dev/null || true
fi

echo "Waiting for Basic Auth policy to take effect..."
sleep 8

# Verify Basic Auth is actually enabled
AUTH_STATUS=$(az resource show \\
  --resource-group "${sourceRg}" \\
  --name scm \\
  --namespace Microsoft.Web \\
  --resource-type basicPublishingCredentialsPolicies \\
  --parent sites/${sourceWebAppName} \\
  --query "properties.allow" -o tsv 2>/dev/null || echo "unknown")

echo "  Basic Auth status: $AUTH_STATUS"

if [ "$AUTH_STATUS" != "true" ]; then
  echo "⚠️  WARNING: Basic Auth may not be enabled (status: $AUTH_STATUS)"
  echo "  Attempting to enable again..."
  az resource update \\
    --resource-group "${sourceRg}" \\
    --name scm \\
    --namespace Microsoft.Web \\
    --resource-type basicPublishingCredentialsPolicies \\
    --parent sites/${sourceWebAppName} \\
    --set properties.allow=true >/dev/null 2>&1
  sleep 5
fi

# STEP D3: Get deployment credentials from SOURCE web app
echo "Step D3: Getting deployment credentials from SOURCE web app..."
CREDS=$(az webapp deployment list-publishing-profiles \\
  --name "${sourceWebAppName}" \\
  --resource-group "${sourceRg}" \\
  --query "[?publishMethod=='MSDeploy'].{user:userName,pwd:userPWD}" -o json 2>/dev/null)

if [ -z "$CREDS" ] || [ "$CREDS" = "[]" ] || [ "$CREDS" = "null" ]; then
  echo "  Trying alternative credential method..."
  CREDS=$(az webapp deployment list-publishing-profiles \\
    --name "${sourceWebAppName}" \\
    --resource-group "${sourceRg}" \\
    -o json 2>/dev/null | jq '.[] | select(.publishMethod=="MSDeploy") | {user: .userName, pwd: .userPWD}' 2>/dev/null | jq -s '.[0]' 2>/dev/null)
fi

PUBLISH_USER=$(echo "$CREDS" | jq -r '.[0].user // .user // empty' 2>/dev/null)
PUBLISH_PWD=$(echo "$CREDS" | jq -r '.[0].pwd // .pwd // .userPWD // empty' 2>/dev/null)

if [ -z "$PUBLISH_USER" ] || [ -z "$PUBLISH_PWD" ] || [ "$PUBLISH_USER" = "null" ] || [ "$PUBLISH_PWD" = "null" ]; then
  echo "❌ ERROR: Failed to get publishing credentials"
  exit 1
fi

echo "✅ Credentials retrieved successfully"

# STEP D4: Download content from SOURCE web app
echo "Step D4: Downloading content from SOURCE web app: ${sourceWebAppName}..."
mkdir -p clone-content

MAX_RETRIES=3
RETRY_COUNT=0
DOWNLOAD_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$DOWNLOAD_SUCCESS" = "false" ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Download attempt $RETRY_COUNT of $MAX_RETRIES..."
  
  # Download with proper output redirection (stderr to stdout, then capture HTTP code)
  HTTP_CODE=$(curl -s -S -o clone-content/source.zip -w "%{http_code}" -u "$PUBLISH_USER:$PUBLISH_PWD" \\
    "https://${sourceWebAppName}.scm.azurewebsites.net/api/zip/site/wwwroot/" 2>&1 | grep -oE '[0-9]{3}$' | tail -1)
  
  # If HTTP code extraction failed, try alternative method
  if [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" = "" ]; then
    # Try downloading again with separate stderr capture
    curl -s -S -o clone-content/source.zip -w "%{http_code}" -u "$PUBLISH_USER:$PUBLISH_PWD" \\
      "https://${sourceWebAppName}.scm.azurewebsites.net/api/zip/site/wwwroot/" >/tmp/curl_output.txt 2>&1
    HTTP_CODE=$(tail -1 /tmp/curl_output.txt | grep -oE '[0-9]{3}' | tail -1)
  fi
  
  # Check file size
  FILE_SIZE=$(stat -f%z clone-content/source.zip 2>/dev/null || stat -c%s clone-content/source.zip 2>/dev/null || echo "0")
  
  if [ -f clone-content/source.zip ] && [ "$FILE_SIZE" -gt 0 ] && echo "$HTTP_CODE" | grep -q "200"; then
    DOWNLOAD_SUCCESS=true
    echo "✅ Download successful! (Size: $FILE_SIZE bytes)"
  else
    echo "⚠️  Download failed (HTTP $HTTP_CODE, Size: $FILE_SIZE bytes)"
    if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
      echo "  Error: Authentication failed - Basic Auth may not be enabled"
      echo "  Verifying Basic Auth status..."
      AUTH_CHECK=$(az resource show \\
        --resource-group "${sourceRg}" \\
        --name scm \\
        --namespace Microsoft.Web \\
        --resource-type basicPublishingCredentialsPolicies \\
        --parent sites/${sourceWebAppName} \\
        --query "properties.allow" -o tsv 2>/dev/null || echo "unknown")
      echo "  Basic Auth status: $AUTH_CHECK"
    fi
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "  Waiting 5 seconds before retry..."
      sleep 5
      az resource update \\
        --resource-group "${sourceRg}" \\
        --name scm \\
        --namespace Microsoft.Web \\
        --resource-type basicPublishingCredentialsPolicies \\
        --parent sites/${sourceWebAppName} \\
        --set properties.allow=true >/dev/null 2>&1 || true
      sleep 3
    fi
  fi
done

if [ ! -f clone-content/source.zip ] || [ ! -s clone-content/source.zip ]; then
  echo "❌ ERROR: Failed to download content after $MAX_RETRIES attempts"
  exit 1
fi

FILE_SIZE=$(du -h clone-content/source.zip | cut -f1)
echo "✅ Content downloaded successfully ($FILE_SIZE)"

# STEP D4b: Disable Basic Auth for SCM (security)
echo "Step D4b: Disabling Basic Auth for SCM (security)..."
az resource update \\
  --resource-group "${sourceRg}" \\
  --name scm \\
  --namespace Microsoft.Web \\
  --resource-type basicPublishingCredentialsPolicies \\
  --parent sites/${sourceWebAppName} \\
  --set properties.allow=false >/dev/null 2>&1 || true
echo "✅ Basic Auth disabled"

# STEP D5: Extract and re-zip
echo "Step D5: Extracting and re-packaging content..."
cd clone-content
unzip -q source.zip || {
  echo "ERROR: Failed to extract source.zip"
  cd ..
  exit 1
}
rm source.zip
zip -r -q ../deploy.zip . || {
  echo "ERROR: Failed to create deploy.zip"
  cd ..
  exit 1
}
cd ..

echo "Content re-packaged successfully ($(du -h deploy.zip | cut -f1))"

# STEP D6: Deploy to TARGET web app
echo "Step D6: Deploying content to TARGET web app: ${targetWebAppName}..."

if [ ! -f deploy.zip ]; then
  echo "❌ ERROR: deploy.zip not found"
  exit 1
fi

ZIP_SIZE=$(du -h deploy.zip | cut -f1)
echo "  Deploy package size: $ZIP_SIZE"

echo "  Verifying target web app exists..."
if ! az webapp show --name "${targetWebAppName}" --resource-group "${targetRg}" >/dev/null 2>&1; then
  echo "❌ ERROR: Target web app does not exist: ${targetWebAppName}"
  exit 1
fi
echo "  ✅ Target web app verified"

MAX_DEPLOY_RETRIES=3
DEPLOY_RETRY_COUNT=0
DEPLOY_SUCCESS=false

while [ $DEPLOY_RETRY_COUNT -lt $MAX_DEPLOY_RETRIES ] && [ "$DEPLOY_SUCCESS" = "false" ]; do
  DEPLOY_RETRY_COUNT=$((DEPLOY_RETRY_COUNT + 1))
  echo "  Deployment attempt $DEPLOY_RETRY_COUNT of $MAX_DEPLOY_RETRIES..."
  
  if az webapp deployment source config-zip \\
    --resource-group "${targetRg}" \\
    --name "${targetWebAppName}" \\
    --src deploy.zip 2>&1 | tee /tmp/deploy.log; then
    DEPLOY_SUCCESS=true
    echo "✅ Deployment successful!"
  else
    echo "⚠️  Deployment failed, checking error..."
    cat /tmp/deploy.log 2>/dev/null | tail -10
    if [ $DEPLOY_RETRY_COUNT -lt $MAX_DEPLOY_RETRIES ]; then
      echo "  Waiting 5 seconds before retry..."
      sleep 5
    fi
  fi
done

if [ "$DEPLOY_SUCCESS" = "false" ]; then
  echo "❌ ERROR: Failed to deploy ZIP after $MAX_DEPLOY_RETRIES attempts"
  exit 1
fi

echo "✅ Content deployed successfully to target web app"

# Clean up temporary files
rm -rf clone-content deploy.zip

# STEP D7: Restart TARGET web app
echo "Step D7: Restarting TARGET web app..."
az webapp restart \\
  --name "${targetWebAppName}" \\
  --resource-group "${targetRg}"

echo "Waiting for web app to restart..."
sleep 10

echo "✅ Static web app cloned successfully!"
echo "Original: https://${sourceWebAppName}.azurewebsites.net"
echo "Clone: https://${targetWebAppName}.azurewebsites.net"

`;
      
      // Insert the deployment block
      const fixedScript = script.slice(0, insertionPoint) + deploymentBlock + script.slice(insertionPoint);
      
      console.log('✅ Fixed script: Added zip-static content deployment steps');
      
      return fixedScript;
    } catch (error) {
      console.error('⚠️  Error in ensureZipStaticDeployment:', error.message);
      // Return original script if fix fails - don't break generation
      return script;
    }
  }
  
  /**
   * Post-process script to remove invalid parameters from az webapp create for zip-static apps
   * This fixes errors like "Please specify both --multicontainer-config-type..."
   */
  fixWebAppCreateParameters(script, resourceGroupData) {
    try {
      // Check if script creates a web app
      const createsWebApp = /az webapp create/.test(script);
      
      if (!createsWebApp) {
        return script;
      }
      
      // Check if it's a zip-static web app
      const webAppResource = resourceGroupData?.resources?.find(
        r => r.type === 'Microsoft.Web/sites' || r.type?.includes('Web/sites')
      );
      
      if (!webAppResource || !webAppResource.webAppConfig) {
        return script; // Can't determine type, skip
      }
      
      const isZipStatic = webAppResource.webAppConfig.deploymentType === 'zip-static';
      
      if (!isZipStatic) {
        return script; // Not a zip-static app, no fix needed
      }
      
      // Forbidden parameters that cause the error
      const forbiddenParams = [
        '--runtime',
        '--deployment-container-image-name',
        '--multicontainer-config-type',
        '--multicontainer-config-file',
        '--sitecontainers_app'
      ];
      
      let fixedScript = script;
      let hasChanges = false;
      
      // Pattern to match az webapp create commands (handles multiline with backslashes)
      const createCommandPattern = /az webapp create\s*\\?\s*\n(?:(?:[^\n]*\\?\s*\n)*?)(?:--name\s+[^\s\n\\]+)/g;
      const matches = [...script.matchAll(createCommandPattern)];
      
      for (const match of matches) {
        const fullCommand = match[0];
        let commandHasForbidden = false;
        
        // Check if command has any forbidden parameters
        for (const param of forbiddenParams) {
          if (fullCommand.includes(param)) {
            commandHasForbidden = true;
            break;
          }
        }
        
        if (commandHasForbidden) {
          console.log('🔧 Fixing script: Removing invalid parameters from az webapp create for zip-static app...');
          
          // Extract only the allowed parameters: --name, --resource-group, --plan
          const nameMatch = fullCommand.match(/--name\s+[^\s\n\\]+/);
          const rgMatch = fullCommand.match(/--resource-group\s+[^\s\n\\]+/);
          const planMatch = fullCommand.match(/--plan\s+[^\s\n\\]+/);
          
          if (nameMatch && rgMatch && planMatch) {
            // Rebuild command with only allowed parameters
            const fixedCommand = `az webapp create \\
  ${nameMatch[0]} \\
  ${rgMatch[0]} \\
  ${planMatch[0]}`;
            
            fixedScript = fixedScript.replace(fullCommand, fixedCommand);
            hasChanges = true;
            console.log('✅ Removed invalid parameters from az webapp create command');
          }
        }
      }
      
      // Also check for single-line commands
      const singleLinePattern = /az webapp create\s+[^\n]+/g;
      const singleLineMatches = [...fixedScript.matchAll(singleLinePattern)];
      
      for (const match of singleLineMatches) {
        const fullCommand = match[0];
        let commandHasForbidden = false;
        
        for (const param of forbiddenParams) {
          if (fullCommand.includes(param)) {
            commandHasForbidden = true;
            break;
          }
        }
        
        if (commandHasForbidden) {
          console.log('🔧 Fixing script: Removing invalid parameters from single-line az webapp create...');
          
          const nameMatch = fullCommand.match(/--name\s+[^\s]+/);
          const rgMatch = fullCommand.match(/--resource-group\s+[^\s]+/);
          const planMatch = fullCommand.match(/--plan\s+[^\s]+/);
          
          if (nameMatch && rgMatch && planMatch) {
            const fixedCommand = `az webapp create ${nameMatch[0]} ${rgMatch[0]} ${planMatch[0]}`;
            fixedScript = fixedScript.replace(fullCommand, fixedCommand);
            hasChanges = true;
            console.log('✅ Removed invalid parameters from single-line az webapp create command');
          }
        }
      }
      
      if (hasChanges) {
        console.log('✅ Fixed script: Cleaned up az webapp create parameters for zip-static app');
      }
      
      return fixedScript;
    } catch (error) {
      console.error('⚠️  Error in fixWebAppCreateParameters:', error.message);
      // Return original script if fix fails - don't break generation
      return script;
    }
  }
  
  /**
   * Post-process script to ensure SQL server names are used correctly
   * This fixes the issue where target server name is used as source server name
   */
  fixSQLServerNameUsage(script, resourceGroupData) {
    try {
      // Check if script uses SQL database copy
      const usesSQLCopy = /az sql db copy/.test(script);
      
      if (!usesSQLCopy) {
        // No SQL copy operation, no fix needed
        return script;
      }
      
      // Find SQL server resource
      const sqlServerResource = resourceGroupData?.resources?.find(
        r => r.type === 'Microsoft.Sql/servers' || r.type?.includes('Sql/servers')
      );
      
      if (!sqlServerResource || !sqlServerResource.name) {
        return script; // Can't find SQL server, skip
      }
      
      const sourceSqlServerName = sqlServerResource.name;
      
      // Check if SOURCE_SQL_SERVER is defined
      const sourceServerDefined = /SOURCE_SQL_SERVER\s*=\s*["'][^"']+["']/.test(script);
      
      if (!sourceServerDefined) {
        console.log('🔧 Fixing script: Adding SOURCE_SQL_SERVER definition...');
        
        // Find insertion point (after TARGET_SQL_SERVER or SOURCE_DB_NAME)
        const targetServerMatch = script.match(/TARGET_SQL_SERVER\s*=\s*["'][^"']+["']/);
        const sourceDbMatch = script.match(/SOURCE_DB_NAME\s*=\s*["'][^"']+["']/);
        
        let insertionPoint = 0;
        if (targetServerMatch) {
          insertionPoint = targetServerMatch.index + targetServerMatch[0].length;
        } else if (sourceDbMatch) {
          insertionPoint = sourceDbMatch.index + sourceDbMatch[0].length;
        } else {
          // Find any SQL-related variable
          const sqlVarMatch = script.match(/(SOURCE_DB_NAME|TARGET_DB_NAME|SQL_SERVER)\s*=\s*["'][^"']+["']/);
          if (sqlVarMatch) {
            insertionPoint = sqlVarMatch.index + sqlVarMatch[0].length;
          }
        }
        
        const lineEnd = script.indexOf('\n', insertionPoint);
        const insertAfter = lineEnd !== -1 ? lineEnd : insertionPoint;
        
        const variableBlock = `\nSOURCE_SQL_SERVER="${sourceSqlServerName}"  # Source SQL server name (for database copy)\n`;
        const fixedScript = script.slice(0, insertAfter) + variableBlock + script.slice(insertAfter);
        
        console.log(`✅ Fixed script: Added SOURCE_SQL_SERVER="${sourceSqlServerName}"`);
        return fixedScript;
      }
      
      // Check if az sql db copy uses wrong server name (target instead of source)
      const wrongServerPattern = /az sql db copy[^]*?--server\s+["']?\$?TARGET_SQL_SERVER["']?/;
      if (wrongServerPattern.test(script)) {
        console.log('🔧 Fixing script: Replacing TARGET_SQL_SERVER with SOURCE_SQL_SERVER in az sql db copy...');
        
        // Replace TARGET_SQL_SERVER with SOURCE_SQL_SERVER in --server parameter for az sql db copy
        const fixedScript = script.replace(
          /(az sql db copy[^]*?--server\s+["']?)\$?TARGET_SQL_SERVER(["']?)/g,
          '$1$SOURCE_SQL_SERVER$2'
        );
        
        console.log('✅ Fixed script: Changed --server parameter to use SOURCE_SQL_SERVER');
        return fixedScript;
      }
      
      // Check if --server uses a literal target server name instead of SOURCE_SQL_SERVER variable
      const literalTargetPattern = /az sql db copy[^]*?--server\s+["']sqlserver-\d+["']/;
      if (literalTargetPattern.test(script) && !script.includes('--server "$SOURCE_SQL_SERVER"') && !script.includes("--server '$SOURCE_SQL_SERVER'")) {
        console.log('🔧 Fixing script: Replacing literal target server name with SOURCE_SQL_SERVER variable...');
        
        // This is trickier - we need to find the az sql db copy command and replace the --server value
        const fixedScript = script.replace(
          /(az sql db copy[^]*?--server\s+["'])(sqlserver-\d+)(["'])/g,
          (match, prefix, serverName, suffix) => {
            // Only replace if it looks like a target server (has numbers that match target pattern)
            if (serverName.includes('-') && /sqlserver-\d+/.test(serverName)) {
              return `${prefix}$SOURCE_SQL_SERVER${suffix}`;
            }
            return match;
          }
        );
        
        console.log('✅ Fixed script: Replaced literal server name with SOURCE_SQL_SERVER variable');
        return fixedScript;
      }
      
      return script;
    } catch (error) {
      console.error('⚠️  Error in fixSQLServerNameUsage:', error.message);
      // Return original script if fix fails - don't break generation
      return script;
    }
  }

  /**
   * Chat with AI Agent about resource cloning
   */
  async chat(messages, context = {}) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }
    
    try {
      const systemPrompt = this.getChatSystemPrompt();
      
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }))
      ];
      
      // Add context if provided
      if (context.resourceGroupData) {
        chatMessages.splice(1, 0, {
          role: 'system',
          content: `CONTEXT - Current Resource Group Data:\n${JSON.stringify(context.resourceGroupData, null, 2)}`
        });
      }
      
      const response = await this.client.getChatCompletions(
        this.deploymentName,
        chatMessages,
        {
          temperature: 0.7,
          maxTokens: 2000,
          topP: 0.95
        }
      );
      
      return {
        message: response.choices[0].message.content,
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens
        }
      };
    } catch (error) {
      console.error('❌ Chat failed:', error.message);
      throw error;
    }
  }
  
  /**
   * System prompt for resource analysis
   */
  getSystemPrompt() {
    return `You are an expert Azure Cloud Architect and DevOps specialist with deep knowledge of:
- Azure Resource Manager (ARM)
- Azure resource types and their configurations
- Resource dependencies and deployment order
- Infrastructure as Code (Terraform, ARM templates)
- Azure CLI and PowerShell
- Best practices for resource cloning and migration

Your task is to analyze Azure resource group configurations and create comprehensive cloning strategies.

ANALYZE AND PROVIDE:
1. Resource inventory and categorization
2. Dependency analysis (which resources depend on others)
3. Deployment order (correct sequence to avoid failures)
4. Configuration differences and considerations
5. Potential issues and warnings
6. Estimated deployment time
7. Cost implications
8. Security considerations

OUTPUT FORMAT: JSON with the following structure:
{
  "summary": "Brief overview",
  "resourceInventory": [
    {
      "name": "resource name",
      "type": "resource type",
      "category": "compute|network|storage|database|etc",
      "complexity": "low|medium|high"
    }
  ],
  "dependencies": [
    {
      "resource": "resource name",
      "dependsOn": ["list of dependencies"]
    }
  ],
  "deploymentOrder": ["ordered list of resource names"],
  "warnings": ["potential issues"],
  "estimatedTime": "minutes",
  "considerations": {
    "security": ["security points"],
    "cost": ["cost considerations"],
    "networking": ["network considerations"]
  },
  "recommendations": ["best practices"]
}

Be thorough, accurate, and provide actionable insights.`;
  }
  
  /**
   * User prompt for resource analysis
   */
  getUserPrompt(resourceGroupData, targetResourceGroupName) {
    return `Analyze the following Azure resource group and create a comprehensive cloning strategy:

SOURCE RESOURCE GROUP:
Name: ${resourceGroupData.resourceGroup.name}
Location: ${resourceGroupData.resourceGroup.location}
Tags: ${JSON.stringify(resourceGroupData.resourceGroup.tags || {})}

TARGET RESOURCE GROUP:
Name: ${targetResourceGroupName}

RESOURCES TO CLONE (${resourceGroupData.totalResources} resources):
${JSON.stringify(resourceGroupData.resources, null, 2)}

Provide a detailed analysis and cloning strategy in the specified JSON format.`;
  }
  
  /**
   * System prompt for chat conversations
   */
  getChatSystemPrompt() {
    return `You are an intelligent Azure AI Agent specialized in resource management and cloning.

YOUR CAPABILITIES:
1. Analyze Azure resource groups and their resources
2. Generate Terraform configurations for resource cloning
3. Generate Azure CLI scripts for resource deployment
4. Identify dependencies between resources
5. Provide cost estimates and optimization suggestions
6. Explain Azure concepts and best practices
7. Troubleshoot deployment issues

YOUR PERSONALITY:
- Professional and knowledgeable
- Clear and concise explanations
- Proactive in identifying potential issues
- Helpful and supportive

CONVERSATION GUIDELINES:
1. Always confirm before destructive operations
2. Provide warnings about cost implications
3. Explain technical concepts in simple terms
4. Offer alternatives when appropriate
5. Ask clarifying questions when needed

When users ask you to clone resources:
1. Confirm the source and target resource groups
2. Analyze the resources
3. Explain what will be cloned
4. Highlight any potential issues
5. Provide script options (Terraform or Azure CLI)
6. Offer to execute or just provide the scripts

Be conversational but professional. Help users make informed decisions about their Azure resources.`;
  }
  
  /**
   * Estimate cost for cloning resources
   */
  async estimateCost(resourceGroupData) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }
    
    try {
      console.log('💰 Starting cost estimation with GPT-4o...');
      
      const systemPrompt = `You are an Azure cost optimization expert with access to current Azure pricing data (November 2025).

🎯 YOUR TASK: Provide accurate monthly cost estimates for cloning Azure resources.

📋 AZURE PRICING REFERENCE (November 2025):
- Cognitive Services (Azure OpenAI): 
  * S0 Standard: ~$240-400/month (includes hosting + API calls)
  * S1-S4: $1,000-10,000/month depending on tier
  * Pay-as-you-go: $0.002-0.12 per 1K tokens (varies by model)
- Storage Accounts:
  * Standard LRS: $0.018/GB/month
  * Standard GRS: $0.036/GB/month
  * Premium: $0.15-0.30/GB/month
- Virtual Machines:
  * B1s: $7.59/month
  * D2s_v3: $96/month
  * D4s_v3: $192/month
- SQL Database:
  * Basic: $5/month
  * Standard S0: $15/month
  * Standard S1: $30/month
- App Service:
  * Free: $0
  * Basic B1: $55/month
  * Standard S1: $70/month

🚨 CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations outside JSON.

OUTPUT STRUCTURE (MUST BE VALID JSON):
{
  "totalEstimatedCost": "150.00",
  "currency": "USD",
  "period": "monthly",
  "breakdown": [
    {
      "resourceName": "azure-openai-learn",
      "resourceType": "Microsoft.CognitiveServices/accounts",
      "sku": "S0",
      "estimatedCost": "300.00",
      "costFactors": [
        "Base hosting fee: $240/month",
        "API call costs (medium usage): ~$60/month",
        "Data egress (estimated): ~$5/month"
      ],
      "region": "eastus"
    }
  ],
  "savingsRecommendations": [
    {
      "recommendation": "Consider pay-as-you-go pricing if usage is sporadic",
      "potentialSavings": "30-50%",
      "action": "Switch from S0 to consumption-based pricing"
    }
  ],
  "assumptions": [
    "Medium usage pattern assumed",
    "No reserved instances or savings plans applied",
    "Data transfer costs within same region minimal"
  ],
  "warnings": [
    "Azure OpenAI S0 tier has minimum monthly commitment",
    "Actual costs may vary based on API call volume"
  ]
}

RULES:
1. Use realistic Azure pricing from November 2025
2. For Cognitive Services, estimate based on SKU and tier
3. Include detailed cost factors for each resource
4. Provide actionable savings recommendations
5. Return ONLY JSON (no markdown, no backticks, no extra text)`;

      const userPrompt = `Estimate monthly cost for cloning these Azure resources to target location ${resourceGroupData.resourceGroup.location}:

${JSON.stringify(resourceGroupData.resources, null, 2)}

Analyze each resource carefully and provide accurate cost estimates with breakdown.`;

      console.log('📤 Sending request to GPT-4o for cost analysis...');
      
      const response = await this.client.getChatCompletions(
        this.deploymentName,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.2, // Low temperature for consistent pricing estimates
          maxTokens: 3000,
          topP: 0.9
        }
      );
      
      const content = response.choices[0].message.content.trim();
      console.log('📥 Received response from GPT-4o');
      console.log('Response content length:', content.length);
      
      // Try to parse JSON response
      try {
        // Remove markdown code blocks if present
        let jsonContent = content;
        if (content.includes('```json')) {
          jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (content.includes('```')) {
          jsonContent = content.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(jsonContent.trim());
        console.log('✅ Successfully parsed cost estimate JSON');
        console.log('Total estimated cost:', parsed.totalEstimatedCost);
        
        return parsed;
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError.message);
        console.error('Raw response:', content.substring(0, 500));
        
        // Fallback: Return structured error with the raw response
        return {
          totalEstimatedCost: "N/A",
          currency: "USD",
          period: "monthly",
          breakdown: [],
          error: true,
          errorMessage: "Failed to parse cost estimate. Please try again.",
          rawResponse: content
        };
      }
    } catch (error) {
      console.error('❌ Cost estimation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get static Azure CLI script with dynamic resource values
   * This is used when the toggle is ON to use a pre-defined script template
   */
  getStaticCLIScript(resourceGroupData, targetResourceGroupName, validatedConfig) {
    try {
      // Extract source resource group name (only this is dynamic)
      const sourceRG = resourceGroupData?.resourceGroup?.name || 'hello-world-nextjs-rg';
      
      // Use exact hardcoded values as specified by user
      const location = 'centralindia';
      const sourceWebAppName = 'hello-world-static-1763324087';
      const targetWebAppName = 'devops-app-staging-236987';
      const sourceSQLServer = 'sqlserver-1236';
      const targetSQLServer = 'sqlserver-236987';
      const sourceDBName = 'sqldb-6179';
      const targetDBName = 'sqldb-236987';
      
      // Static script template (from user's provided script)
      const staticScript = `#!/bin/bash

# Variables
# SQL SERVER NAME VALIDATION (Auto-added for safety)
# Strip .database.windows.net suffix if present in any SQL_SERVER* variables
for var in \${!SQL*SERVER*}; do
  if [[ "\${!var}" == *.database.windows.net ]]; then
    echo "⚠️  WARNING: Variable $var contains .database.windows.net suffix"
    echo "   Current value: \${!var}"
    # Use parameter expansion to strip suffix
    new_value="\${!var%.database.windows.net}"
    eval "$var="\$new_value""
    echo "   Fixed value: \${!var}"
  fi
done

SOURCE_RG="${sourceRG}"
TARGET_RG="${targetResourceGroupName}"
LOCATION="${location}"  # Recommended region with available quota

# Resource names from validated configuration
SOURCE_WEBAPP_NAME="${sourceWebAppName}"
TARGET_WEBAPP_NAME="${targetWebAppName}"
SOURCE_SQL_SERVER="${sourceSQLServer}"
TARGET_SQL_SERVER="${targetSQLServer}"
SOURCE_DB_NAME="${sourceDBName}"
TARGET_DB_NAME="${targetDBName}"

# Verify Azure CLI authentication
echo "Verifying Azure CLI authentication..."
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: Azure CLI is not authenticated"
  echo "Please run: az login"
  exit 1
fi
echo "✅ Azure CLI authenticated successfully"

# Create target resource group
echo "Creating target resource group: $TARGET_RG in $LOCATION..."
if ! az group create --name "$TARGET_RG" --location "$LOCATION" >/dev/null 2>&1; then
  echo "ERROR: Failed to create resource group $TARGET_RG"
  exit 1
fi
echo "✅ Resource group created successfully"

# Create App Service Plan
PLAN_NAME="appservice-plan-$RANDOM"
echo "Creating App Service Plan: $PLAN_NAME..."
if ! az appservice plan create --name "$PLAN_NAME" --resource-group "$TARGET_RG" --location "$LOCATION" --sku B1 >/dev/null 2>&1; then
  echo "ERROR: Failed to create App Service Plan $PLAN_NAME"
  exit 1
fi
echo "✅ App Service Plan created successfully"

# Create Web App
echo "Creating Web App: $TARGET_WEBAPP_NAME..."
if ! az webapp create --name $TARGET_WEBAPP_NAME --resource-group $TARGET_RG --plan $PLAN_NAME >/dev/null 2>&1; then
  echo "ERROR: Failed to create Web App $TARGET_WEBAPP_NAME"
  exit 1
fi
echo "✅ Web App created successfully"

# Enable Basic Auth for SCM
echo "Enabling Basic Auth for SCM on source web app..."
if ! az resource update --resource-group "$SOURCE_RG" --name scm --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies --parent sites/$SOURCE_WEBAPP_NAME --set properties.allow=true >/dev/null 2>&1; then
  echo "ERROR: Failed to enable Basic Auth for SCM"
  exit 1
fi
echo "✅ Basic Auth enabled successfully"

# Get deployment credentials
echo "Fetching deployment credentials for source web app..."
CREDS=$(az webapp deployment list-publishing-profiles --name "$SOURCE_WEBAPP_NAME" --resource-group "$SOURCE_RG" --query "[?publishMethod=='MSDeploy'].{user:userName,pwd:userPWD}" -o json 2>/dev/null)
PUBLISH_USER=$(echo "$CREDS" | jq -r '.[0].user')
PUBLISH_PWD=$(echo "$CREDS" | jq -r '.[0].pwd')
if [[ -z "$PUBLISH_USER" || -z "$PUBLISH_PWD" ]]; then
  echo "ERROR: Failed to fetch deployment credentials"
  exit 1
fi
echo "✅ Deployment credentials fetched successfully"

# Download content from source web app
echo "Downloading content from source web app..."
mkdir -p clone-content
HTTP_CODE=$(curl -s -o clone-content/source.zip -w "%{http_code}" -u "$PUBLISH_USER:$PUBLISH_PWD" "https://$SOURCE_WEBAPP_NAME.scm.azurewebsites.net/api/zip/site/wwwroot/")
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Failed to download content from source web app"
  exit 1
fi
echo "✅ Content downloaded successfully"

# Extract and repackage content
echo "Extracting and repackaging content..."
cd clone-content
unzip -q source.zip
rm source.zip
zip -r -q ../deploy.zip .
cd ..
echo "✅ Content repackaged successfully"

# Deploy content to target web app
echo "Deploying content to target web app..."
if ! az webapp deployment source config-zip --resource-group "$TARGET_RG" --name "$TARGET_WEBAPP_NAME" --src deploy.zip >/dev/null 2>&1; then
  echo "ERROR: Failed to deploy content to target web app"
  exit 1
fi
echo "✅ Content deployed successfully"

# Restart target web app
echo "Restarting target web app..."
if ! az webapp restart --name "$TARGET_WEBAPP_NAME" --resource-group "$TARGET_RG" >/dev/null 2>&1; then
  echo "ERROR: Failed to restart target web app"
  exit 1
fi
echo "✅ Target web app restarted successfully"

# Create SQL Server
echo "Creating SQL Server: $TARGET_SQL_SERVER..."
if ! az sql server create --name "$TARGET_SQL_SERVER" --resource-group "$TARGET_RG" --location "$LOCATION" --admin-user sqladmin --admin-password "P@ssw0rd1234" >/dev/null 2>&1; then
  echo "ERROR: Failed to create SQL Server $TARGET_SQL_SERVER"
  exit 1
fi
echo "✅ SQL Server created successfully"

# Configure firewall for SQL Server
echo "Configuring firewall for SQL Server..."
if ! az sql server firewall-rule create --resource-group "$TARGET_RG" --server "$TARGET_SQL_SERVER" --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 >/dev/null 2>&1; then
  echo "ERROR: Failed to configure firewall for SQL Server"
  exit 1
fi
echo "✅ Firewall configured successfully"

# Copy SQL Database
echo "Copying SQL Database: $SOURCE_DB_NAME to $TARGET_DB_NAME..."
if ! az sql db copy --dest-name "$TARGET_DB_NAME" --dest-resource-group "$TARGET_RG" --dest-server "$TARGET_SQL_SERVER" --name "$SOURCE_DB_NAME" --resource-group "$SOURCE_RG" --server "$SOURCE_SQL_SERVER" >/dev/null 2>&1; then
  echo "ERROR: Failed to copy SQL Database"
  exit 1
fi
echo "✅ SQL Database copied successfully"

echo "All resources cloned successfully."
`;

      return staticScript;
    } catch (error) {
      console.error('⚠️  Error generating static CLI script:', error.message);
      // Fallback to AI-generated script if static script generation fails
      throw error;
    }
  }
}

module.exports = new AIAgentService();

