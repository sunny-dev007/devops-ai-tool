const { ClientSecretCredential } = require('@azure/identity');
const axios = require('axios');

class AzureService {
  constructor() {
    this.isInitialized = false;
    this.credential = null;
    
    // Load environment variables with better error handling
    this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    
    // Log credential status for debugging
    console.log('🔑 Azure Service Constructor - Credential Status:');
    console.log(`  - Subscription ID: ${this.subscriptionId ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Tenant ID: ${this.tenantId ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Client ID: ${this.clientId ? '✅ Set' : '❌ Missing'}`);
    console.log(`  - Client Secret: ${this.clientSecret ? '✅ Set' : '❌ Missing'}`);
    
    // Request throttling
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // Minimum 200ms between requests
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Azure Service...');
      console.log('🔍 Checking Azure credentials...');
      
      if (!this.subscriptionId || !this.tenantId || !this.clientId || !this.clientSecret) {
        console.log('⚠️ Azure credentials not configured, using mock data mode');
        console.log('📋 Missing credentials:');
        if (!this.subscriptionId) console.log('  - AZURE_SUBSCRIPTION_ID');
        if (!this.tenantId) console.log('  - AZURE_TENANT_ID');
        if (!this.clientId) console.log('  - AZURE_CLIENT_ID');
        if (!this.clientSecret) console.log('  - AZURE_CLIENT_SECRET');
        console.log('💡 Please check your .env file and ensure all Azure credentials are set');
        
        this.isInitialized = false;
        return false;
      }

      console.log('✅ All Azure credentials are present, attempting authentication...');
      
      try {
        this.credential = new ClientSecretCredential(
          this.tenantId,
          this.clientId,
          this.clientSecret
        );

        // Test the connection
        console.log('🔐 Testing Azure authentication...');
        const token = await this.getAccessToken();
        console.log('✅ Azure authentication successful');
        
        this.isInitialized = true;
        console.log('✅ Azure service initialized successfully');
        return true;
      } catch (authError) {
        console.error('❌ Azure authentication failed:', authError.message);
        console.error('🔍 Authentication error details:', {
          tenantId: this.tenantId,
          clientId: this.clientId,
          hasClientSecret: !!this.clientSecret,
          error: authError.message
        });
        
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Azure service:', error.message);
      console.error('🔍 Initialization error details:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Throttled request method to prevent rate limiting
  async throttledRequest(requestFn) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        const delay = this.minRequestInterval - timeSinceLastRequest;
        setTimeout(() => {
          this.executeRequest(requestFn, resolve, reject);
        }, delay);
      } else {
        this.executeRequest(requestFn, resolve, reject);
      }
    });
  }

  async executeRequest(requestFn, resolve, reject) {
    try {
      this.lastRequestTime = Date.now();
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  async getAccessToken() {
    if (!this.credential) {
      throw new Error('Azure credentials not initialized');
    }
    
    const token = await this.credential.getToken('https://management.azure.com/.default');
    if (!token || !token.token) {
      throw new Error('Failed to get valid access token');
    }
    return token.token;
  }

  /**
   * Validate service principal permissions
   * Checks if the service principal has the required roles assigned
   */
  async validatePermissions() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        return {
          valid: false,
          error: 'Azure service not initialized',
          requiredRoles: this.getRequiredRoles(),
          fixCommands: this.getFixCommands()
        };
      }

      const requiredRoles = this.getRequiredRoles();
      const validationResults = [];
      let allValid = true;

      // Test each required permission
      for (const role of requiredRoles) {
        try {
          // Test subscription read permission
          if (role === 'Reader') {
            try {
              await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}`);
              validationResults.push({
                role: 'Reader',
                status: 'valid',
                message: 'Has subscription read access'
              });
            } catch (error) {
              if (error.status === 403) {
                allValid = false;
                validationResults.push({
                  role: 'Reader',
                  status: 'missing',
                  message: error.message,
                  fixCommand: error.fixCommand
                });
              } else {
                validationResults.push({
                  role: 'Reader',
                  status: 'unknown',
                  message: `Error testing: ${error.message}`
                });
              }
            }
          }

          // Test cost management permission
          if (role === 'Cost Management Reader') {
            try {
              const query = {
                type: 'Usage',
                timeframe: 'TheLastMonth',
                dataset: {
                  granularity: 'None',
                  aggregation: {
                    totalCost: {
                      name: 'PreTaxCost',
                      function: 'Sum'
                    }
                  }
                }
              };
              await this.makeAzureRequest(
                `/subscriptions/${this.subscriptionId}/providers/Microsoft.CostManagement/query`,
                { 'api-version': '2021-10-01' },
                'POST',
                query
              );
              validationResults.push({
                role: 'Cost Management Reader',
                status: 'valid',
                message: 'Has cost management read access'
              });
            } catch (error) {
              if (error.status === 403) {
                allValid = false;
                validationResults.push({
                  role: 'Cost Management Reader',
                  status: 'missing',
                  message: error.message,
                  fixCommand: error.fixCommand
                });
              } else {
                validationResults.push({
                  role: 'Cost Management Reader',
                  status: 'unknown',
                  message: `Error testing: ${error.message}`
                });
              }
            }
          }
        } catch (error) {
          allValid = false;
          validationResults.push({
            role: role,
            status: 'error',
            message: error.message
          });
        }
      }

      return {
        valid: allValid,
        clientId: this.clientId,
        subscriptionId: this.subscriptionId,
        tenantId: this.tenantId,
        requiredRoles: requiredRoles,
        validationResults: validationResults,
        fixCommands: this.getFixCommands()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        requiredRoles: this.getRequiredRoles(),
        fixCommands: this.getFixCommands()
      };
    }
  }

  /**
   * Get list of required Azure RBAC roles
   */
  getRequiredRoles() {
    return [
      'Reader',
      'Cost Management Reader'
    ];
  }

  /**
   * Get fix commands for missing permissions
   */
  getFixCommands() {
    const commands = [];
    
    commands.push({
      role: 'Reader',
      command: `az role assignment create --assignee "${this.clientId}" --role "Reader" --scope "/subscriptions/${this.subscriptionId}"`,
      description: 'Grants read access to subscription resources'
    });

    commands.push({
      role: 'Cost Management Reader',
      command: `az role assignment create --assignee "${this.clientId}" --role "Cost Management Reader" --scope "/subscriptions/${this.subscriptionId}"`,
      description: 'Grants read access to cost management data'
    });

    return commands;
  }

  async makeAzureRequest(endpoint, params = {}, method = 'GET', data = null) {
    return this.throttledRequest(async () => {
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second base delay
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const token = await this.getAccessToken();
          
          let url = `https://management.azure.com${endpoint}`;
          if (method === 'POST' && params['api-version']) {
            url += `?api-version=${params['api-version']}`;
            const { 'api-version': _, ...otherParams } = params;
            params = otherParams;
          }
          
          console.log(`🌐 Making Azure request to: ${url} (attempt ${attempt}/${maxRetries})`);

          const config = {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: method === 'GET' ? {
              'api-version': '2021-04-01', // Default API version for most ARM calls
              ...params
            } : params,
            timeout: 30000 // 30 second timeout
          };

          let response;
          if (method === 'GET') {
            response = await axios.get(url, config);
          } else if (method === 'POST') {
            response = await axios.post(url, data, config);
          } else if (method === 'PUT') {
            response = await axios.put(url, data, config);
          } else if (method === 'DELETE') {
            response = await axios.delete(url, config);
          } else {
            throw new Error(`Unsupported HTTP method: ${method}`);
          }

          console.log(`✅ Azure request successful: ${endpoint}`);
          return response.data;
          
        } catch (error) {
          console.error(`❌ Azure request failed (attempt ${attempt}/${maxRetries}):`, error.message);
          
          // Handle rate limiting specifically
          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || attempt;
            const delay = retryAfter * 1000 + (attempt * baseDelay);
            
            console.log(`⏳ Rate limited (429). Waiting ${delay}ms before retry...`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            } else {
              console.log('⚠️ Max retries reached for rate limiting, using fallback data');
              throw new Error('Rate limit exceeded after max retries');
            }
          }
          
          // Handle authorization failures (403) - don't retry, provide clear guidance
          if (error.response?.status === 403) {
            const errorData = error.response.data?.error || {};
            const errorCode = errorData.code || 'AuthorizationFailed';
            const errorMessage = errorData.message || error.message;
            
            // Extract required action from error message
            const actionMatch = errorMessage.match(/action '([^']+)'/);
            const requiredAction = actionMatch ? actionMatch[1] : 'unknown';
            
            // Map actions to required roles
            const actionToRoleMap = {
              'Microsoft.Resources/subscriptions/read': 'Reader',
              'Microsoft.CostManagement/Query/read': 'Cost Management Reader',
              'Microsoft.Resources/subscriptions/resourceGroups/read': 'Reader',
              'Microsoft.Resources/subscriptions/resources/read': 'Reader',
              'Microsoft.Advisor/recommendations/read': 'Reader'
            };
            
            const requiredRole = actionToRoleMap[requiredAction] || 'Reader';
            
            console.error(`\n🔒 AUTHORIZATION FAILED (403)`);
            console.error(`   Error Code: ${errorCode}`);
            console.error(`   Error Message: ${errorMessage}`);
            console.error(`   Required Action: ${requiredAction}`);
            console.error(`   Required Role: ${requiredRole}`);
            console.error(`   Client ID: ${this.clientId}`);
            console.error(`   Subscription ID: ${this.subscriptionId}`);
            console.error(`\n💡 SOLUTION:`);
            console.error(`   The service principal does not have the required permissions.`);
            console.error(`   Run the following command to fix this:`);
            console.error(`   az role assignment create \\`);
            console.error(`     --assignee "${this.clientId}" \\`);
            console.error(`     --role "${requiredRole}" \\`);
            console.error(`     --scope "/subscriptions/${this.subscriptionId}"`);
            console.error(`\n   Or run the fix script: ./fix-azure-permissions.sh\n`);
            
            // Create enhanced error with guidance
            const enhancedError = new Error(`Authorization Failed: ${errorMessage}`);
            enhancedError.status = 403;
            enhancedError.code = errorCode;
            enhancedError.requiredAction = requiredAction;
            enhancedError.requiredRole = requiredRole;
            enhancedError.clientId = this.clientId;
            enhancedError.subscriptionId = this.subscriptionId;
            enhancedError.fixCommand = `az role assignment create --assignee "${this.clientId}" --role "${requiredRole}" --scope "/subscriptions/${this.subscriptionId}"`;
            
            throw enhancedError;
          }
          
          // Handle other errors
          if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
          }
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw error;
          }
          
          // For other errors, wait before retry
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    });
  }

  async getSubscriptionSummary() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure not initialized, returning mock data');
        return this.getMockSubscriptionSummary();
      }

      console.log('🔍 Fetching real Azure subscription data...');

      try {
        // Get subscription info
        const subscription = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}`);
        console.log('✅ Subscription data fetched:', subscription.displayName);
        
        // Get resource groups
        const resourceGroups = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/resourcegroups`);
        console.log('✅ Resource groups fetched:', resourceGroups.value?.length || 0);
        
        // Get resources count
        const resources = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/resources`);
        console.log('✅ Resources fetched:', resources.value?.length || 0);
        
        // Get locations
        const locations = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/locations`);

        const summary = {
          subscriptionId: this.subscriptionId,
          subscriptionName: subscription.displayName,
          tenantId: this.tenantId,
          totalResources: resources.value?.length || 0,
          resourceGroups: resourceGroups.value?.length || 0,
          resourceTypes: this.processResourceTypes(resources.value || []),
          costTrend: 'stable', // This would come from cost analysis
          lastUpdated: new Date().toISOString()
        };

        console.log('📊 Real Azure summary generated:', {
          resources: summary.totalResources,
          resourceGroups: summary.resourceGroups,
          resourceTypes: Object.keys(summary.resourceTypes).length
        });

        return summary;
      } catch (apiError) {
        console.error('❌ Azure API call failed:', apiError.message);
        console.error('❌ API Error details:', JSON.stringify(apiError.response?.data || apiError, null, 2));
        
        // If it's an authorization error, don't fall back to mock data - throw it so the API can return proper error
        if (apiError.status === 403 || apiError.code === 'AuthorizationFailed') {
          throw apiError;
        }
        
        // Fall back to mock data when Azure API fails for other reasons
        console.log('⚠️ Falling back to mock data due to Azure API failure');
        return this.getMockSubscriptionSummary();
      }
    } catch (error) {
      console.error('❌ Failed to get subscription summary:', error.message);
      
      // If it's an authorization error, don't fall back to mock data - throw it
      if (error.status === 403 || error.code === 'AuthorizationFailed') {
        throw error;
      }
      
      // Fall back to mock data for other errors
      return this.getMockSubscriptionSummary();
    }
  }

  async getResources(filters = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure not initialized, returning mock resources');
        return this.getMockResources(filters);
      }

      console.log('🔍 Fetching real Azure resources...');

      try {
        const resources = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/resources`);
        
        // Also get cost data to map to resources
        let costData = null;
        try {
          const costs = await this.getCosts();
          costData = costs.costs || [];
        } catch (costError) {
          console.log('⚠️ Could not fetch cost data for resources:', costError.message);
        }

        const processedResources = (resources.value || []).map(resource => {
          const resourceGroup = resource.id.split('/')[4]; // Extract resource group from ID
          
          // Find cost for this resource type and resource group
          let cost = 0;
          if (costData) {
            const costItem = costData.find(c => 
              c.resourceType === resource.type && 
              c.resourceGroup === resourceGroup
            );
            if (costItem) {
              cost = costItem.cost;
            }
          }

          return {
            id: resource.id,
            name: resource.name,
            type: resource.type,
            location: resource.location,
            resourceGroup: resourceGroup,
            tags: resource.tags || {},
            properties: resource.properties || {},
            status: 'Active',
            cost: cost,
            currency: 'USD'
          };
        });

        console.log(`✅ Real Azure resources fetched: ${processedResources.length}`);
        return processedResources;
      } catch (apiError) {
        console.error('❌ Azure API call failed:', apiError.message);
        console.error('❌ API Error details:', JSON.stringify(apiError.response?.data || apiError, null, 2));
        
        // If it's an authorization error, don't fall back to mock data - throw it so the API can return proper error
        if (apiError.status === 403 || apiError.code === 'AuthorizationFailed') {
          throw apiError;
        }
        
        // Fall back to mock data when Azure API fails for other reasons
        console.log('⚠️ Falling back to mock data due to Azure API failure');
        return this.getMockResources(filters);
      }
    } catch (error) {
      console.error('❌ Failed to get resources:', error.message);
      
      // If it's an authorization error, don't fall back to mock data - throw it
      if (error.status === 403 || error.code === 'AuthorizationFailed') {
        throw error;
      }
      
      // Fall back to mock data for other errors
      return this.getMockResources(filters);
    }
  }

  async getResourceGroups() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure not initialized, returning mock resource groups');
        return this.getMockResourceGroups();
      }

      console.log('🔍 Fetching real Azure resource groups...');

      try {
        const resourceGroups = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/resourcegroups`);
        
        // Also get cost data to map to resource groups
        let costData = null;
        try {
          const costs = await this.getCosts();
          costData = costs.costs || [];
        } catch (costError) {
          console.log('⚠️ Could not fetch cost data for resource groups:', costError.message);
        }

        const processedGroups = (resourceGroups.value || []).map(rg => {
          // Find total cost for this resource group
          let totalCost = 0;
          if (costData) {
            const groupCosts = costData.filter(c => c.resourceGroup === rg.name);
            totalCost = groupCosts.reduce((sum, cost) => sum + cost.cost, 0);
          }

          return {
            id: rg.id,
            name: rg.name,
            location: rg.location,
            tags: rg.tags || {},
            properties: rg.properties || {},
            totalCost: totalCost,
            currency: 'USD'
          };
        });

        console.log(`✅ Real Azure resource groups fetched: ${processedGroups.length}`);
        return processedGroups;
      } catch (apiError) {
        console.error('❌ Azure API call failed:', apiError.message);
        console.error('❌ API Error details:', JSON.stringify(apiError.response?.data || apiError, null, 2));
        
        // If it's an authorization error, don't fall back to mock data - throw it so the API can return proper error
        if (apiError.status === 403 || apiError.code === 'AuthorizationFailed') {
          throw apiError;
        }
        
        // Fall back to mock data when Azure API fails for other reasons
        console.log('⚠️ Falling back to mock data due to Azure API failure');
        return this.getMockResourceGroups();
      }
    } catch (error) {
      console.error('❌ Failed to get resource groups:', error.message);
      
      // If it's an authorization error, don't fall back to mock data - throw it
      if (error.status === 403 || error.code === 'AuthorizationFailed') {
        throw error;
      }
      
      // Fall back to mock data for other errors
      return this.getMockResourceGroups();
    }
  }

  async getCosts(timeframe = 'Last30Days') {
    try {
      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, using mock cost data');
        return this.getMockCosts(timeframe);
      }

      const query = {
        type: 'Usage',
        timeframe: timeframe,
        dataset: {
          granularity: 'Daily',
          aggregation: {
            totalCost: {
              name: 'PreTaxCost',
              function: 'Sum'
            }
          },
          grouping: [
            {
              type: 'Dimension',
              name: 'ResourceType'
            }
          ]
        }
      };

      try {
        const costResponse = await this.makeAzureRequest(
          `/subscriptions/${this.subscriptionId}/providers/Microsoft.CostManagement/query`,
          { 'api-version': '2021-10-01' },
          'POST',
          query
        );

        if (costResponse && costResponse.rows && costResponse.rows.length > 0) {
          const costs = costResponse.rows.map(row => ({
            resourceType: row[1] || 'Unknown',
            cost: parseFloat(row[0]) || 0,
            date: row[2] || new Date().toISOString().split('T')[0]
          }));

          const totalCost = costs.reduce((sum, item) => sum + item.cost, 0);

          return {
            totalCost: totalCost,
            currency: costResponse.currency || 'USD',
            timeframe: timeframe,
            costs: costs
          };
        } else {
          console.log('⚠️ Cost Management API returned no data, using mock data');
          return this.getMockCosts(timeframe);
        }
      } catch (apiError) {
        console.error('❌ Cost Management API failed:', apiError.message);
        
        // If it's an authorization error, don't fall back to mock data - throw it so the API can return proper error
        if (apiError.status === 403 || apiError.code === 'AuthorizationFailed') {
          throw apiError;
        }
        
        // Fall back to mock data when Azure API fails for other reasons
        console.log('⚠️ Falling back to mock cost data');
        return this.getMockCosts(timeframe);
      }
    } catch (error) {
      console.error('❌ Failed to get costs:', error.message);
      
      // If it's an authorization error, don't fall back to mock data - throw it
      if (error.status === 403 || error.code === 'AuthorizationFailed') {
        throw error;
      }
      
      // Fall back to mock data for other errors
      return this.getMockCosts(timeframe);
    }
  }

  async getRecommendations() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure not initialized, returning mock recommendations');
        return this.getMockRecommendations();
      }

      console.log('🔍 Fetching real Azure recommendations...');

      // For now, return mock recommendations since Advisor API requires more complex setup
      console.log('⚠️ Advisor API not implemented yet, using mock data');
      return this.getMockRecommendations();
    } catch (error) {
      console.error('❌ Failed to get recommendations:', error.message);
      return this.getMockRecommendations();
    }
  }

  async getLocations() {
    try {
      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, using mock locations');
        return this.getMockLocations();
      }

      try {
        const locations = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/locations`);
        
        if (locations && locations.value && locations.value.length > 0) {
          const processedLocations = locations.value.map(location => ({
            name: location.name,
            displayName: location.displayName,
            latitude: location.latitude,
            longitude: location.longitude
          }));

          console.log(`✅ Real Azure locations fetched: ${processedLocations.length}`);
          return processedLocations;
        } else {
          console.log('⚠️ Azure locations API returned no data, using mock data');
          return this.getMockLocations();
        }
      } catch (apiError) {
        console.error('❌ Azure API call failed for locations:', apiError.message);
        console.log('⚠️ Falling back to mock locations data');
        return this.getMockLocations();
      }
    } catch (error) {
      console.error('❌ Failed to get locations:', error.message);
      return this.getMockLocations();
    }
  }

  async getResourceTypes() {
    try {
      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, using mock resource types');
        return this.getMockResourceTypes();
      }

      try {
        const resources = await this.makeAzureRequest(`/subscriptions/${this.subscriptionId}/resources`);
        
        if (resources && resources.value && resources.value.length > 0) {
          const resourceTypes = [...new Set(resources.value.map(r => r.type))];
          
          console.log(`✅ Real Azure resource types fetched: ${resourceTypes.length}`);
          return resourceTypes;
        } else {
          console.log('⚠️ Azure resources API returned no data, using mock data');
          return this.getMockResourceTypes();
        }
      } catch (apiError) {
        console.error('❌ Azure API call failed for resource types:', apiError.message);
        console.log('⚠️ Falling back to mock resource types data');
        return this.getMockResourceTypes();
      }
    } catch (error) {
      console.error('❌ Failed to get resource types:', error.message);
      return this.getMockResourceTypes();
    }
  }

  async getCostTrends(days = 30) {
    try {
      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, using mock cost trends');
        return this.getMockCostTrends(days);
      }

      const query = {
        type: 'Usage',
        timeframe: 'Custom',
        timePeriod: {
          from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0]
        },
        dataset: {
          granularity: 'Daily',
          aggregation: {
            totalCost: {
              name: 'PreTaxCost',
              function: 'Sum'
            }
          }
        }
      };

      try {
        const trendResponse = await this.makeAzureRequest(
          `/subscriptions/${this.subscriptionId}/providers/Microsoft.CostManagement/query`,
          { 'api-version': '2021-10-01' },
          'POST',
          query
        );

        if (trendResponse && trendResponse.rows && trendResponse.rows.length > 0) {
          const trends = trendResponse.rows.map(row => ({
            date: row[1] || new Date().toISOString().split('T')[0],
            cost: parseFloat(row[0]) || 0
          }));

          return {
            timeframe: `${days} days`,
            currency: trendResponse.currency || 'USD',
            trends: trends,
            totalCost: trends.reduce((sum, item) => sum + item.cost, 0)
          };
        } else {
          console.log('⚠️ Cost Management API returned no trend data, using mock data');
          return this.getMockCostTrends(days);
        }
      } catch (apiError) {
        console.error('❌ Cost Management API failed for trends:', apiError.message);
        
        // If it's an authorization error, don't fall back to mock data - throw it so the API can return proper error
        if (apiError.status === 403 || apiError.code === 'AuthorizationFailed') {
          throw apiError;
        }
        
        // Fall back to mock data when Azure API fails for other reasons
        console.log('⚠️ Falling back to mock cost trends');
        return this.getMockCostTrends(days);
      }
    } catch (error) {
      console.error('❌ Failed to get cost trends:', error.message);
      
      // If it's an authorization error, don't fall back to mock data - throw it
      if (error.status === 403 || error.code === 'AuthorizationFailed') {
        throw error;
      }
      
      // Fall back to mock data for other errors
      return this.getMockCostTrends(days);
    }
  }

  /**
   * Get current actual costs for a specific resource group using Azure CLI
   * This provides more accurate cost data than the Cost Management API
   */
  async getResourceGroupCosts(resourceGroupName, days = 30) {
    // Auto-initialize if not already initialized
    if (!this.isInitialized) {
      console.log('⚠️ Azure service not initialized, attempting to initialize...');
      await this.initialize();
    }

    if (!this.isInitialized) {
      console.log('❌ Failed to initialize Azure service, cannot get resource group costs');
      throw new Error('Azure service not initialized');
    }

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log(`💰 Fetching actual costs for resource group: ${resourceGroupName}`);
    console.log(`📅 Date range: ${fromDate} to ${toDate} (${days} days)`);

    // Use Cost Management API directly with resource group filter
    // Note: Azure CLI 'az consumption usage list' does NOT include resource group info
    try {
        console.log('💎 Using Azure Cost Management API with resource group filter...');
        
      const query = {
        type: 'ActualCost',
        timeframe: 'Custom',
        timePeriod: {
          from: fromDate,
          to: toDate
        },
        dataset: {
          granularity: 'None', // Use 'None' to get total accumulated cost, not daily breakdown
          aggregation: {
            totalCost: {
              name: 'Cost',
              function: 'Sum'
            },
            totalCostUSD: {
              name: 'CostUSD',
              function: 'Sum'
            }
          },
          grouping: [
            {
              type: 'Dimension',
              name: 'ResourceId'
            },
            {
              type: 'Dimension',
              name: 'ResourceType'
            }
          ],
          filter: {
            dimensions: {
              name: 'ResourceGroupName',
              operator: 'In',
              values: [resourceGroupName]
            }
          }
        }
      };

        const costResponse = await this.makeAzureRequest(
          `/subscriptions/${this.subscriptionId}/providers/Microsoft.CostManagement/query`,
          { 'api-version': '2023-03-01' },
          'POST',
          query
        );

        console.log('✅ Got cost data from Cost Management API');
        console.log(`📊 Total rows returned: ${costResponse.properties?.rows?.length || 0}`);

        if (costResponse && costResponse.properties && costResponse.properties.rows) {
          const rows = costResponse.properties.rows;
          const columns = costResponse.properties.columns;
          
          // Log column names for debugging
          console.log(`📋 Columns: ${columns.map(c => c.name).join(', ')}`);
          
          // Prefer CostUSD if available, otherwise use Cost
          const costUSDIndex = columns.findIndex(col => col.name === 'CostUSD');
          const costIndex = columns.findIndex(col => col.name === 'Cost');
          const useCostIndex = costUSDIndex >= 0 ? costUSDIndex : costIndex;
          
          const resourceIdIndex = columns.findIndex(col => col.name === 'ResourceId');
          const resourceTypeIndex = columns.findIndex(col => col.name === 'ResourceType');

          console.log(`💡 Using cost column: ${columns[useCostIndex]?.name || 'Cost'}`);

          let totalCost = 0;
          const resourceCosts = {};

          rows.forEach((row, index) => {
            const cost = parseFloat(row[useCostIndex]) || 0;
            const resourceId = row[resourceIdIndex] || 'Unknown';
            const resourceType = row[resourceTypeIndex] || 'Unknown';
            
            // Extract resource name - handle nested resources (e.g., databases)
            // For nested: /subscriptions/.../resourceGroups/RG/providers/Microsoft.Sql/servers/server/databases/db
            // We want both the full path and the last segment for matching
            const resourceIdParts = resourceId.split('/');
            const resourceName = resourceIdParts[resourceIdParts.length - 1] || resourceId;
            const parentResource = resourceIdParts[resourceIdParts.length - 3] || null; // e.g., server name for databases

            if (index === 0) {
              console.log(`📝 Sample row: ResourceId=${resourceId}, ResourceName=${resourceName}, Cost=${cost}, Type=${resourceType}`);
            }

            totalCost += cost;

            // Use full resource ID as key for better matching, but also store name
            const costKey = resourceId.toLowerCase(); // Use full ID for uniqueness
            
            if (!resourceCosts[costKey]) {
              resourceCosts[costKey] = {
                resourceId: resourceId,
                resourceName: resourceName,
                resourceType: resourceType,
                parentResource: parentResource,
                totalCost: 0,
                costByCategory: {}
              };
            }

            resourceCosts[costKey].totalCost += cost;
          });

          // Currency from API (should be USD)
          const currency = costResponse.properties.currency || 'USD';
          
          console.log(`💰 Total cost calculated: ${totalCost.toFixed(2)} ${currency}`);
          console.log(`📦 Number of resources with costs: ${Object.keys(resourceCosts).length}`);

          // Convert to array and sort by cost (highest first)
          const breakdownArray = Object.values(resourceCosts)
            .sort((a, b) => b.totalCost - a.totalCost)
            .map(item => ({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              parentResource: item.parentResource,
              totalCost: item.totalCost,
              costByCategory: item.costByCategory
            }));

          return {
            resourceGroupName: resourceGroupName,
            totalCost: totalCost,
            currency: currency,
            period: `Last ${days} days`,
            fromDate: fromDate,
            toDate: toDate,
            breakdown: breakdownArray,
            method: 'Cost Management API'
          };
        } else {
          console.log('⚠️ Cost Management API returned no data');
          return {
            resourceGroupName: resourceGroupName,
            totalCost: 0,
            currency: 'USD',
            period: `Last ${days} days`,
            fromDate: fromDate,
            toDate: toDate,
            breakdown: [],
            note: 'No cost data available for this resource group in the selected period',
            method: 'Cost Management API'
          };
        }
    } catch (error) {
      console.error('❌ Failed to get resource group costs:', error.message);
      throw error;
    }
  }

  // Mock data methods for fallback
  getMockSubscriptionSummary() {
    return {
      subscriptionId: this.subscriptionId || "demo-subscription-123",
      subscriptionName: "Demo Subscription (Mock)",
      tenantId: this.tenantId || "demo-tenant",
      totalResources: 25,
      resourceGroups: 12,
      resourceTypes: {
        "Microsoft.Web/sites": { count: 6, resources: [] },
        "Microsoft.Web/serverFarms": { count: 6, resources: [] },
        "Microsoft.Compute/virtualMachines": { count: 2, resources: [] },
        "Microsoft.Storage/storageAccounts": { count: 1, resources: [] },
        "Microsoft.Sql/servers": { count: 1, resources: [] },
        "microsoft.insights/components": { count: 3, resources: [] },
        "Microsoft.CognitiveServices/accounts": { count: 1, resources: [] },
        "Microsoft.Insights/actiongroups": { count: 1, resources: [] }
      },
      costTrend: "stable",
      lastUpdated: new Date().toISOString()
    };
  }

  getMockResources(filters = {}) {
    const mockResources = [
      {
        id: "/subscriptions/demo/resourceGroups/FEApp/providers/Microsoft.Web/sites/fe-app-prod",
        name: "fe-app-prod",
        type: "Microsoft.Web/sites",
        location: "East US",
        resourceGroup: "FEApp",
        tags: { environment: "production", owner: "frontend-team", purpose: "customer-facing" },
        status: "Running",
        cost: 45.50
      },
      {
        id: "/subscriptions/demo/resourceGroups/FEApp/providers/Microsoft.Web/serverFarms/fe-app-service-plan",
        name: "fe-app-service-plan",
        type: "Microsoft.Web/serverFarms",
        location: "East US",
        resourceGroup: "FEApp",
        tags: { environment: "production", tier: "premium" },
        status: "Active",
        cost: 45.50
      },
      {
        id: "/subscriptions/demo/resourceGroups/Micro_User_Services/providers/Microsoft.Web/sites/user-api-service",
        name: "user-api-service",
        type: "Microsoft.Web/sites",
        location: "West US 2",
        resourceGroup: "Micro_User_Services",
        tags: { environment: "production", owner: "backend-team", purpose: "user-management-api" },
        status: "Running",
        cost: 32.25
      },
      {
        id: "/subscriptions/demo/resourceGroups/Micro_User_Services/providers/Microsoft.Web/serverFarms/user-service-plan",
        name: "user-service-plan",
        type: "Microsoft.Web/serverFarms",
        location: "West US 2",
        resourceGroup: "Micro_User_Services",
        tags: { environment: "production", tier: "standard" },
        status: "Active",
        cost: 32.25
      },
      {
        id: "/subscriptions/demo/resourceGroups/RG-SmartDocs-AI/providers/Microsoft.Web/sites/smartdocs-ai-app",
        name: "smartdocs-ai-app",
        type: "Microsoft.Web/sites",
        location: "Central US",
        resourceGroup: "RG-SmartDocs-AI",
        tags: { environment: "production", owner: "ai-team", purpose: "document-processing" },
        status: "Running",
        cost: 67.80
      },
      {
        id: "/subscriptions/demo/resourceGroups/RG-SmartDocs-AI/providers/Microsoft.Web/serverFarms/smartdocs-ai-plan",
        name: "smartdocs-ai-plan",
        type: "Microsoft.Web/serverFarms",
        location: "Central US",
        resourceGroup: "RG-SmartDocs-AI",
        tags: { environment: "production", tier: "premium" },
        status: "Active",
        cost: 67.80
      },
      {
        id: "/subscriptions/demo/resourceGroups/nit-func-res/providers/Microsoft.Web/sites/nit-function-app",
        name: "nit-function-app",
        type: "Microsoft.Web/sites",
        location: "North Europe",
        resourceGroup: "nit-func-res",
        tags: { environment: "production", owner: "functions-team", purpose: "serverless-processing" },
        status: "Running",
        cost: 78.45
      },
      {
        id: "/subscriptions/demo/resourceGroups/nit-func-res/providers/Microsoft.Web/serverFarms/nit-function-plan",
        name: "nit-function-plan",
        type: "Microsoft.Web/serverFarms",
        location: "North Europe",
        resourceGroup: "nit-func-res",
        tags: { environment: "production", tier: "consumption" },
        status: "Active",
        cost: 78.45
      },
      {
        id: "/subscriptions/demo/resourceGroups/nit-smartdocs-rg/providers/Microsoft.Web/sites/nit-smartdocs-prod",
        name: "nit-smartdocs-prod",
        type: "Microsoft.Web/sites",
        location: "East US",
        resourceGroup: "nit-smartdocs-rg",
        tags: { environment: "production", owner: "smartdocs-team", purpose: "document-management" },
        status: "Running",
        cost: 23.60
      },
      {
        id: "/subscriptions/demo/resourceGroups/nit-smartdocsDev-RG/providers/Microsoft.Web/sites/nit-smartdocs-dev",
        name: "nit-smartdocs-dev",
        type: "Microsoft.Web/sites",
        location: "East US",
        resourceGroup: "nit-smartdocsDev-RG",
        tags: { environment: "development", owner: "smartdocs-team", purpose: "development-environment" },
        status: "Running",
        cost: 19.75
      },
      {
        id: "/subscriptions/demo/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/vm-prod-01",
        name: "vm-prod-01",
        type: "Microsoft.Compute/virtualMachines",
        location: "East US",
        resourceGroup: "prod-rg",
        tags: { environment: "production", owner: "devops" },
        status: "Running",
        cost: 125.75
      },
      {
        id: "/subscriptions/demo/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/storageprod01",
        name: "storageprod01",
        type: "Microsoft.Storage/storageAccounts",
        location: "East US",
        resourceGroup: "prod-rg",
        tags: { environment: "production", purpose: "data" },
        status: "Active",
        cost: 18.50
      },
      {
        id: "/subscriptions/demo/resourceGroups/dev-rg/providers/Microsoft.Compute/virtualMachines/vm-dev-01",
        name: "vm-dev-01",
        type: "Microsoft.Compute/virtualMachines",
        location: "West US 2",
        resourceGroup: "dev-rg",
        tags: { environment: "development", owner: "developers" },
        status: "Running",
        cost: 89.90
      },
      {
        id: "/subscriptions/demo/resourceGroups/FEAppDB/providers/Microsoft.Sql/servers/fe-app-sql-server",
        name: "fe-app-sql-server",
        type: "Microsoft.Sql/servers",
        location: "East US",
        resourceGroup: "FEAppDB",
        tags: { environment: "production", owner: "database-team", purpose: "frontend-database" },
        status: "Active",
        cost: 125.75
      },
      {
        id: "/subscriptions/demo/resourceGroups/Micro_users/providers/microsoft.insights/components/user-service-insights",
        name: "user-service-insights",
        type: "microsoft.insights/components",
        location: "West US 2",
        resourceGroup: "Micro_users",
        tags: { environment: "production", owner: "monitoring-team", purpose: "application-monitoring" },
        status: "Active",
        cost: 18.50
      },
      {
        id: "/subscriptions/demo/resourceGroups/ai-service-az/providers/Microsoft.CognitiveServices/accounts/ai-service-account",
        name: "ai-service-account",
        type: "Microsoft.CognitiveServices/accounts",
        location: "Central US",
        resourceGroup: "ai-service-az",
        tags: { environment: "production", owner: "ai-team", purpose: "cognitive-services" },
        status: "Active",
        cost: 89.90
      },
      {
        id: "/subscriptions/demo/resourceGroups/azureapp-auto-alerts-b40c48-suchitroy3_gmail_com/providers/Microsoft.Insights/actiongroups/auto-alerts-group",
        name: "auto-alerts-group",
        type: "Microsoft.Insights/actiongroups",
        location: "East US",
        resourceGroup: "azureapp-auto-alerts-b40c48-suchitroy3_gmail_com",
        tags: { environment: "production", owner: "monitoring-team", purpose: "alerting" },
        status: "Active",
        cost: 12.30
      },
      {
        id: "/subscriptions/demo/resourceGroups/workwithcopilot/providers/microsoft.insights/components/copilot-insights",
        name: "copilot-insights",
        type: "microsoft.insights/components",
        location: "North Europe",
        resourceGroup: "workwithcopilot",
        tags: { environment: "production", owner: "copilot-team", purpose: "copilot-monitoring" },
        status: "Active",
        cost: 34.20
      }
    ];

    let filtered = mockResources;
    
    if (filters.type) {
      filtered = filtered.filter(r => r.type.toLowerCase().includes(filters.type.toLowerCase()));
    }
    
    if (filters.location) {
      filtered = filtered.filter(r => r.location.toLowerCase().includes(filters.location.toLowerCase()));
    }
    
    if (filters.resourceGroup) {
      filtered = filtered.filter(r => r.resourceGroup.toLowerCase().includes(filters.resourceGroup.toLowerCase()));
    }

    return filtered;
  }

  getMockResourceGroups() {
    return [
      { id: "prod-rg", name: "prod-rg", location: "East US" },
      { id: "dev-rg", name: "dev-rg", location: "West US 2" },
      { id: "backup-rg", name: "backup-rg", location: "East US" }
    ];
  }

  getMockCosts(timeframe = 'Last30Days') {
    // Generate realistic mock costs based on actual resource types
    const mockCosts = [
      {
        resourceType: "Microsoft.Web/serverFarms",
        resourceGroup: "FEApp",
        cost: 45.50,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Sql/servers",
        resourceGroup: "FEAppDB",
        cost: 125.75,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Web/serverFarms",
        resourceGroup: "Micro_User_Services",
        cost: 32.25,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "microsoft.insights/components",
        resourceGroup: "Micro_users",
        cost: 18.50,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Web/serverFarms",
        resourceGroup: "RG-SmartDocs-AI",
        cost: 67.80,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.CognitiveServices/accounts",
        resourceGroup: "ai-service-az",
        cost: 89.90,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Insights/actiongroups",
        resourceGroup: "azureapp-auto-alerts-b40c48-suchitroy3_gmail_com",
        cost: 12.30,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Web/serverFarms",
        resourceGroup: "nit-func-res",
        cost: 78.45,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Web/sites",
        resourceGroup: "nit-smartdocs-rg",
        cost: 23.60,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "Microsoft.Web/sites",
        resourceGroup: "nit-smartdocsDev-RG",
        cost: 19.75,
        currency: "USD",
        date: new Date().toISOString()
      },
      {
        resourceType: "microsoft.insights/components",
        resourceGroup: "workwithcopilot",
        cost: 34.20,
        currency: "USD",
        date: new Date().toISOString()
      }
    ];

    const totalCost = mockCosts.reduce((sum, cost) => sum + cost.cost, 0);

    return {
      totalCost: totalCost,
      currency: "USD",
      timeframe: timeframe,
      costs: mockCosts,
      summary: Object.values(mockCosts.reduce((acc, cost) => {
        if (!acc[cost.resourceType]) {
          acc[cost.resourceType] = {
            resourceType: cost.resourceType,
            totalCost: 0,
            count: 0,
            resources: []
          };
        }
        acc[cost.resourceType].totalCost += cost.cost;
        acc[cost.resourceType].count += 1;
        acc[cost.resourceType].resources.push(cost);
        return acc;
      }, {})),
      lastUpdated: new Date().toISOString()
    };
  }

  getMockRecommendations() {
    return [
      {
        id: "rec-1",
        category: "Cost",
        impact: "Medium",
        description: "Right-size underutilized VMs",
        solution: "Consider downsizing vm-dev-01 to a smaller SKU"
      },
      {
        id: "rec-2",
        category: "Security",
        impact: "High",
        description: "Enable encryption for storage accounts",
        solution: "Enable Azure Storage Service Encryption"
      }
    ];
  }

  getMockLocations() {
    return ["East US", "West US 2", "Central US", "North Europe"];
  }

  getMockResourceTypes() {
    return [
      "Microsoft.Web/sites",
      "Microsoft.Web/serverFarms",
      "Microsoft.Compute/virtualMachines",
      "Microsoft.Storage/storageAccounts",
      "Microsoft.Sql/servers",
      "microsoft.insights/components",
      "Microsoft.CognitiveServices/accounts",
      "Microsoft.Insights/actiongroups"
    ];
  }

  getMockCostTrends(days = 30) {
    const trends = [];
    const baseCost = 15; // Base daily cost
    const variance = 5; // Daily variance
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate realistic daily cost with some variance
      const dailyCost = baseCost + (Math.random() * variance * 2 - variance);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        cost: Math.round(dailyCost * 100) / 100
      });
    }
    
    const totalCost = trends.reduce((sum, item) => sum + item.cost, 0);
    
    return {
      timeframe: `${days} days`,
      currency: 'USD',
      trends: trends,
      totalCost: totalCost
    };
  }

  processResourceTypes(resources) {
    const processed = {};
    
    resources.forEach(resource => {
      const type = resource.type;
      if (!processed[type]) {
        processed[type] = { count: 0, resources: [] };
      }
      processed[type].count += 1;
      processed[type].resources.push(resource);
    });
    
    return processed;
  }

  isReady() {
    return this.isInitialized;
  }

  /**
   * Get resource metrics (CPU, Memory, Network) from Azure Monitor
   */
  async getResourceMetrics(resourceId, metricNames = ['Percentage CPU', 'Available Memory Bytes'], days = 30) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, returning mock metrics');
        return this.getMockResourceMetrics(resourceId, metricNames, days);
      }

      // Calculate time range
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Determine resource type from resourceId to select appropriate metrics
      const resourceType = resourceId.split('/providers/')[1]?.split('/')[0] || '';
      
      // Map metric names based on resource type
      let azureMetricNames = metricNames;
      if (resourceType.includes('Sql')) {
        // SQL Database metrics
        azureMetricNames = ['cpu_percent', 'dtu_consumption_percent', 'storage_percent', 'connection_successful', 'connection_failed'];
      } else if (resourceType.includes('Storage')) {
        // Storage Account metrics
        azureMetricNames = ['UsedCapacity', 'Transactions', 'Ingress', 'Egress'];
      } else if (resourceType.includes('Redis')) {
        // Redis Cache metrics
        azureMetricNames = ['percentProcessorTime', 'connectedclients', 'cachehits', 'cachemisses'];
      } else if (resourceType.includes('sites')) {
        // App Service metrics
        azureMetricNames = ['CpuPercentage', 'MemoryPercentage', 'Http2xx', 'Http5xx', 'Requests'];
      } else if (resourceType.includes('virtualMachines')) {
        // VM metrics
        azureMetricNames = ['Percentage CPU', 'Available Memory Bytes', 'Disk Read Bytes', 'Disk Write Bytes'];
      } else {
        // Default metrics - map common names
        const metricMap = {
          'CPU Percentage': 'Percentage CPU',
          'Percentage CPU': 'Percentage CPU',
          'CpuPercentage': 'Percentage CPU',
          'Memory Percentage': 'Available Memory Bytes',
          'Available Memory Bytes': 'Available Memory Bytes',
          'Memory Working Set': 'Memory Working Set',
          'Network In': 'Network In',
          'Network Out': 'Network Out',
          'Bytes Received': 'Bytes Received',
          'Bytes Sent': 'Bytes Sent'
        };
        azureMetricNames = metricNames.map(name => metricMap[name] || name);
      }
      
      // Build metrics query
      const metrics = azureMetricNames.map(metric => ({
        name: { value: metric },
        aggregation: 'Average',
        timeGrain: 'PT1H' // 1 hour intervals
      }));

      const query = {
        timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
        interval: 'PT1H',
        metricnames: azureMetricNames.join(','),
        aggregation: 'Average'
      };

      // Get metrics from Azure Monitor API
      const encodedResourceId = encodeURIComponent(resourceId);
      const url = `https://management.azure.com${encodedResourceId}/providers/Microsoft.Insights/metrics`;
      
      const token = await this.getAccessToken();
      
      try {
        const response = await axios.get(url, {
          params: {
            'api-version': '2018-01-01',
            ...query
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });

      if (response.data && response.data.value) {
        const metricsData = {};
        
        response.data.value.forEach(metric => {
          const metricName = metric.name.value;
          const timeseries = metric.timeseries || [];
          
          if (timeseries.length > 0 && timeseries[0].data) {
            const dataPoints = timeseries[0].data.filter(dp => dp.average !== null && dp.average !== undefined);
            
            if (dataPoints.length > 0) {
              const values = dataPoints.map(dp => dp.average).filter(v => !isNaN(v) && isFinite(v));
              
              if (values.length > 0) {
                metricsData[metricName] = {
                  average: values.reduce((a, b) => a + b, 0) / values.length,
                  max: Math.max(...values),
                  min: Math.min(...values),
                  dataPoints: dataPoints.map(dp => ({
                    timestamp: dp.timeStamp,
                    value: dp.average
                  }))
                };
              }
            }
          }
        });

        return {
          resourceId,
          period: `Last ${days} days`,
          metrics: metricsData,
          success: Object.keys(metricsData).length > 0,
          note: Object.keys(metricsData).length > 0 ? 'Metrics retrieved successfully' : 'No valid metrics data available'
        };
      }

      return {
        resourceId,
        period: `Last ${days} days`,
        metrics: {},
        success: false,
        note: 'No metrics data in response'
      };
      } catch (apiError) {
        // If 404 or resource doesn't support metrics, return empty but don't fail
        if (apiError.response?.status === 404) {
          console.log(`ℹ️ Metrics not available for ${resourceId.split('/').pop()} (resource may not support metrics)`);
          return {
            resourceId,
            period: `Last ${days} days`,
            metrics: {},
            success: false,
            note: 'Resource does not support metrics API'
          };
        }
        throw apiError; // Re-throw other errors
      }
    } catch (error) {
      console.error(`❌ Failed to get resource metrics for ${resourceId.split('/').pop()}:`, error.message);
      return {
        resourceId,
        period: `Last ${days} days`,
        metrics: {},
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get resource configuration (SKU, size, properties)
   */
  async getResourceConfiguration(resourceId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Azure service not initialized, returning mock configuration');
        return this.getMockResourceConfiguration(resourceId);
      }

      const token = await this.getAccessToken();
      const encodedResourceId = encodeURIComponent(resourceId);
      
      // Get resource details
      const response = await axios.get(
        `https://management.azure.com${encodedResourceId}?api-version=2021-04-01`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const resource = response.data;
      const resourceType = resource.type;
      
      // Extract configuration based on resource type
      const config = {
        resourceId,
        resourceName: resource.name,
        resourceType: resourceType,
        location: resource.location,
        sku: resource.sku || null,
        properties: resource.properties || {},
        tags: resource.tags || {}
      };

      // Extract specific SKU/size information based on resource type
      if (resourceType.includes('virtualMachines')) {
        config.vmSize = resource.properties?.hardwareProfile?.vmSize;
        config.osType = resource.properties?.storageProfile?.osDisk?.osType;
        config.numberOfCores = resource.properties?.hardwareProfile?.vmSize?.match(/\d+/)?.[0];
      } else if (resourceType.includes('serverFarms') || resourceType.includes('hostingEnvironments')) {
        config.sku = resource.sku;
        config.numberOfWorkers = resource.properties?.numberOfWorkers || resource.sku?.capacity;
      } else if (resourceType.includes('sites')) {
        config.appServicePlanId = resource.properties?.serverFarmId;
        config.runtime = resource.properties?.siteConfig?.linuxFxVersion || resource.properties?.siteConfig?.windowsFxVersion;
      } else if (resourceType.includes('servers/databases')) {
        config.edition = resource.properties?.edition;
        config.serviceLevelObjective = resource.properties?.serviceLevelObjective;
        config.maxSizeBytes = resource.properties?.maxSizeBytes;
      }

      return {
        success: true,
        configuration: config
      };
    } catch (error) {
      console.error('❌ Failed to get resource configuration:', error.message);
      return {
        success: false,
        error: error.message,
        configuration: null
      };
    }
  }

  /**
   * Comprehensive cost analysis for a resource group
   * Fetches cost, metrics, and configuration for all resources
   * Focuses on resources with actual costs and provides actionable insights
   */
  async analyzeResourceGroupCosts(resourceGroupName, days = 30) {
    try {
      console.log(`🔍 Starting comprehensive cost analysis for: ${resourceGroupName}`);
      
      // Step 1: Get cost data
      console.log('📊 Step 1: Fetching cost data...');
      const costData = await this.getResourceGroupCosts(resourceGroupName, days);
      
      // Step 2: Get all resources in the resource group INCLUDING NESTED RESOURCES
      console.log('📦 Step 2: Fetching resources for resource group:', resourceGroupName);
      const allResources = await this.getResources({ resourceGroup: resourceGroupName });
      
      // ENHANCED: Fetch nested resources (databases, etc.)
      console.log('🔍 Fetching nested resources (databases, etc.)...');
      const nestedResources = await this.getNestedResources(resourceGroupName);
      const allResourcesWithNested = [...allResources, ...nestedResources];
      
      // Filter to ensure we only have resources from the selected resource group
      const filteredResources = allResourcesWithNested.filter(r => {
        // Extract resource group from resource ID
        const rgFromId = r.id.split('/resourceGroups/')[1]?.split('/')[0];
        return rgFromId === resourceGroupName || r.resourceGroup === resourceGroupName;
      });
      
      console.log(`📊 Total resources: ${filteredResources.length} (${allResources.length} direct + ${nestedResources.length} nested)`);
      
      // Step 3: Create a better cost lookup map with multiple matching strategies
      const costMap = new Map();
      costData.breakdown.forEach(costItem => {
        // Normalize resource ID for matching
        const normalizedId = costItem.resourceId?.toLowerCase() || '';
        const normalizedName = costItem.resourceName?.toLowerCase() || '';
        const parentResource = costItem.parentResource?.toLowerCase() || null;
        
        // Store by full resource ID (most accurate)
        if (normalizedId) {
          costMap.set(normalizedId, costItem);
        }
        
        // Store by resource name for fallback matching
        if (normalizedName) {
          costMap.set(normalizedName, costItem);
        }
        
        // For nested resources, also store by parent/child combination
        // e.g., "server/database" for SQL databases
        if (parentResource && normalizedName) {
          costMap.set(`${parentResource}/${normalizedName}`, costItem);
        }
        
        // Store by last segment of resource ID (for flexible matching)
        const idSegments = normalizedId.split('/');
        if (idSegments.length > 0) {
          const lastSegment = idSegments[idSegments.length - 1];
          if (lastSegment && lastSegment !== normalizedName) {
            costMap.set(lastSegment, costItem);
          }
        }
      });
      
      console.log(`💰 Cost map created with ${costMap.size} entries from ${costData.breakdown.length} cost items`);
      
      // Log top 10 cost items for debugging
      const topCosts = costData.breakdown
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 10);
      console.log(`📊 Top 10 cost items:`);
      topCosts.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.resourceName} (${item.resourceType}): $${item.totalCost.toFixed(2)}`);
      });
      
      // Step 4: For each resource, get metrics and configuration
      console.log(`⚙️ Step 3: Processing ${filteredResources.length} resources...`);
      const analysisData = {
        resourceGroupName,
        period: `Last ${days} days`,
        totalCost: costData.totalCost,
        currency: costData.currency,
        fromDate: costData.fromDate,
        toDate: costData.toDate,
        resources: []
      };

      // Process resources in batches to avoid overwhelming the API
      const batchSize = 5;
      let processedCount = 0;
      for (let i = 0; i < filteredResources.length; i += batchSize) {
        const batch = filteredResources.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (resource, batchIdx) => {
          try {
            // Get resource properties if not already available (needed for serverFarmId, etc.)
            if (!resource.properties && resource.id) {
              try {
                const configResult = await this.getResourceConfiguration(resource.id);
                if (configResult.success && configResult.configuration) {
                  resource.properties = configResult.configuration.properties || resource.properties || {};
                  resource.configuration = configResult.configuration;
                }
              } catch (propError) {
                // Continue without properties
              }
            }
            
            // IMPROVED: Multi-strategy cost matching logic
            let resourceCost = null;
            const normalizedResourceId = resource.id.toLowerCase();
            const normalizedResourceName = resource.name.toLowerCase();
            
            // Strategy 1: Match by full resource ID (most accurate)
            resourceCost = costMap.get(normalizedResourceId);
            
            // Strategy 2: Match by resource name
            if (!resourceCost || resourceCost.totalCost === 0) {
              resourceCost = costMap.get(normalizedResourceName);
            }
            
            // Strategy 3: For nested resources (e.g., databases), try parent/child combination
            if (!resourceCost || resourceCost.totalCost === 0) {
              const idParts = normalizedResourceId.split('/');
              if (idParts.length > 2) {
                const parentName = idParts[idParts.length - 3];
                const childName = idParts[idParts.length - 1];
                if (parentName && childName) {
                  resourceCost = costMap.get(`${parentName}/${childName}`);
                }
              }
            }
            
            // Strategy 4: Try matching by last segment of resource ID
            if (!resourceCost || resourceCost.totalCost === 0) {
              const lastSegment = normalizedResourceId.split('/').pop();
              if (lastSegment) {
                resourceCost = costMap.get(lastSegment);
              }
            }
            
            // Strategy 5: Partial match (for cases where IDs might have slight variations)
            if (!resourceCost || resourceCost.totalCost === 0) {
              for (const [key, value] of costMap.entries()) {
                // Check if resource ID ends with the cost key (for nested resources)
                if (normalizedResourceId.endsWith(key) || key.endsWith(normalizedResourceId.split('/').pop())) {
                  resourceCost = value;
                  break;
                }
              }
            }
            
            // Strategy 6: Handle cost aggregation at parent level (e.g., App Service Plan costs)
            // If this is a Web App and we have an App Service Plan cost, distribute it
            if ((!resourceCost || resourceCost.totalCost === 0) && resource.type.includes('sites')) {
              // Try to find App Service Plan costs
              const appServicePlanId = resource.properties?.serverFarmId || resource.configuration?.appServicePlanId;
              if (appServicePlanId) {
                const planCost = costMap.get(appServicePlanId.toLowerCase());
                if (planCost && planCost.totalCost > 0) {
                  // Find all Web Apps using this plan to distribute cost
                  const appsUsingPlan = filteredResources.filter(r => 
                    (r.properties?.serverFarmId || r.configuration?.appServicePlanId) === appServicePlanId
                  );
                  if (appsUsingPlan.length > 0) {
                    resourceCost = {
                      ...planCost,
                      totalCost: planCost.totalCost / appsUsingPlan.length, // Distribute evenly
                      distributed: true,
                      originalCost: planCost.totalCost
                    };
                  }
                }
              }
            }
            
            const monthlyCost = resourceCost?.totalCost || 0;
            
            // Log successful matches for debugging (first 5 cost-generating resources)
            processedCount++;
            if (monthlyCost > 0 && processedCount <= 5) {
              const matchMethod = resourceCost.resourceId?.toLowerCase() === resource.id.toLowerCase() 
                ? 'full ID' 
                : resourceCost.resourceName?.toLowerCase() === resource.name.toLowerCase()
                ? 'name'
                : 'partial';
              console.log(`✅ Cost matched for ${resource.name}: ₹${(monthlyCost * 83).toFixed(2)} (matched via ${matchMethod})`);
            }
            
            // Skip resources with zero cost (unless explicitly requested)
            // We'll add them at the end if needed, but focus on cost-generating resources
            
            // Get metrics for ALL billable resource types (not just those with costs)
            // This ensures we have utilization data for optimization recommendations
            let metrics = null;
            const isBillableType = resource.type.includes('virtualMachines') || 
                                   resource.type.includes('serverFarms') || 
                                   resource.type.includes('sites') ||
                                   resource.type.includes('Sql') ||
                                   resource.type.includes('Storage') ||
                                   resource.type.includes('CognitiveServices') ||
                                   resource.type.includes('ContainerInstance') ||
                                   resource.type.includes('Redis') ||
                                   resource.type.includes('PostgreSQL') ||
                                   resource.type.includes('MySQL') ||
                                   resource.type.includes('CosmosDB');
            
            // Fetch metrics for all billable types, regardless of cost
            // This is critical for optimization recommendations
            if (isBillableType) {
              try {
                // Determine appropriate metrics based on resource type
                let metricNames = ['Percentage CPU', 'Available Memory Bytes'];
                if (resource.type.includes('Sql')) {
                  metricNames = ['cpu_percent', 'dtu_consumption_percent', 'storage_percent'];
                } else if (resource.type.includes('Storage')) {
                  metricNames = ['UsedCapacity', 'Transactions'];
                } else if (resource.type.includes('Redis')) {
                  metricNames = ['percentProcessorTime', 'connectedclients'];
                } else if (resource.type.includes('sites')) {
                  metricNames = ['CpuPercentage', 'MemoryPercentage', 'Http2xx', 'Http5xx'];
                }
                
                metrics = await this.getResourceMetrics(resource.id, metricNames, days);
                
                if (metrics && metrics.metrics && Object.keys(metrics.metrics).length > 0) {
                  console.log(`✅ Metrics fetched for ${resource.name}: ${Object.keys(metrics.metrics).join(', ')}`);
                }
              } catch (metricError) {
                console.log(`⚠️ Could not fetch metrics for ${resource.name} (${resource.type}): ${metricError.message}`);
                // Don't fail the whole process if metrics fail
              }
            }

            // Get configuration for ALL resources (needed for SKU/size information)
            let configuration = null;
            try {
              const configResult = await this.getResourceConfiguration(resource.id);
              if (configResult.success) {
                configuration = configResult.configuration;
              } else {
                console.log(`⚠️ Configuration fetch failed for ${resource.name}: ${configResult.error}`);
              }
            } catch (configError) {
              console.log(`⚠️ Could not fetch configuration for ${resource.name}: ${configError.message}`);
            }

            // Calculate CPU and memory metrics from various metric names
            let avgCpu = null;
            let maxCpu = null;
            let avgMemoryUsedPercent = null;

            if (metrics && metrics.metrics && Object.keys(metrics.metrics).length > 0) {
              // Try different CPU metric names (order matters - try most common first)
              const cpuMetric = metrics.metrics['Percentage CPU'] || 
                               metrics.metrics['CpuPercentage'] ||
                               metrics.metrics['cpu_percent'] || 
                               metrics.metrics['percentProcessorTime'] ||
                               metrics.metrics['dtu_consumption_percent'];
              
              if (cpuMetric && cpuMetric.average !== null && cpuMetric.average !== undefined) {
                avgCpu = Math.round(cpuMetric.average * 10) / 10;
                maxCpu = Math.round(cpuMetric.max * 10) / 10;
              }

              // Try different memory metric names
              const memoryMetric = metrics.metrics['MemoryPercentage'] ||
                                  metrics.metrics['memory_percent'] ||
                                  metrics.metrics['Available Memory Bytes'];
              
              if (memoryMetric && memoryMetric.average !== null && memoryMetric.average !== undefined) {
                // If it's already a percentage (0-100)
                if (memoryMetric.average <= 100 && memoryMetric.average >= 0) {
                  avgMemoryUsedPercent = Math.round(memoryMetric.average * 10) / 10;
                } else if (memoryMetric.average > 100) {
                  // It's a raw value, try to convert (this is approximate)
                  // For App Services, MemoryPercentage is already a percentage
                  avgMemoryUsedPercent = null; // Can't reliably convert without knowing total memory
                }
              }
            }

            analysisData.resources.push({
              id: resource.id,
              name: resource.name,
              type: resource.type,
              location: resource.location,
              monthlyCost: monthlyCost,
              metrics: metrics?.metrics || null,
              configuration: configuration,
              avgCpu: avgCpu,
              maxCpu: maxCpu,
              avgMemoryUsedPercent: avgMemoryUsedPercent,
              parentResource: resource.parentResource || null,
              costMatched: resourceCost ? true : false,
              costDistribution: resourceCost?.distributed || false
            });
          } catch (error) {
            console.error(`❌ Error processing resource ${resource.name}:`, error.message);
          }
        }));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < filteredResources.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Step 5: Sort by cost (highest first) and separate cost-generating vs zero-cost resources
      analysisData.resources.sort((a, b) => b.monthlyCost - a.monthlyCost);
      
      const costGeneratingResources = analysisData.resources.filter(r => r.monthlyCost > 0);
      const zeroCostResources = analysisData.resources.filter(r => r.monthlyCost === 0);
      
      // Prioritize cost-generating resources, but include zero-cost for completeness
      // Limit zero-cost resources to top 20 to avoid clutter
      analysisData.resources = [
        ...costGeneratingResources,
        ...zeroCostResources.slice(0, 20)
      ];
      
      // Add summary statistics
      analysisData.summary = {
        totalResources: filteredResources.length,
        costGeneratingResources: costGeneratingResources.length,
        zeroCostResources: zeroCostResources.length,
        totalCostFromResources: costGeneratingResources.reduce((sum, r) => sum + r.monthlyCost, 0),
        topCostResources: costGeneratingResources.slice(0, 10).map(r => ({
          name: r.name,
          type: r.type,
          cost: r.monthlyCost
        }))
      };

      console.log(`✅ Cost analysis complete:`);
      console.log(`   - Total resources: ${analysisData.summary.totalResources}`);
      console.log(`   - Cost-generating: ${analysisData.summary.costGeneratingResources}`);
      console.log(`   - Total cost from resources: $${analysisData.summary.totalCostFromResources.toFixed(2)}`);
      console.log(`   - API total cost: $${costData.totalCost.toFixed(2)}`);
      
      return analysisData;
    } catch (error) {
      console.error('❌ Failed to analyze resource group costs:', error.message);
      throw error;
    }
  }

  /**
   * Get nested resources (databases, etc.) for a resource group
   */
  async getNestedResources(resourceGroupName) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        return [];
      }

      const nestedResources = [];
      const token = await this.getAccessToken();

      // Get SQL servers and their databases
      try {
        const sqlServers = await this.makeAzureRequest(
          `/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Sql/servers`
        );

        if (sqlServers.value && sqlServers.value.length > 0) {
          for (const server of sqlServers.value) {
            try {
              // Get databases for this server
              const databases = await this.makeAzureRequest(
                `${server.id}/databases`
              );

              if (databases.value) {
                databases.value.forEach(db => {
                  nestedResources.push({
                    id: db.id,
                    name: db.name,
                    type: db.type,
                    location: db.location || server.location,
                    resourceGroup: resourceGroupName,
                    properties: db.properties || {},
                    parentResource: server.id,
                    parentName: server.name
                  });
                });
              }
            } catch (dbError) {
              console.log(`⚠️ Could not fetch databases for ${server.name}: ${dbError.message}`);
            }
          }
        }
      } catch (sqlError) {
        console.log(`⚠️ Could not fetch SQL servers: ${sqlError.message}`);
      }

      // Get Storage Account containers (if needed)
      // Get other nested resources as needed

      console.log(`📦 Found ${nestedResources.length} nested resources`);
      return nestedResources;
    } catch (error) {
      console.error('❌ Failed to get nested resources:', error.message);
      return [];
    }
  }

  // Mock methods for fallback
  getMockResourceMetrics(resourceId, metricNames, days) {
    return {
      resourceId,
      period: `Last ${days} days`,
      metrics: {
        'Percentage CPU': {
          average: 25 + Math.random() * 30,
          max: 60 + Math.random() * 30,
          min: 10 + Math.random() * 10,
          dataPoints: []
        },
        'Available Memory Bytes': {
          average: 1024 * 1024 * 1024 * 0.7, // 70% available
          max: 1024 * 1024 * 1024,
          min: 1024 * 1024 * 1024 * 0.5,
          dataPoints: []
        }
      },
      success: true
    };
  }

  getMockResourceConfiguration(resourceId) {
    return {
      success: true,
      configuration: {
        resourceId,
        resourceName: resourceId.split('/').pop(),
        resourceType: 'Microsoft.Web/serverFarms',
        location: 'eastus',
        sku: {
          name: 'B1',
          tier: 'Basic',
          capacity: 1
        },
        properties: {}
      }
    };
  }
}

module.exports = AzureService;
