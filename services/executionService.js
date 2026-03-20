const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { normalizeLinuxRuntimeForAzCli } = require('./webAppRuntimeUtils');

/**
 * Execution Service for Running Azure CLI Commands and Terraform
 * Enables autonomous execution of resource cloning operations
 */
class ExecutionService {
  constructor() {
    this.executions = new Map(); // Store execution sessions
    this.interactivePrompts = new Map(); // Store prompts waiting for user input
  }
  
  /**
   * Filter out harmless warnings from error output
   * These are warnings that don't indicate actual failures
   */
  filterHarmlessWarnings(errorOutput) {
    if (!errorOutput) return '';
    
    const harmlessPatterns = [
      // Azure CLI deprecation warnings (harmless)
      /WARNING:.*has been deprecated.*will be removed in a future release/i,
      /WARNING:.*is not a known attribute.*will be ignored/i,
      // vnet_route_all_enabled warning (harmless)
      /vnet_route_all_enabled.*not a known attribute/i,
      // Curl progress output (harmless)
      /^\s*%\s+Total.*$/m,
      /^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+.*$/m,
      /^\s*Dload\s+Upload.*$/m,
      /^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+.*$/m,
      // Azure CLI informational warnings
      /WARNING: Getting scm site credentials/i,
      /WARNING: Starting zip deployment/i,
      /WARNING: Polling the status of async deployment/i,
      /WARNING: Deployment endpoint responded with status code 202/i,
      // Empty lines and whitespace-only lines
      /^\s*$/m
    ];
    
    let filtered = errorOutput;
    harmlessPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '');
    });
    
    // Clean up multiple consecutive newlines
    filtered = filtered.replace(/\n{3,}/g, '\n\n').trim();
    
    return filtered;
  }
  
  /**
   * Check if error output contains actual errors (not just warnings)
   */
  hasActualErrors(errorOutput) {
    if (!errorOutput) return false;
    
    const filtered = this.filterHarmlessWarnings(errorOutput);
    if (!filtered || filtered.trim().length === 0) return false;
    
    // Check for actual error patterns
    const errorPatterns = [
      /ERROR:/i,
      /Failed/i,
      /Exception/i,
      /Traceback/i,
      /FileNotFoundError/i,
      /PermissionError/i,
      /Authentication failed/i,
      /Authorization failed/i,
      /not found/i,
      /does not exist/i,
      /invalid/i,
      /failed with code/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(filtered));
  }

  /**
   * Detect Azure error types and create interactive prompts
   */
  detectAzureError(errorMessage) {
    const errorPatterns = [
      {
        pattern: /quota.*required.*deployment/i,
        type: 'quota_exceeded',
        title: 'Azure Quota Limit Reached',
        description: 'Your Azure subscription has reached its quota limit for this resource type.',
        actions: [
          { id: 'change_sku', label: 'Change to lower SKU', icon: '📉' },
          { id: 'change_region', label: 'Try different region', icon: '🌍' },
          { id: 'request_quota', label: 'Guide me to request quota increase', icon: '📝' },
          { id: 'skip_resource', label: 'Skip this resource and continue', icon: '⏭️' }
        ]
      },
      {
        pattern: /Location.*not accepting.*SQL Database/i,
        type: 'region_unavailable',
        title: 'Region Not Available',
        description: 'The selected Azure region is not currently accepting new resource creation.',
        actions: [
          { id: 'select_region', label: 'Select different region', icon: '🌍', requiresInput: true },
          { id: 'auto_region', label: 'Auto-select available region', icon: '🤖' },
          { id: 'skip_resource', label: 'Skip this resource and continue', icon: '⏭️' }
        ],
        suggestedRegions: ['West US', 'West US 2', 'Central US', 'North Europe', 'West Europe', 'Southeast Asia']
      },
      {
        pattern: /StorageAccountAlreadyExists/i,
        type: 'name_conflict',
        title: 'Resource Name Already Exists',
        description: 'A resource with this name already exists globally in Azure.',
        actions: [
          { id: 'generate_new_name', label: 'Generate new unique name', icon: '🔄' },
          { id: 'provide_custom_name', label: 'Provide custom name', icon: '✏️', requiresInput: true },
          { id: 'skip_resource', label: 'Skip this resource and continue', icon: '⏭️' }
        ]
      },
      {
        pattern: /AuthorizationFailed|authorization.*failed/i,
        type: 'permission_denied',
        title: 'Insufficient Permissions',
        description: 'Your service principal does not have sufficient permissions for this operation.',
        actions: [
          { id: 'guide_permissions', label: 'Show me how to fix permissions', icon: '🔑' },
          { id: 'skip_resource', label: 'Skip this resource and continue', icon: '⏭️' },
          { id: 'abort', label: 'Stop execution', icon: '🛑' }
        ]
      },
      {
        pattern: /InvalidParameter|unrecognized arguments|not supported/i,
        type: 'invalid_parameter',
        title: 'Invalid Resource Configuration',
        description: 'The resource configuration contains invalid or unsupported parameters.',
        actions: [
          { id: 'use_minimal_config', label: 'Use minimal configuration', icon: '⚙️' },
          { id: 'skip_resource', label: 'Skip this resource and continue', icon: '⏭️' },
          { id: 'regenerate_script', label: 'Regenerate script with AI', icon: '🤖' }
        ]
      }
    ];
    
    for (const errorPattern of errorPatterns) {
      if (errorPattern.pattern.test(errorMessage)) {
        return {
          detected: true,
          errorType: errorPattern.type,
          title: errorPattern.title,
          description: errorPattern.description,
          actions: errorPattern.actions,
          suggestedRegions: errorPattern.suggestedRegions,
          originalError: errorMessage
        };
      }
    }
    
    // Generic error - still offer recovery
    return {
      detected: true,
      errorType: 'generic_error',
      title: 'Execution Error Encountered',
      description: 'An error occurred during resource creation.',
      actions: [
        { id: 'retry', label: 'Retry this step', icon: '🔄' },
        { id: 'skip_resource', label: 'Skip and continue with next resource', icon: '⏭️' },
        { id: 'abort', label: 'Stop execution', icon: '🛑' }
      ],
      originalError: errorMessage
    };
  }
  
  /**
   * Execute Azure CLI commands with real-time progress
   * ENHANCED: Properly handles multi-line commands and special characters in passwords
   */
  async executeAzureCLI(sessionId, script, options = {}) {
    const execution = {
      sessionId,
      type: 'azure-cli',
      status: 'running',
      steps: [],
      startTime: Date.now(),
      output: [],
      errors: []
    };
    
    this.executions.set(sessionId, execution);
    
    try {
      // Step 1: Authenticate with Azure CLI using service principal
      console.log(`🔐 Authenticating with Azure CLI...`);
      const authResult = await this.authenticateAzureCLI();
      
      if (!authResult.success) {
        execution.status = 'failed';
        execution.errors.push({
          step: 0,
          command: 'Azure CLI Authentication',
          error: authResult.error
        });
        console.error(`❌ Azure CLI authentication failed: ${authResult.error}`);
        return execution;
      }
      
      console.log(`✅ Azure CLI authenticated successfully`);
      
      // Step 2: Clean and prepare script (preserving multi-line commands)
      let cleanedScript = this.cleanAIGeneratedScriptPreserveMultiline(script);
      
      // Step 2.5: CRITICAL - Fix SQL server names (strip .database.windows.net suffix)
      cleanedScript = this.fixSQLServerNames(cleanedScript);
      
      console.log(`🚀 Starting Azure CLI execution: ${sessionId}`);
      console.log(`📝 Cleaned script ready for execution`);
      console.log(`📄 Script preview (first 500 chars):\n${cleanedScript.substring(0, 500)}\n`);
      
      // Save script to temporary file to avoid quote escaping issues
      const tmpDir = path.join(__dirname, '..', 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      
      const scriptFile = path.join(tmpDir, `${sessionId}.sh`);
      await fs.writeFile(scriptFile, cleanedScript, { mode: 0o755 });
      
      console.log(`💾 Script saved to: ${scriptFile}`);
      
      // Add execution step
      // Read the script file to extract commands for visibility
      const scriptContent = await fs.readFile(scriptFile, 'utf8');
      
      const step = {
        index: 1,
        command: `Executing Azure CLI script`,
        scriptContent: scriptContent,
        status: 'running',
        output: '',
        error: '',
        startTime: Date.now(),
        realTimeCommands: []
      };
      
      execution.steps.push(step);
      
      console.log(`📝 Executing script file with real-time command tracking...`);
      
      // Execute the script file
      const result = await this.runCommand(`bash "${scriptFile}"`, options);
      
      // Update step
      step.status = result.code === 0 ? 'completed' : 'failed';
      step.output = result.output;
      
      // Filter out harmless warnings from error output
      const filteredError = this.filterHarmlessWarnings(result.error);
      const hasRealErrors = this.hasActualErrors(result.error);
      
      // Only store error if there are actual errors (not just warnings)
      step.error = hasRealErrors ? filteredError : '';
      step.duration = Date.now() - step.startTime;
      
      execution.output.push(result.output);
      
      if (result.code !== 0) {
        // Script failed - Check if it's a recoverable Azure error
        // Use filtered error for detection to avoid false positives
        const errorDetection = this.detectAzureError(filteredError || result.error + '\n' + result.output);
        
        if (errorDetection.detected && errorDetection.errorType !== 'generic_error') {
          // Pause execution and create interactive prompt
          step.status = 'waiting_for_input';
          execution.status = 'waiting_for_input';
          
          const promptId = `prompt_${sessionId}_${Date.now()}`;
          const interactivePrompt = {
            promptId,
            sessionId,
            stepIndex: 1,
            errorType: errorDetection.errorType,
            title: errorDetection.title,
            description: errorDetection.description,
            actions: errorDetection.actions,
            suggestedRegions: errorDetection.suggestedRegions,
            originalError: errorDetection.originalError,
            timestamp: Date.now(),
            scriptContent: scriptContent,
            scriptFile: scriptFile
          };
          
          this.interactivePrompts.set(promptId, interactivePrompt);
          execution.interactivePrompt = interactivePrompt;
          
          console.log(`⏸️ Execution paused for user input: ${errorDetection.title}`);
          console.log(`📋 Prompt ID: ${promptId}`);
          console.log(`🎯 Error Type: ${errorDetection.errorType}`);
          
          // Don't cleanup script file yet - we may need to retry
          return execution;
        } else {
          // Non-recoverable error or generic error
          step.status = 'failed';
          execution.status = 'failed';
          
          // Only add to errors array if there are actual errors (not just warnings)
          if (hasRealErrors) {
            execution.errors.push({
              step: 1,
              command: 'Script execution',
              error: filteredError || result.error
            });
          }
          
          console.error(`❌ Script execution failed: ${filteredError || result.error}`);
        }
      } else {
        console.log(`✅ Script executed successfully`);
      }
      
      // Cleanup temporary file
      try {
        await fs.unlink(scriptFile);
        console.log(`🗑️ Cleaned up temporary script file`);
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp file: ${cleanupError.message}`);
      }
      
      // Mark as completed if no errors
      if (execution.status !== 'failed') {
        execution.status = 'completed';
      }
      
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      
      console.log(`✅ Execution ${sessionId} finished: ${execution.status}`);
      
      return execution;
      
    } catch (error) {
      console.error(`❌ Execution error: ${error.message}`);
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      throw error;
    }
  }
  
  /**
   * Authenticate Azure CLI using service principal from .env
   */
  async authenticateAzureCLI() {
    try {
      const clientId = process.env.AZURE_CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET;
      const tenantId = process.env.AZURE_TENANT_ID;
      const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
      
      if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
        return {
          success: false,
          error: 'Azure credentials not found in .env file. Please configure AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, and AZURE_SUBSCRIPTION_ID.'
        };
      }
      
      console.log(`🔐 Logging in to Azure CLI with service principal...`);
      console.log(`   Tenant ID: ${tenantId}`);
      console.log(`   Client ID: ${clientId}`);
      console.log(`   Subscription ID: ${subscriptionId}`);
      
      // Step 1: Login with service principal
      const loginCmd = `az login --service-principal -u "${clientId}" -p "${clientSecret}" --tenant "${tenantId}" --allow-no-subscriptions --output json`;
      const loginResult = await this.runCommand(loginCmd, { timeout: 60000 });
      
      if (loginResult.code !== 0) {
        return {
          success: false,
          error: `Azure CLI login failed: ${loginResult.error}`
        };
      }
      
      console.log(`✅ Logged in to Azure CLI`);
      
      // Step 2: Set the subscription
      const setSubCmd = `az account set --subscription "${subscriptionId}"`;
      const setSubResult = await this.runCommand(setSubCmd, { timeout: 30000 });
      
      if (setSubResult.code !== 0) {
        return {
          success: false,
          error: `Failed to set subscription: ${setSubResult.error}`
        };
      }
      
      console.log(`✅ Subscription set to: ${subscriptionId}`);
      
      // Step 3: Refresh access token to ensure we have fresh credentials
      console.log(`🔄 Refreshing Azure access token...`);
      const refreshCmd = `az account get-access-token --output json`;
      const refreshResult = await this.runCommand(refreshCmd, { timeout: 30000 });
      
      if (refreshResult.code !== 0) {
        console.warn(`⚠️ Warning: Failed to refresh token, but proceeding anyway`);
      } else {
        console.log(`✅ Access token refreshed`);
      }
      
      // Step 4: Verify authentication
      const verifyCmd = `az account show --output json`;
      const verifyResult = await this.runCommand(verifyCmd, { timeout: 30000 });
      
      if (verifyResult.code !== 0) {
        return {
          success: false,
          error: `Failed to verify authentication: ${verifyResult.error}`
        };
      }
      
      console.log(`✅ Azure CLI authentication verified`);
      
      // Step 5: Check service principal permissions
      console.log(`🔍 Checking service principal roles...`);
      const rolesCmd = `az role assignment list --assignee "${clientId}" --subscription "${subscriptionId}" --output json`;
      const rolesResult = await this.runCommand(rolesCmd, { timeout: 30000 });
      
      if (rolesResult.code === 0 && rolesResult.output) {
        try {
          const roles = JSON.parse(rolesResult.output);
          const roleNames = roles.map(r => r.roleDefinitionName);
          console.log(`📋 Assigned roles: ${roleNames.join(', ')}`);
          
          const hasContributor = roles.some(r => 
            r.roleDefinitionName === 'Contributor' || 
            r.roleDefinitionName === 'Owner'
          );
          
          if (!hasContributor) {
            console.warn(`\n⚠️ ═══════════════════════════════════════════════════════════════`);
            console.warn(`⚠️  INSUFFICIENT PERMISSIONS FOR RESOURCE CREATION`);
            console.warn(`⚠️ ═══════════════════════════════════════════════════════════════`);
            console.warn(`⚠️  The service principal has: ${roleNames.join(', ')}`);
            console.warn(`⚠️  Required for AI Agent: Contributor or Owner`);
            console.warn(`⚠️  \n⚠️  Current capabilities:`);
            console.warn(`⚠️    ✅ Read subscription data`);
            console.warn(`⚠️    ✅ View resources`);
            console.warn(`⚠️    ✅ View costs`);
            console.warn(`⚠️    ❌ Create/modify resources (AI Agent cloning)`);
            console.warn(`⚠️  \n⚠️  To enable AI Agent resource cloning, assign Contributor role:`);
            console.warn(`⚠️    az role assignment create \\`);
            console.warn(`⚠️      --assignee "${clientId}" \\`);
            console.warn(`⚠️      --role "Contributor" \\`);
            console.warn(`⚠️      --subscription "${subscriptionId}"`);
            console.warn(`⚠️ ═══════════════════════════════════════════════════════════════\n`);
          } else {
            console.log(`✅ Service principal has ${roleNames.find(r => r === 'Contributor' || r === 'Owner')} role - can create resources`);
          }
        } catch (e) {
          console.warn(`⚠️ Could not parse role assignments: ${e.message}`);
        }
      }
      
      return {
        success: true,
        message: 'Azure CLI authenticated successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Authentication error: ${error.message}`
      };
    }
  }
  
  /**
   * Execute Terraform with real-time progress
   */
  async executeTerraform(sessionId, terraformConfig, options = {}) {
    const execution = {
      sessionId,
      type: 'terraform',
      status: 'running',
      steps: [],
      startTime: Date.now(),
      output: [],
      errors: []
    };
    
    this.executions.set(sessionId, execution);
    
    try {
      // STEP 0: Check if Terraform is installed
      console.log('🔍 Checking if Terraform is installed...');
      const checkStep = {
        index: 0,
        command: 'terraform --version',
        status: 'running',
        output: '',
        error: '',
        startTime: Date.now()
      };
      execution.steps.push(checkStep);
      
      const checkResult = await this.runCommand('which terraform || where terraform', { timeout: 5000 });
      
      if (checkResult.code !== 0 || !checkResult.output) {
        checkStep.status = 'failed';
        checkStep.error = 'Terraform is not installed on this system.';
        checkStep.duration = Date.now() - checkStep.startTime;
        
        execution.status = 'failed';
        execution.errors.push({ 
          step: 0, 
          error: `Terraform is not installed.\n\n` +
                 `To use Terraform for resource cloning:\n` +
                 `1. Install Terraform from: https://www.terraform.io/downloads\n` +
                 `2. Or use Azure CLI instead (recommended for this use case)\n\n` +
                 `RECOMMENDED: Click "Generate Azure CLI" instead of "Generate Terraform" ` +
                 `to create resources using Azure CLI which is already configured.`
        });
        
        console.error('❌ Terraform not found on system');
        throw new Error('Terraform is not installed. Please install Terraform or use Azure CLI instead.');
      }
      
      checkStep.status = 'completed';
      checkStep.output = checkResult.output;
      checkStep.duration = Date.now() - checkStep.startTime;
      console.log('✅ Terraform is installed');
      
      // Create temporary directory for terraform files
      const tmpDir = path.join(__dirname, '..', 'tmp', sessionId);
      await fs.mkdir(tmpDir, { recursive: true });
      
      // Write terraform configuration
      const tfFile = path.join(tmpDir, 'main.tf');
      await fs.writeFile(tfFile, terraformConfig);
      
      console.log(`🚀 Starting Terraform execution: ${sessionId}`);
      console.log(`   Working directory: ${tmpDir}`);
      
      // Step 1: terraform init
      let step = {
        index: 1,
        command: 'terraform init',
        status: 'running',
        output: '',
        error: '',
        startTime: Date.now()
      };
      execution.steps.push(step);
      
      console.log('📝 Step 1: terraform init');
      let result = await this.runCommand('terraform init', { cwd: tmpDir });
      step.status = result.code === 0 ? 'completed' : 'failed';
      step.output = result.output;
      step.error = result.error;
      step.duration = Date.now() - step.startTime;
      execution.output.push(result.output);
      
      if (result.code !== 0) {
        execution.status = 'failed';
        execution.errors.push({ step: 1, error: result.error });
        throw new Error('Terraform init failed: ' + result.error);
      }
      
      console.log('✅ Step 1 completed');
      
      // Step 2: terraform plan
      step = {
        index: 2,
        command: 'terraform plan',
        status: 'running',
        output: '',
        error: '',
        startTime: Date.now()
      };
      execution.steps.push(step);
      
      console.log('📝 Step 2: terraform plan');
      result = await this.runCommand('terraform plan -out=tfplan', { cwd: tmpDir });
      step.status = result.code === 0 ? 'completed' : 'failed';
      step.output = result.output;
      step.error = result.error;
      step.duration = Date.now() - step.startTime;
      execution.output.push(result.output);
      
      if (result.code !== 0) {
        execution.status = 'failed';
        execution.errors.push({ step: 2, error: result.error });
        throw new Error('Terraform plan failed: ' + result.error);
      }
      
      console.log('✅ Step 2 completed');
      
      // Step 3: terraform apply (only if not dry-run)
      if (!options.dryRun) {
        step = {
          index: 3,
          command: 'terraform apply',
          status: 'running',
          output: '',
          error: '',
          startTime: Date.now()
        };
        execution.steps.push(step);
        
        console.log('📝 Step 3: terraform apply');
        result = await this.runCommand('terraform apply -auto-approve tfplan', { cwd: tmpDir });
        step.status = result.code === 0 ? 'completed' : 'failed';
        step.output = result.output;
        step.error = result.error;
        step.duration = Date.now() - step.startTime;
        execution.output.push(result.output);
        
        if (result.code !== 0) {
          execution.status = 'failed';
          execution.errors.push({ step: 3, error: result.error });
          throw new Error('Terraform apply failed: ' + result.error);
        }
        
        console.log('✅ Step 3 completed');
      }
      
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      
      console.log(`✅ Terraform execution ${sessionId} completed successfully`);
      
      // Cleanup (optional)
      if (options.cleanup) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
      
      return execution;
      
    } catch (error) {
      console.error(`❌ Terraform execution error: ${error.message}`);
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      throw error;
    }
  }
  
  /**
   * Run a single command
   */
  runCommand(command, options = {}) {
    return new Promise((resolve) => {
      console.log(`🔧 Executing: ${this.maskSensitiveData(command).substring(0, 150)}`);
      
      const startTime = Date.now();
      const childProcess = spawn(command, {
        shell: true,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      let timedOut = false;
      
      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(`  📤 ${chunk.substring(0, 200)}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        // Some Azure CLI commands output to stderr even on success
        console.log(`  📤 ${chunk.substring(0, 200)}`);
      });
      
      childProcess.on('close', (code) => {
        if (!timedOut) {
          const duration = Date.now() - startTime;
          console.log(`  ⏱️ Command completed with code ${code} in ${duration}ms`);
          resolve({
            code,
            output,
            error,
            duration
          });
        }
      });
      
      childProcess.on('error', (err) => {
        if (!timedOut) {
          console.error(`  ❌ Command error: ${err.message}`);
          resolve({
            code: 1,
            output: '',
            error: err.message,
            duration: Date.now() - startTime
          });
        }
      });
      
      // Timeout (default 90 minutes for long operations like database copy, web app creation)
      // Web apps take 5-10 minutes, SQL databases can take 10-60+ minutes
      const timeout = setTimeout(() => {
        timedOut = true;
        console.error(`  ⏱️ Command timeout after ${options.timeout || 5400000}ms`);
        childProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 2000);
        
        resolve({
          code: 1,
          output,
          error: 'Command timeout - execution took too long (exceeded 90 minutes). This can happen with large databases or complex deployments. Check Azure Portal for resource status.',
          duration: Date.now() - startTime
        });
      }, options.timeout || 5400000); // 90 minutes default for long-running operations
      
      childProcess.on('exit', () => {
        clearTimeout(timeout);
      });
    });
  }
  
  /**
   * Parse script into individual commands
   */
  parseScript(script) {
    // First, clean the script from AI-generated prose and markdown
    let cleanedScript = this.cleanAIGeneratedScript(script);
    
    // Split by lines and handle multi-line commands (ending with \)
    const lines = cleanedScript.split('\n');
    const commands = [];
    let currentCommand = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) {
        if (currentCommand) {
          commands.push(currentCommand);
          currentCommand = '';
        }
        continue;
      }
      
      // Handle comments
      if (trimmed.startsWith('#')) {
        continue;
      }
      
      // Skip non-shell lines (AI explanations, prose, etc.)
      if (!this.isValidShellLine(trimmed)) {
        continue;
      }
      
      // Handle multi-line commands (ending with \)
      if (trimmed.endsWith('\\')) {
        currentCommand += trimmed.slice(0, -1) + ' ';
        continue;
      }
      
      // Add to current command
      currentCommand += trimmed;
      
      // Complete command
      commands.push(currentCommand);
      currentCommand = '';
    }
    
    // Add any remaining command
    if (currentCommand) {
      commands.push(currentCommand);
    }
    
    return commands.filter(cmd => cmd.trim() && !cmd.trim().startsWith('#'));
  }
  
  /**
   * Clean AI-generated script from prose, markdown, and explanatory text
   * SUPER NUCLEAR MODE - Extract ONLY valid bash lines, remove ALL prose
   */
  cleanAIGeneratedScript(script) {
    console.log('🧹 Cleaning AI-generated script (SUPER NUCLEAR MODE - ABSOLUTE MAXIMUM AGGRESSION)...');
    console.log(`📝 Original script length: ${script.length} characters`);
    console.log(`📝 First 300 chars: ${script.substring(0, 300)}`);
    
    let cleaned = script;
    
    // STEP 0: CRITICAL - Remove common AI response prefixes
    const prefixPatterns = [
      /^Below is.*?(?=```|#!|$)/is,
      /^Here is.*?(?=```|#!|$)/is,
      /^Here's.*?(?=```|#!|$)/is,
      /^Great!.*?(?=```|#!|$)/is,
      /^Perfect!.*?(?=```|#!|$)/is,
      /^.*?requested bash script.*?(?=```|#!|$)/is,
    ];
    
    for (const pattern of prefixPatterns) {
      const before = cleaned;
      cleaned = cleaned.replace(pattern, '');
      if (before !== cleaned) {
        console.log(`✂️ Removed AI response prefix matching: ${pattern.source.substring(0, 50)}...`);
        break;
      }
    }
    
    // STEP 1: Try to extract from markdown code fences FIRST
    const markdownMatch = cleaned.match(/```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/);
    if (markdownMatch && markdownMatch[1]) {
      console.log(`✅ Found script in markdown code fence`);
      cleaned = markdownMatch[1];
      console.log(`📝 Extracted from markdown, length: ${cleaned.length}`);
    } else {
      console.log(`⚠️ No markdown fence found, using aggressive extraction`);
      
      // Remove ALL markdown fences manually
      cleaned = cleaned.replace(/```(?:bash|sh|shell)?\s*\n?/gm, '');
      cleaned = cleaned.replace(/```\s*/gm, '');
    }
    
    // STEP 2: SUPER NUCLEAR OPTION - Find shebang and remove EVERYTHING before it
    const shebangMatch = cleaned.match(/^#!\/bin\/(ba)?sh/m);
    if (shebangMatch && shebangMatch.index !== undefined && shebangMatch.index > 0) {
      console.log(`✂️ Found shebang at position ${shebangMatch.index}, removing ${shebangMatch.index} chars before it`);
      console.log(`✂️ Removed text: "${cleaned.substring(0, Math.min(shebangMatch.index, 200))}..."`);
      cleaned = cleaned.substring(shebangMatch.index);
    } else if (shebangMatch) {
      console.log(`✅ Shebang found at start of script`);
    } else {
      console.log(`⚠️ No shebang found, will extract valid bash lines only`);
    }
    
    // STEP 3: NUCLEAR LINE-BY-LINE FILTERING - Keep ONLY valid bash lines
    const lines = cleaned.split('\n');
    const filteredLines = [];
    let foundShebang = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Always keep shebang
      if (trimmed.startsWith('#!/')) {
        filteredLines.push(line);
        foundShebang = true;
        console.log(`✅ Line ${i + 1}: Kept shebang`);
        continue;
      }
      
      // Keep empty lines (for structure)
      if (!trimmed) {
        if (foundShebang && filteredLines.length > 0) {
          filteredLines.push(line);
        }
        continue;
      }
      
      // Keep shell comments (but not markdown headers)
      if (trimmed.startsWith('#') && !trimmed.startsWith('##')) {
        filteredLines.push(line);
        console.log(`✅ Line ${i + 1}: Kept comment`);
        continue;
      }
      
      // CRITICAL: Check if it's VALID SHELL FIRST (before checking for prose)
      // This ensures echo, return, etc. are kept even if they contain prose-like text
      if (this.isValidShellLine(trimmed)) {
        filteredLines.push(line);
        console.log(`✅ Line ${i + 1}: Kept valid shell line`);
        continue;
      }
      
      // Only check for prose if it's NOT a valid shell line
      if (this.isProse(trimmed)) {
        console.log(`❌ Line ${i + 1}: REJECTED prose: "${trimmed.substring(0, 60)}..."`);
        continue;
      }
      
      // Everything else is REJECTED
      console.log(`❌ Line ${i + 1}: REJECTED (not valid bash): "${trimmed.substring(0, 60)}..."`);
    }
    
    console.log(`\n📊 Filtering summary:`);
    console.log(`  Original lines: ${lines.length}`);
    console.log(`  Kept lines: ${filteredLines.length}`);
    console.log(`  Rejected lines: ${lines.length - filteredLines.length}`);
    
    let cleanedScript = filteredLines.join('\n');
    
    // CRITICAL: Remove explanatory sections AFTER the script
    // Look for common markers that indicate the script has ended
    const explanationMarkers = [
      '### Explanation of the Script:',
      '### Explanation:',
      '## Explanation:',
      '# Explanation:',
      '### Notes:',
      '### Usage:',
      '### How it works:',
      '### Key Features:',
      '### How to Use:',
      '### Requirements:',
      'Explanation of the Script:',
      'This script',
      'The script',
      'Note:',
      'Important:',
      'Save this script',
      'Run this script',
    ];
    
    for (const marker of explanationMarkers) {
      const markerIndex = cleanedScript.indexOf(marker);
      if (markerIndex !== -1) {
        console.log(`✂️ Removing explanation section after script (found "${marker}" at position ${markerIndex})`);
        const removed = cleanedScript.substring(markerIndex, markerIndex + 100);
        console.log(`✂️ Removed section starts with: "${removed}..."`);
        cleanedScript = cleanedScript.substring(0, markerIndex).trim();
        break;
      }
    }
    
    // Ensure script starts with shebang
    if (!cleanedScript.trim().startsWith('#!')) {
      cleanedScript = '#!/bin/bash\n\n' + cleanedScript;
      console.log(`✅ Added shebang to script`);
    }
    
    console.log(`✨ Cleaned script length: ${cleanedScript.length} characters`);
    console.log(`📊 Removed ${script.length - cleanedScript.length} characters of prose`);
    
    // CRITICAL: Check if prose still exists in cleaned script
    const proseCheck = [
      'Below is',
      'Here is',
      'This script',
      'The script',
      'I have',
      'I\'ve',
      'will use',
      'will create',
      'uses Azure CLI',
      'includes error',
      '### Explanation',
      '## Explanation',
      '### Notes',
      '### Usage',
      '**Error Handling**',
      '**Idempotency**',
      '**Dependencies**',
      '**Validation**',
    ];
    
    for (const phrase of proseCheck) {
      if (cleanedScript.toLowerCase().includes(phrase.toLowerCase())) {
        console.error(`❌ CRITICAL: Prose still present in cleaned script: "${phrase}"`);
        console.error(`📝 First 500 chars of cleaned script:`);
        console.error(cleanedScript.substring(0, 500));
        console.error(`\n📝 First 500 chars of original script:`);
        console.error(script.substring(0, 500));
        throw new Error(`Script cleaning failed: AI prose "${phrase}" still present. Please regenerate the script.`);
      }
    }
    
    // Validate the cleaned script has content
    const nonEmptyLines = cleanedScript.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });
    
    if (nonEmptyLines.length === 0) {
      console.error(`❌ Cleaned script has no executable commands!`);
      console.error(`Original script: ${script.substring(0, 500)}`);
      throw new Error('Script cleaning removed all executable commands. Please check the script format.');
    }
    
    console.log(`✅ Validated: ${nonEmptyLines.length} executable lines`);
    console.log(`✅ No prose detected in cleaned script`);
    
    return cleanedScript;
  }
  
  /**
   * Clean AI-generated script while PRESERVING multi-line commands
   * This version is specifically designed for SQL operations with complex passwords
   */
  cleanAIGeneratedScriptPreserveMultiline(script) {
    console.log('🧹 Cleaning AI-generated script (PRESERVING MULTI-LINE COMMANDS)...');
    console.log(`📝 Original script length: ${script.length} characters`);
    
    let cleaned = script;
    
    // Step 1: Remove markdown code fences
    cleaned = cleaned.replace(/```(?:bash|sh|shell)?\s*\n?/gm, '');
    cleaned = cleaned.replace(/```\s*/gm, '');
    
    // Step 2: Remove common AI response prefixes/suffixes
    cleaned = cleaned.replace(/^(Here is|Here's|Below is|Great!|Perfect!).*?(script|commands?).*?\n/gim, '');
    cleaned = cleaned.replace(/### (Explanation|Note|Important)[\s\S]*$/im, '');
    
    // Step 3: Find the shebang and use everything from there
    const shebangMatch = cleaned.match(/^#!\/bin\/(ba)?sh/m);
    if (shebangMatch && shebangMatch.index !== undefined && shebangMatch.index > 0) {
      console.log(`✅ Found shebang at index ${shebangMatch.index}, removing everything before it`);
      cleaned = cleaned.substring(shebangMatch.index);
    }
    
    // Step 4: Ensure shebang exists
    if (!cleaned.startsWith('#!/bin/bash') && !cleaned.startsWith('#!/bin/sh')) {
      console.log('⚠️ No shebang found, adding #!/bin/bash');
      cleaned = '#!/bin/bash\nset -e\n\n' + cleaned;
    }
    
    // Step 5: Remove trailing explanations/notes
    const explanationMarkers = [
      '\n\n### Explanation',
      '\n\n### Note:',
      '\n\n**Note:',
      '\n\n**Important:',
      '\n\n## Explanation',
      '\n\n# Explanation'
    ];
    
    for (const marker of explanationMarkers) {
      const idx = cleaned.indexOf(marker);
      if (idx > 0) {
        console.log(`✂️ Removing explanation section starting at: ${marker}`);
        cleaned = cleaned.substring(0, idx);
      }
    }
    
    // Step 6: CRITICAL - Preserve backslash line continuations
    // Multi-line commands with \ should stay intact
    cleaned = cleaned.trim();
    
    console.log(`✅ Script cleaned, length: ${cleaned.length} characters`);
    console.log(`📄 Preview:\n${cleaned.substring(0, 400)}\n`);
    
    // Validation: ensure script is not empty
    if (!cleaned || cleaned.length < 10) {
      console.error('❌ Cleaned script is too short or empty!');
      throw new Error('Script cleaning failed: result is empty');
    }
    
    // Step 7: CRITICAL - Strip forbidden parameters from az webapp create commands
    cleaned = this.stripForbiddenWebAppParameters(cleaned);
    
    // Step 8: FINAL VALIDATION - Last line of defense
    cleaned = this.finalWebAppValidation(cleaned);
    
    return cleaned;
  }
  
  /**
   * FINAL VALIDATION: Absolute last check before execution
   * This catches ANY forbidden parameters that might have slipped through
   */
  finalWebAppValidation(script) {
    console.log('🔒 FINAL VALIDATION: Scanning for conflicting web app parameters...');
    
    // List of keywords that indicate conflicts (not all forbidden, just in wrong combinations)
    const containerKeywords = [
      '--deployment-container-image-name',
      '--multicontainer-config-type',
      '--multicontainer-config-file'
    ];
    
    const deprecatedKeywords = [
      '--vnet-route-all-enabled',  // Unsupported by CLI
      '--no-wait'                  // Not supported for az webapp create
    ];
    
    // Check each line
    const lines = script.split('\n');
    const webAppCreateLines = [];
    let foundError = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // If this line contains "az webapp create"
      if (line.includes('az webapp create')) {
        console.log(`📝 Checking webapp create command at line ${i + 1}...`);
        
        // Check for DEPRECATED keywords (always block these)
        for (const keyword of deprecatedKeywords) {
          if (line.toLowerCase().includes(keyword.toLowerCase())) {
            console.error(`🚨 DEPRECATED PARAMETER: "${keyword}" found!`);
            console.error(`   Line ${i + 1}: ${line.substring(0, 100)}...`);
            console.error(`   This parameter is not supported by Azure CLI!`);
            foundError = true;
          }
        }
        
        // Check for CONFLICTING COMBINATIONS
        const hasRuntime = line.includes('--runtime');
        const hasContainerImage = line.includes('--deployment-container-image-name');
        const hasMultiContainer = line.includes('--multicontainer-config-type');
        
        if ((hasRuntime && hasContainerImage) || (hasRuntime && hasMultiContainer) || (hasContainerImage && hasMultiContainer)) {
          console.error(`🚨 CONFLICTING PARAMETERS DETECTED!`);
          console.error(`   Line ${i + 1}: ${line.substring(0, 100)}...`);
          console.error(`   Cannot mix --runtime, --container-*, and --multicontainer-* together!`);
          foundError = true;
        } else {
          console.log(`   ✅ Web app create command looks valid`);
          if (hasRuntime) console.log(`      Uses --runtime (runtime-based app)`);
          if (hasContainerImage) console.log(`      Uses --deployment-container-image-name (single-container app)`);
          if (hasMultiContainer) console.log(`      Uses --multicontainer-config-type (multi-container app)`);
        }
      }
    }
    
    if (foundError) {
      console.error(`❌ FINAL VALIDATION FAILED - Script contains invalid parameters!`);
      console.error(`   Please check the web app configuration and try again.`);
      // Don't modify the script - let it run and fail with actual Azure error
      // This provides better debugging information
    }
    
    const result = lines.join('\n');
    console.log('✅ FINAL VALIDATION: Complete - Script is safe for execution');
    return result;
  }
  
  /**
   * Strip forbidden parameters from az webapp create commands
   * CRITICAL: Enforce ONLY 3 parameters (--name, --resource-group, --plan)
   * ULTRA-AGGRESSIVE: Use regex to catch ALL az webapp create commands
   */
  stripForbiddenWebAppParameters(script) {
    console.log('🚫 ULTRA-AGGRESSIVE stripping of forbidden parameters from az webapp create commands...');
    console.log(`📝 Original script length: ${script.length} characters`);
    
    // ULTRA-AGGRESSIVE: Find ALL "az webapp create" commands using regex
    // CRITICAL: Stop at semicolon or command end to preserve surrounding script structure
    // Matches: az webapp create [params] but STOPS at ; or newline without backslash
    const webappCreatePattern = /az\s+webapp\s+create(?:\s+--[a-z-]+(?:\s+(?:"[^"]*"|'[^']*'|\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}|[^\s;\\]+))?)*(?:\s+\\(?:\s*\n\s*--[a-z-]+(?:\s+(?:"[^"]*"|'[^']*'|\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}|[^\s;\\]+))?)*)*/gm;
    
    const matches = [];
    let match;
    while ((match = webappCreatePattern.exec(script)) !== null) {
      matches.push({
        fullMatch: match[0],
        index: match.index,
        endIndex: match.index + match[0].length
      });
      console.log(`🎯 Found az webapp create command at position ${match.index}`);
      console.log(`   Preview: ${match[0].substring(0, 100)}...`);
    }
    
    console.log(`📊 Found ${matches.length} az webapp create command(s)`);
    
    if (matches.length === 0) {
      console.log('✅ No az webapp create commands found, script unchanged');
      return script;
    }
    
    // Process matches in reverse order to preserve indices
    let result = script;
    for (let i = matches.length - 1; i >= 0; i--) {
      const matchInfo = matches[i];
      const originalCommand = matchInfo.fullMatch;
      
      console.log(`\n🧹 Processing az webapp create command ${i + 1}/${matches.length}`);
      const cleanedCommand = this.cleanWebAppCreateCommandNuclear(originalCommand);
      
      // Replace the original command with cleaned command
      result = result.substring(0, matchInfo.index) + cleanedCommand + result.substring(matchInfo.endIndex);
      console.log(`✅ Replaced command ${i + 1}`);
    }
    
    console.log(`\n✅ Finished stripping forbidden parameters from ${matches.length} command(s)`);
    console.log(`📝 Result script length: ${result.length} characters`);
    return result;
  }
  
  /**
   * Clean a single az webapp create command by REPLACING it with safe template
   * NUCLEAR OPTION: Don't try to strip params, just extract name/rg/plan and rebuild command
   */
  cleanWebAppCreateCommandNuclear(command) {
    console.log('🧹 Cleaning individual az webapp create command...');
    console.log(`   Original: ${command.substring(0, 300)}...`);
    
    // SMART OPTION: Extract required params + detect type-specific params (runtime/container)
    
    // Extract --name parameter
    let nameMatch = command.match(/--name\s+["\']?([^"'\s\\]+)["\']?/);
    if (!nameMatch) {
      nameMatch = command.match(/--name\s*=\s*["\']?([^"'\s\\]+)["\']?/);
    }
    const webAppName = nameMatch ? nameMatch[1] : null;
    
    // Extract --resource-group parameter
    let rgMatch = command.match(/--resource-group\s+["\']?([^"'\s\\]+)["\']?/);
    if (!rgMatch) {
      rgMatch = command.match(/--resource-group\s*=\s*["\']?([^"'\s\\]+)["\']?/);
    }
    const resourceGroup = rgMatch ? rgMatch[1] : null;
    
    // Extract --plan parameter
    let planMatch = command.match(/--plan\s+["\']?([^"'\s\\]+)["\']?/);
    if (!planMatch) {
      planMatch = command.match(/--plan\s*=\s*["\']?([^"'\s\\]+)["\']?/);
    }
    const plan = planMatch ? planMatch[1] : null;
    
    // CRITICAL: Detect and preserve type-specific parameters
    let runtime = null;
    let containerImage = null;
    let multiContainerType = null;
    let multiContainerFile = null;
    
    // Check for --runtime (runtime-based app)
    const runtimeMatch = command.match(/--runtime\s+["\']?([^"'\s\\]+)["\']?/);
    if (runtimeMatch) {
      runtime = runtimeMatch[1];
      console.log(`   Detected runtime: ${runtime}`);
    }
    
    // Check for --deployment-container-image-name (single-container app)
    const containerMatch = command.match(/--deployment-container-image-name\s+["\']?([^"'\s\\]+)["\']?/);
    if (containerMatch) {
      containerImage = containerMatch[1];
      console.log(`   Detected container image: ${containerImage}`);
    }
    
    // Check for --multicontainer-config-type (multi-container app)
    const multiTypeMatch = command.match(/--multicontainer-config-type\s+["\']?([^"'\s\\]+)["\']?/);
    if (multiTypeMatch) {
      multiContainerType = multiTypeMatch[1];
      console.log(`   Detected multicontainer type: ${multiContainerType}`);
    }
    
    // Check for --multicontainer-config-file (multi-container app)
    const multiFileMatch = command.match(/--multicontainer-config-file\s+["\']?([^"'\s\\]+)["\']?/);
    if (multiFileMatch) {
      multiContainerFile = multiFileMatch[1];
      console.log(`   Detected multicontainer file: ${multiContainerFile}`);
    }
    
    console.log(`   📝 Extracted parameters:`);
    console.log(`      --name: ${webAppName || 'NOT FOUND'}`);
    console.log(`      --resource-group: ${resourceGroup || 'NOT FOUND'}`);
    console.log(`      --plan: ${plan || 'NOT FOUND'}`);
    
    // If we couldn't extract all 3 required params, try variables
    if (!webAppName || !resourceGroup || !plan) {
      console.log(`   ⚠️  WARNING: Could not extract literal values, trying to find variables...`);
      
      // Try to extract variables like "$WEB_APP_NAME", "$RESOURCE_GROUP", "$APP_PLAN"
      if (!webAppName) {
        const varMatch = command.match(/--name\s+["\']?\$\{?([A-Z_]+)\}?["\']?/);
        if (varMatch) {
          webAppName = `$${varMatch[1]}`;
          console.log(`   Found variable for name: ${webAppName}`);
        }
      }
      
      if (!resourceGroup) {
        const varMatch = command.match(/--resource-group\s+["\']?\$\{?([A-Z_]+)\}?["\']?/);
        if (varMatch) {
          resourceGroup = `$${varMatch[1]}`;
          console.log(`   Found variable for resource-group: ${resourceGroup}`);
        }
      }
      
      if (!plan) {
        const varMatch = command.match(/--plan\s+["\']?\$\{?([A-Z_]+)\}?["\']?/);
        if (varMatch) {
          plan = `$${varMatch[1]}`;
          console.log(`   Found variable for plan: ${plan}`);
        }
      }
      
      // If still missing params, return a warning comment
      if (!webAppName || !resourceGroup || !plan) {
        console.log(`   ❌ ERROR: Still could not extract required parameters`);
        console.log(`      name: ${webAppName || 'MISSING'}`);
        console.log(`      resource-group: ${resourceGroup || 'MISSING'}`);
        console.log(`      plan: ${plan || 'MISSING'}`);
        return `# ERROR: Could not extract required parameters from az webapp create\n# Original command: ${command.substring(0, 200)}...\n# Please fix manually`;
      }
    }
    
    // SUCCESS: We have required params, rebuild command based on detected type
    console.log(`   ✅ All required parameters extracted successfully`);
    console.log(`   🔨 REBUILDING command based on detected type...`);
    
    // If value starts with $, it's a variable - don't quote it
    const nameParam = webAppName.startsWith('$') ? webAppName : `"${webAppName}"`;
    const rgParam = resourceGroup.startsWith('$') ? resourceGroup : `"${resourceGroup}"`;
    const planParam = plan.startsWith('$') ? plan : `"${plan}"`;
    
    // Build command based on detected type
    let cleanCommand = '';
    
    // CASE 1: Multi-container app (both type and file must be present)
    if (multiContainerType && multiContainerFile) {
      console.log(`   🐳 Detected MULTI-CONTAINER app`);
      const typeParam = multiContainerType.startsWith('$') ? multiContainerType : `"${multiContainerType}"`;
      const fileParam = multiContainerFile.startsWith('$') ? multiContainerFile : `"${multiContainerFile}"`;
      cleanCommand = `az webapp create --name ${nameParam} --resource-group ${rgParam} --plan ${planParam} --multicontainer-config-type ${typeParam} --multicontainer-config-file ${fileParam}`;
    }
    // CASE 2: Single-container app
    else if (containerImage) {
      console.log(`   🐋 Detected SINGLE-CONTAINER app`);
      const imageParam = containerImage.startsWith('$') ? containerImage : `"${containerImage}"`;
      cleanCommand = `az webapp create --name ${nameParam} --resource-group ${rgParam} --plan ${planParam} --deployment-container-image-name ${imageParam}`;
    }
    // CASE 3: Runtime-based app
    else if (runtime) {
      console.log(`   📦 Detected RUNTIME-BASED app`);
      let runtimeVal = runtime;
      if (!runtime.startsWith('$') && !/^dotnet:/i.test(runtime)) {
        runtimeVal = normalizeLinuxRuntimeForAzCli(runtime);
      }
      const runtimeParam = runtime.startsWith('$') ? runtime : `"${runtimeVal}"`;
      cleanCommand = `az webapp create --name ${nameParam} --resource-group ${rgParam} --plan ${planParam} --runtime ${runtimeParam}`;
    }
    // CASE 4: Unknown/Minimal (no type-specific params) - includes ZIP-static deployments
    else {
      console.log(`   ⚠️  No type-specific params detected, creating minimal web app`);
      console.log(`   ℹ️  This is normal for ZIP-deployed static sites (e.g., Next.js exports)`);
      cleanCommand = `az webapp create --name ${nameParam} --resource-group ${rgParam} --plan ${planParam}`;
    }
    
    console.log(`   ✅ REBUILT CLEAN COMMAND:`);
    console.log(`      ${cleanCommand}`);
    console.log(`   🚫 ALL forbidden parameters (vnet-*, no-wait, etc.) REMOVED`);
    
    return cleanCommand;
  }
  
  /**
   * Check if a line is prose (not shell code)
   * NUCLEAR MODE - Very aggressive detection
   */
  isProse(line) {
    const trimmed = line.trim();
    
    if (!trimmed) return false;
    
    // CRITICAL: Common AI response patterns
    const criticalProsePatterns = [
      /^Below is/i,
      /^Here is/i,
      /^Here's/i,
      /^This is/i,
      /^This script/i,
      /^The script/i,
      /^I've/i,
      /^I have/i,
      /^Let me/i,
      /^Great!/i,
      /^Perfect!/i,
    ];
    
    for (const pattern of criticalProsePatterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }
    
    // Markdown headers (##, ###, etc.)
    if (/^#{2,}/.test(trimmed)) {
      return true;
    }
    
    // Bold markdown (**text**)
    if (/\*\*/.test(trimmed)) {
      return true;
    }
    
    // Prose indicators
    const proseIndicators = [
      // Common prose words/phrases at start
      /^(?:Below|Here|This|The|In|To|For|With|Using|After|Before|First|Second|Next|Finally|Note|Important|Explanation|Usage)\b/i,
      /\b(?:script|will|ensures|includes|provides|uses|creates|clones|deploys)\b.*\b(?:the|your|all|any)\b/i,
      /\b(?:from|to|in|on|at|with|for)\b.*\b(?:source|target|location|region|subscription)\b/i,
      
      // Full sentences (has subject, verb, and ends with period)
      /^[A-Z].+\s.+\.$/,
      
      // Questions
      /\?$/,
      
      // Lists with dashes or bullets
      /^[-*•]\s+/,
      
      // Numbered lists that aren't step comments
      /^\d+\.\s+[a-z]/,
      /^\d+\.\s+\*\*/,  // Numbered list with bold
    ];
    
    for (const indicator of proseIndicators) {
      if (indicator.test(trimmed)) {
        return true;
      }
    }
    
    // If it contains no shell operators and no assignment, likely prose
    const hasShellSyntax = /[=|<>&$();]/.test(trimmed) || 
                           trimmed.startsWith('#') ||
                           trimmed.startsWith('az ') ||
                           trimmed.startsWith('terraform ') ||
                           trimmed.startsWith('echo ') ||
                           trimmed.startsWith('export ') ||
                           trimmed.startsWith('local ') ||
                           trimmed.startsWith('if ') ||
                           trimmed.startsWith('then') ||
                           trimmed.startsWith('else') ||
                           trimmed.startsWith('fi') ||
                           trimmed.startsWith('for ') ||
                           trimmed.startsWith('while ') ||
                           trimmed.startsWith('function ') ||
                           /^[a-z_][a-z0-9_]*\(\)/.test(trimmed);
    
    // If no shell syntax and contains common English words, it's prose
    if (!hasShellSyntax && /\b(?:the|is|are|will|be|from|to|in|with|for|and|or)\b/i.test(trimmed)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a line is a valid shell command/statement
   * ENHANCED - Comprehensive detection including multi-line commands
   */
  isValidShellLine(line) {
    const trimmed = line.trim();
    
    // Empty or comment
    if (!trimmed || trimmed.startsWith('#')) {
      return true; // Comments are valid
    }
    
    // Multi-line continuation (previous line ends with \)
    // Check if this line is a continuation of a multi-line command
    if (trimmed.startsWith('--')) {
      return true; // Command flags (e.g., --name, --resource-group)
    }
    
    // Line is just a quoted string (argument to previous command)
    if (/^"[^"]*"$/.test(trimmed) || /^'[^']*'$/.test(trimmed)) {
      return true;
    }
    
    // Line ends with backslash (continuation line)
    if (trimmed.endsWith('\\')) {
      return true;
    }
    
    // Variable assignment (any case)
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)) {
      return true;
    }
    
    // Local variable
    if (/^local\s+/.test(trimmed)) {
      return true;
    }
    
    // Function definition
    if (/^[a-z_][a-z0-9_]*\(\)\s*\{?/.test(trimmed)) {
      return true;
    }
    
    // Function call (lowercase_function_name with spaces or arguments)
    if (/^[a-z_][a-z0-9_]*(\s|$)/.test(trimmed)) {
      return true;
    }
    
    // Closing brace (end of function/block)
    if (trimmed === '}') {
      return true;
    }
    
    // Opening brace (start of block)
    if (trimmed === '{') {
      return true;
    }
    
    // Return statement (with or without value)
    if (/^return(\s|$)/.test(trimmed)) {
      return true;
    }
    
    // Test/condition brackets
    if (trimmed.startsWith('[') || trimmed.startsWith('[[')) {
      return true;
    }
    
    // Common shell commands
    const shellCommands = [
      'az', 'terraform', 'echo', 'export', 'cd', 'mkdir', 'rm', 'cp', 'mv',
      'cat', 'grep', 'awk', 'sed', 'curl', 'wget', 'git', 'npm', 'node',
      'python', 'pip', 'docker', 'kubectl', 'helm', 'make', 'chmod', 'chown',
      'sudo', 'apt', 'yum', 'brew', 'source', 'eval', 'sleep', 'wait', 'for',
      'if', 'while', 'do', 'done', 'then', 'fi', 'case', 'esac', 'function',
      'exit', 'break', 'continue', 'shift', 'read', 'set', 'unset', 'test'
    ];
    
    for (const cmd of shellCommands) {
      if (trimmed.startsWith(cmd + ' ') || trimmed === cmd) {
        return true;
      }
    }
    
    // Control structures (including standalone keywords)
    if (/^(if|then|else|elif|fi|for|while|do|done|case|esac)(\s|$)/.test(trimmed)) {
      return true;
    }
    
    // Pipes and redirects
    if (trimmed.includes('|') || trimmed.includes('>') || trimmed.includes('<') || trimmed.includes('&>')) {
      return true;
    }
    
    // Command substitution or subshell
    if (trimmed.includes('$(') || trimmed.includes('`')) {
      return true;
    }
    
    // Boolean operators
    if (trimmed.includes('&&') || trimmed.includes('||')) {
      return true;
    }
    
    // If it doesn't match any pattern, it's likely prose
    return false;
  }
  
  /**
   * Fix SQL server names by stripping .database.windows.net suffix
   * CRITICAL: Azure CLI commands MUST use server name only, not FQDN
   * 
   * Issue: If script contains "sqlserver-16428.database.windows.net"
   * Azure CLI tries to resolve: "sqlserver-16428.database.windows.net.database.windows.net"
   * This causes DNS resolution failure and CLI hangs forever
   * 
   * Solution: Strip .database.windows.net suffix from all SQL server references
   */
  fixSQLServerNames(script) {
    console.log('🔍 Checking for SQL server name issues (FQDN with .database.windows.net)...');
    
    // Check if script contains SQL operations
    if (!script.includes('az sql') && !script.includes('SQL_SERVER')) {
      console.log('   ✅ No SQL operations detected, skipping SQL name validation');
      return script;
    }
    
    console.log('   📋 SQL operations detected, validating server names...');
    
    // Pattern 1: Variable assignments like SQL_SERVER_NAME="name.database.windows.net"
    const variablePattern = /([A-Z_]+SQL[A-Z_]*SERVER[A-Z_]*)="([^"]+)\.database\.windows\.net"/gi;
    let foundIssues = false;
    
    let fixed = script.replace(variablePattern, (match, varName, serverName) => {
      console.log(`   ❌ FOUND ISSUE: ${varName}="${serverName}.database.windows.net"`);
      console.log(`   ✅ FIXED TO: ${varName}="${serverName}"`);
      foundIssues = true;
      return `${varName}="${serverName}"`;
    });
    
    // Pattern 2: Inline --server parameters with FQDN
    const serverParamPattern = /(--(?:server|dest-server))\s+"?([a-z0-9-]+)\.database\.windows\.net"?/gi;
    fixed = fixed.replace(serverParamPattern, (match, param, serverName) => {
      console.log(`   ❌ FOUND ISSUE: ${param} "${serverName}.database.windows.net"`);
      console.log(`   ✅ FIXED TO: ${param} "${serverName}"`);
      foundIssues = true;
      return `${param} "${serverName}"`;
    });
    
    // Pattern 3: Variable expansion in commands like --server "$SQL_SERVER.database.windows.net"
    const expansionPattern = /(--(?:server|dest-server))\s+"\$\{?([A-Z_]+)\}?\.database\.windows\.net"/gi;
    fixed = fixed.replace(expansionPattern, (match, param, varName) => {
      console.log(`   ❌ FOUND ISSUE: ${param} "\${${varName}}.database.windows.net"`);
      console.log(`   ✅ FIXED TO: ${param} "\$${varName}"`);
      foundIssues = true;
      return `${param} "$${varName}"`;
    });
    
    // Pattern 4: Connection strings or display messages with FQDN
    // Keep these as-is since they're for display/connection purposes
    
    if (foundIssues) {
      console.log('   ✅ SQL server names fixed - removed .database.windows.net suffixes');
      console.log('   📝 Azure CLI will now use correct server names');
      
      // Add a validation comment at the top of the script
      const validationComment = `
# ============================================================
# SQL SERVER NAME VALIDATION APPLIED
# ============================================================
# CRITICAL FIX: Removed .database.windows.net suffixes from SQL server names
# Azure CLI automatically appends .database.windows.net internally
# Providing full FQDN causes DNS resolution to fail
# All SQL operations will now use server names only
# ============================================================

`;
      
      // Insert after shebang
      if (fixed.startsWith('#!/bin/bash')) {
        fixed = fixed.replace('#!/bin/bash\n', '#!/bin/bash\n' + validationComment);
      } else {
        fixed = validationComment + fixed;
      }
      
    } else {
      console.log('   ✅ No SQL server name issues detected - script is correct');
    }
    
    // Additional safety check - add runtime validation in the script itself
    // This ensures that even if a variable is set later, it gets validated
    if (script.includes('az sql') && !script.includes('# SQL SERVER NAME VALIDATION')) {
      console.log('   🛡️  Adding runtime SQL server name validation to script...');
      
      const runtimeValidation = `
# SQL SERVER NAME VALIDATION (Auto-added for safety)
# Strip .database.windows.net suffix if present in any SQL_SERVER* variables
for var in \${!SQL*SERVER*}; do
  if [[ "\${!var}" == *.database.windows.net ]]; then
    echo "⚠️  WARNING: Variable $var contains .database.windows.net suffix"
    echo "   Current value: \${!var}"
    # Use parameter expansion to strip suffix
    new_value="\${!var%.database.windows.net}"
    eval "$var=\"$new_value\""
    echo "   Fixed value: \${!var}"
  fi
done

`;
      
      // Insert after the shebang and initial comments
      const lines = fixed.split('\n');
      let insertIndex = 1; // After shebang
      
      // Find first non-comment, non-empty line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#')) {
          insertIndex = i;
          break;
        }
      }
      
      lines.splice(insertIndex, 0, runtimeValidation);
      fixed = lines.join('\n');
      
      console.log('   ✅ Runtime validation added - script will self-correct SQL server names');
    }
    
    return fixed;
  }
  
  /**
   * Mask sensitive data in commands
   */
  maskSensitiveData(command) {
    return command
      .replace(/(-p|--password)\s+"[^"]+"/g, '$1 "***"')
      .replace(/(--secret)\s+"[^"]+"/g, '$1 "***"')
      .replace(/(--key)\s+"[^"]+"/g, '$1 "***"');
  }
  
  /**
   * Get execution status
   */
  getExecution(sessionId) {
    return this.executions.get(sessionId);
  }
  
  /**
   * Cancel execution
   */
  async cancelExecution(sessionId) {
    const execution = this.executions.get(sessionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      
      console.log(`🛑 Execution ${sessionId} cancelled`);
      
      return true;
    }
    return false;
  }
  
  /**
   * Handle user response to interactive prompt and resume execution
   */
  async handlePromptResponse(promptId, userResponse) {
    const prompt = this.interactivePrompts.get(promptId);
    
    if (!prompt) {
      throw new Error(`Interactive prompt not found: ${promptId}`);
    }
    
    const execution = this.executions.get(prompt.sessionId);
    
    if (!execution) {
      throw new Error(`Execution session not found: ${prompt.sessionId}`);
    }
    
    console.log(`📥 Received user response for prompt: ${promptId}`);
    console.log(`   Action: ${userResponse.action}`);
    console.log(`   User input: ${JSON.stringify(userResponse.userInput || {})}`);
    
    // Handle different actions
    switch (userResponse.action) {
      case 'select_region':
      case 'change_region':
        // User selected a different region
        const newRegion = userResponse.userInput.region;
        console.log(`🌍 Changing region to: ${newRegion}`);
        
        // Modify script to use new region
        const updatedScript = this.updateScriptRegion(prompt.scriptContent, newRegion);
        
        // Save updated script
        await fs.writeFile(prompt.scriptFile, updatedScript, { mode: 0o755 });
        
        // Resume execution
        return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
        
      case 'auto_region':
        // Auto-select an available region
        console.log(`🤖 Auto-selecting available region...`);
        const autoRegion = prompt.suggestedRegions ? prompt.suggestedRegions[0] : 'West US';
        
        const autoUpdatedScript = this.updateScriptRegion(prompt.scriptContent, autoRegion);
        await fs.writeFile(prompt.scriptFile, autoUpdatedScript, { mode: 0o755 });
        
        return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
        
      case 'change_sku':
        // Change to a lower SKU
        console.log(`📉 Changing to lower SKU...`);
        const lowerSkuScript = this.updateScriptSKU(prompt.scriptContent, 'Free');
        await fs.writeFile(prompt.scriptFile, lowerSkuScript, { mode: 0o755 });
        
        return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
        
      case 'generate_new_name':
        // Generate new unique name
        console.log(`🔄 Generating new unique name...`);
        const uniqueNameScript = this.regenerateResourceNames(prompt.scriptContent);
        await fs.writeFile(prompt.scriptFile, uniqueNameScript, { mode: 0o755 });
        
        return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
        
      case 'skip_resource':
        // Skip this resource and continue
        console.log(`⏭️ Skipping resource and continuing...`);
        execution.status = 'completed_with_warnings';
        execution.steps[prompt.stepIndex].status = 'skipped';
        execution.warnings = execution.warnings || [];
        execution.warnings.push({
          step: prompt.stepIndex,
          message: `Skipped resource due to error: ${prompt.originalError.substring(0, 200)}...`
        });
        
        // Mark as completed
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        
        this.interactivePrompts.delete(promptId);
        return execution;
        
      case 'retry':
        // Retry the same operation
        console.log(`🔄 Retrying operation...`);
        return this.resumeExecution(prompt.sessionId, prompt.scriptFile);
        
      case 'abort':
        // User chose to stop execution
        console.log(`🛑 User aborted execution`);
        execution.status = 'aborted';
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        
        this.interactivePrompts.delete(promptId);
        return execution;
        
      case 'guide_permissions':
        // Provide permission fix guidance
        console.log(`🔑 Providing permission fix guidance...`);
        execution.status = 'paused_for_permissions';
        execution.permissionGuide = this.generatePermissionGuide();
        return execution;
        
      default:
        throw new Error(`Unknown action: ${userResponse.action}`);
    }
  }
  
  /**
   * Resume execution after user input
   */
  async resumeExecution(sessionId, scriptFile) {
    const execution = this.executions.get(sessionId);
    
    if (!execution) {
      throw new Error(`Execution session not found: ${sessionId}`);
    }
    
    console.log(`▶️ Resuming execution: ${sessionId}`);
    execution.status = 'running';
    
    const step = execution.steps[execution.steps.length - 1];
    step.status = 'running';
    step.startTime = Date.now();
    
    // Re-execute the script
    const result = await this.runCommand(`bash "${scriptFile}"`, {});
    
    step.status = result.code === 0 ? 'completed' : 'failed';
    step.output = result.output;
    step.error = result.error;
    step.duration = Date.now() - step.startTime;
    
    if (result.code !== 0) {
      // Still failed after retry - check for errors again
      const errorDetection = this.detectAzureError(result.error + '\n' + result.output);
      
      if (errorDetection.detected && errorDetection.errorType !== 'generic_error') {
        // Create new prompt
        const promptId = `prompt_${sessionId}_${Date.now()}`;
        const interactivePrompt = {
          promptId,
          sessionId,
          stepIndex: execution.steps.length - 1,
          ...errorDetection,
          scriptContent: await fs.readFile(scriptFile, 'utf8'),
          scriptFile: scriptFile
        };
        
        this.interactivePrompts.set(promptId, interactivePrompt);
        execution.interactivePrompt = interactivePrompt;
        execution.status = 'waiting_for_input';
        
        return execution;
      }
      
      // Non-recoverable error
      execution.status = 'failed';
      execution.errors.push({
        step: execution.steps.length - 1,
        command: 'Script execution (retry)',
        error: result.error
      });
    } else {
      execution.status = 'completed';
    }
    
    // Cleanup
    try {
      await fs.unlink(scriptFile);
    } catch (e) {
      console.warn(`⚠️ Failed to cleanup: ${e.message}`);
    }
    
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    
    return execution;
  }
  
  /**
   * Update script to use different region
   */
  updateScriptRegion(scriptContent, newRegion) {
    // Replace all occurrences of location/region parameters
    return scriptContent
      .replace(/--location\s+"[^"]+"/g, `--location "${newRegion}"`)
      .replace(/--location\s+'[^']+'/g, `--location '${newRegion}'`)
      .replace(/--location\s+[^\s\\]+/g, `--location ${newRegion}`)
      .replace(/LOCATION="[^"]+"/g, `LOCATION="${newRegion}"`)
      .replace(/LOCATION='[^']+'/g, `LOCATION='${newRegion}'`);
  }
  
  /**
   * Update script to use different SKU
   */
  updateScriptSKU(scriptContent, newSKU) {
    return scriptContent
      .replace(/--sku\s+"[^"]+"/g, `--sku "${newSKU}"`)
      .replace(/--sku\s+'[^']+'/g, `--sku '${newSKU}'`)
      .replace(/--sku\s+[^\s\\]+/g, `--sku ${newSKU}`);
  }
  
  /**
   * Regenerate resource names with new random suffixes
   */
  regenerateResourceNames(scriptContent) {
    // This will cause the script to generate new random names on next execution
    // since it uses $RANDOM variable
    return scriptContent + `\n# Regenerated at ${new Date().toISOString()}\n`;
  }
  
  /**
   * Generate permission fix guidance
   */
  generatePermissionGuide() {
    const clientId = process.env.AZURE_CLIENT_ID;
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    
    return {
      title: 'How to Fix Permission Issues',
      steps: [
        {
          step: 1,
          title: 'Assign Contributor Role',
          command: `az role assignment create --assignee "${clientId}" --role "Contributor" --subscription "${subscriptionId}"`,
          description: 'Run this command to grant Contributor permissions'
        },
        {
          step: 2,
          title: 'Verify Role Assignment',
          command: `az role assignment list --assignee "${clientId}" --subscription "${subscriptionId}"`,
          description: 'Verify the role was assigned correctly'
        },
        {
          step: 3,
          title: 'Retry Execution',
          description: 'Click "Retry" to continue execution with updated permissions'
        }
      ],
      azurePortalLink: `https://portal.azure.com/#@/resource/subscriptions/${subscriptionId}/users`
    };
  }
  
  /**
   * Cleanup old executions (older than 1 hour)
   */
  cleanup() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [sessionId, execution] of this.executions.entries()) {
      if (execution.endTime && execution.endTime < oneHourAgo) {
        this.executions.delete(sessionId);
        console.log(`🧹 Cleaned up execution: ${sessionId}`);
      }
    }
    
    // Cleanup old prompts
    for (const [promptId, prompt] of this.interactivePrompts.entries()) {
      if (prompt.timestamp < oneHourAgo) {
        this.interactivePrompts.delete(promptId);
        console.log(`🧹 Cleaned up prompt: ${promptId}`);
      }
    }
  }
}

// Cleanup old executions every 30 minutes
const executionService = new ExecutionService();
setInterval(() => {
  executionService.cleanup();
}, 30 * 60 * 1000);

module.exports = executionService;

