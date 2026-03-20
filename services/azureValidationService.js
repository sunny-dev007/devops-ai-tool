const { ClientSecretCredential } = require('@azure/identity');
const { ResourceManagementClient } = require('@azure/arm-resources');
const { ComputeManagementClient } = require('@azure/arm-compute');
const { WebSiteManagementClient } = require('@azure/arm-appservice');
const { SqlManagementClient } = require('@azure/arm-sql');
const { normalizeLinuxRuntimeForAzCli } = require('./webAppRuntimeUtils');

class AzureValidationService {
  constructor() {
    this.credential = null;
    this.subscriptionId = null;
    this.resourceClient = null;
    this.computeClient = null;
    this.webClient = null;
    this.sqlClient = null;
    this.initializeClients();
  }

  initializeClients() {
    try {
      const clientId = process.env.AZURE_CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET;
      const tenantId = process.env.AZURE_TENANT_ID;
      this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

      if (!clientId || !clientSecret || !tenantId || !this.subscriptionId) {
        console.warn('⚠️ Azure validation credentials not configured');
        return;
      }

      this.credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
      this.resourceClient = new ResourceManagementClient(this.credential, this.subscriptionId);
      this.computeClient = new ComputeManagementClient(this.credential, this.subscriptionId);
      this.webClient = new WebSiteManagementClient(this.credential, this.subscriptionId);
      this.sqlClient = new SqlManagementClient(this.credential, this.subscriptionId);

      console.log('✅ Azure validation clients initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azure validation clients:', error.message);
    }
  }

  /**
   * Validate if a region is available for a specific resource type
   */
  async checkRegionAvailability(resourceType, region) {
    try {
      if (!this.resourceClient) {
        return { available: true, message: 'Validation skipped - clients not initialized' };
      }

      // Normalize region name (remove spaces, lowercase)
      const normalizedRegion = region.toLowerCase().replace(/\s+/g, '');

      // Get all available locations for the subscription
      const locations = await this.resourceClient.subscriptions.listLocations(this.subscriptionId);
      const availableRegions = locations.map(loc => loc.name.toLowerCase());

      const isAvailable = availableRegions.includes(normalizedRegion);

      return {
        available: isAvailable,
        message: isAvailable 
          ? `Region ${region} is available` 
          : `Region ${region} is not available`,
        availableRegions: isAvailable ? [] : availableRegions.slice(0, 10) // Return top 10 alternatives
      };
    } catch (error) {
      console.error(`Error checking region availability for ${region}:`, error.message);
      return { available: true, message: 'Validation skipped due to error', error: error.message };
    }
  }

  /**
   * Check quota availability for App Service Plans across multiple regions
   * Returns regions with available quota
   */
  async checkQuotaAcrossRegions(sku = 'B1') {
    try {
      if (!this.computeClient) {
        console.warn('⚠️ Compute client not initialized, skipping quota check');
        return { 
          availableRegions: [],
          exhaustedRegions: [],
          skippedValidation: true 
        };
      }

      console.log(`🔍 Checking ${sku} quota availability across regions...`);

      // Priority regions to check (most commonly used)
      const priorityRegions = [
        'centralindia',
        'southindia',
        'eastus',
        'westus',
        'westus2',
        'centralus',
        'eastus2',
        'westeurope',
        'northeurope',
        'southeastasia',
        'eastasia'
      ];

      const availableRegions = [];
      const exhaustedRegions = [];

      for (const region of priorityRegions) {
        try {
          // Check usage for VMs (App Service Plans use VM quota)
          const usages = await this.computeClient.usage.list(region);
          
          // Look for StandardBSFamily (Basic tier) or relevant family
          const relevantUsage = Array.from(usages).find(usage => 
            usage.name?.value?.includes('StandardBSFamily') ||
            usage.name?.value?.includes('BasicAFamily') ||
            usage.name?.value?.includes('cores')
          );

          if (relevantUsage) {
            const limit = relevantUsage.limit || 0;
            const currentValue = relevantUsage.currentValue || 0;
            const available = limit - currentValue;

            console.log(`   ${region}: ${currentValue}/${limit} used, ${available} available`);

            if (available > 0) {
              availableRegions.push({
                region,
                available,
                limit,
                currentValue,
                percentUsed: Math.round((currentValue / limit) * 100)
              });
            } else {
              exhaustedRegions.push({
                region,
                limit,
                currentValue,
                message: `Quota exhausted (${currentValue}/${limit})`
              });
            }
          } else {
            // If no specific quota found, assume available (region might not enforce quota)
            availableRegions.push({
              region,
              available: 999,
              limit: 999,
              currentValue: 0,
              percentUsed: 0,
              note: 'No quota restrictions found'
            });
          }
        } catch (error) {
          // If error checking region, skip it
          console.warn(`   ⚠️ Could not check quota for ${region}:`, error.message);
        }
      }

      console.log(`✅ Quota check complete:`);
      console.log(`   Available regions: ${availableRegions.length}`);
      console.log(`   Exhausted regions: ${exhaustedRegions.length}`);

      return {
        availableRegions: availableRegions.sort((a, b) => b.available - a.available), // Sort by most available
        exhaustedRegions,
        skippedValidation: false
      };
    } catch (error) {
      console.error('❌ Failed to check quota across regions:', error.message);
      return {
        availableRegions: [],
        exhaustedRegions: [],
        skippedValidation: true,
        error: error.message
      };
    }
  }

  /**
   * Check if an App Service Plan SKU is available in a region
   */
  async checkAppServiceSKUAvailability(sku, region) {
    try {
      if (!this.webClient) {
        return { available: true, message: 'Validation skipped - clients not initialized' };
      }

      // Get available SKUs for App Service in the region
      const skus = await this.webClient.listSkus();
      const normalizedRegion = region.toLowerCase().replace(/\s+/g, '');
      const normalizedSKU = sku.toUpperCase();

      // Check if SKU is available in the region
      const availableSKUs = skus.filter(s => 
        s.locations && s.locations.some(loc => loc.toLowerCase().replace(/\s+/g, '') === normalizedRegion)
      );

      const isAvailable = availableSKUs.some(s => s.name && s.name.toUpperCase() === normalizedSKU);

      const alternatives = isAvailable ? [] : availableSKUs
        .filter(s => s.name)
        .map(s => s.name)
        .slice(0, 5);

      return {
        available: isAvailable,
        message: isAvailable 
          ? `SKU ${sku} is available in ${region}` 
          : `SKU ${sku} is not available in ${region}`,
        alternatives: alternatives
      };
    } catch (error) {
      console.error(`Error checking App Service SKU availability:`, error.message);
      return { available: true, message: 'Validation skipped due to error', error: error.message };
    }
  }

  /**
   * Check VM quota availability in a region
   */
  async checkVMQuotaAvailability(region, vmSize = 'Standard_B1s') {
    try {
      if (!this.computeClient) {
        return { available: true, message: 'Validation skipped - clients not initialized' };
      }

      const normalizedRegion = region.toLowerCase().replace(/\s+/g, '');
      
      // Get current usage for the region
      const usages = await this.computeClient.usage.list(normalizedRegion);
      
      // Look for VM core quota
      const vmQuota = usages.find(u => 
        u.name && u.name.localizedValue && 
        u.name.localizedValue.toLowerCase().includes('total regional vcpus')
      );

      if (!vmQuota) {
        return { available: true, message: 'Could not determine quota, proceeding with caution' };
      }

      const currentUsage = vmQuota.currentValue || 0;
      const limit = vmQuota.limit || 0;
      const available = (limit - currentUsage) > 0;

      return {
        available: available,
        message: available 
          ? `Quota available in ${region}: ${currentUsage}/${limit} vCPUs used` 
          : `Quota exhausted in ${region}: ${currentUsage}/${limit} vCPUs used`,
        currentUsage: currentUsage,
        limit: limit,
        remaining: limit - currentUsage,
        suggestions: available ? [] : [
          'Request quota increase via Azure Portal',
          'Try a different region with available quota',
          'Delete unused resources to free up quota'
        ]
      };
    } catch (error) {
      console.error(`Error checking VM quota availability:`, error.message);
      return { available: true, message: 'Validation skipped due to error', error: error.message };
    }
  }

  /**
   * Get recommended regions for a resource type
   */
  async getRecommendedRegions(resourceType, count = 5) {
    try {
      if (!this.resourceClient) {
        return ['eastus', 'westus2', 'centralindia', 'westeurope', 'southeastasia'];
      }

      const locations = await this.resourceClient.subscriptions.listLocations(this.subscriptionId);
      
      // Prefer regions with good availability and low latency
      const preferredRegions = [
        'eastus', 'westus2', 'centralus', 'centralindia', 
        'southindia', 'westeurope', 'northeurope', 'southeastasia'
      ];

      const availableRegions = locations.map(loc => loc.name.toLowerCase());
      const recommended = preferredRegions
        .filter(region => availableRegions.includes(region))
        .slice(0, count);

      return recommended.length > 0 ? recommended : availableRegions.slice(0, count);
    } catch (error) {
      console.error(`Error getting recommended regions:`, error.message);
      return ['eastus', 'westus2', 'centralindia', 'westeurope', 'southeastasia'];
    }
  }

  /**
   * Get recommended SKUs for App Service Plan
   */
  getRecommendedAppServiceSKUs() {
    return [
      { name: 'B1', tier: 'Basic', description: 'Basic tier, cost-effective for development/testing' },
      { name: 'S1', tier: 'Standard', description: 'Standard tier, good for production workloads' },
      { name: 'P1v2', tier: 'Premium V2', description: 'Premium tier, high performance' },
      { name: 'F1', tier: 'Free', description: 'Free tier, limited resources (may require quota)' }
    ];
  }

  /**
   * Validate web app runtime availability
   */
  async checkWebAppRuntimeAvailability(runtime, region) {
    try {
      // Common available runtimes (these are generally available)
      const availableRuntimes = [
        'NODE:20-lts', 'NODE:22-lts', 'NODE:24-lts',
        'PYTHON:3.11', 'PYTHON:3.12', 'PYTHON:3.13',
        'DOTNETCORE:8.0', 'DOTNETCORE:9.0', 'DOTNETCORE:10.0',
        'JAVA:17-java17', 'JAVA:21-java21',
        'PHP:8.2', 'PHP:8.3', 'PHP:8.4',
        'dotnet:8', 'dotnet:9', 'dotnet:10'
      ];

      const canonical = runtime.includes('|') || /^node:/i.test(runtime)
        ? normalizeLinuxRuntimeForAzCli(runtime)
        : runtime.trim();
      const normalizedRuntime = canonical.toLowerCase();
      const isAvailable = availableRuntimes.some(r => r.toLowerCase() === normalizedRuntime);

      return {
        available: isAvailable,
        message: isAvailable 
          ? `Runtime ${runtime} is generally available` 
          : `Runtime ${runtime} may not be available`,
        alternatives: isAvailable ? [] : availableRuntimes.slice(0, 5),
        recommendation: 'Consider creating web app without runtime specification and configuring it manually in Azure Portal'
      };
    } catch (error) {
      console.error(`Error checking web app runtime:`, error.message);
      return { available: true, message: 'Validation skipped due to error' };
    }
  }

  /**
   * Comprehensive validation for resource cloning
   */
  async validateResourceForCloning(resource, targetRegion) {
    console.log(`🔍 Validating ${resource.type} in region ${targetRegion}...`);

    const validationResult = {
      resourceName: resource.name,
      resourceType: resource.type,
      originalRegion: resource.location,
      targetRegion: targetRegion,
      validations: {},
      isValid: true,
      warnings: [],
      suggestions: []
    };

    try {
      // 1. Validate region availability
      const regionCheck = await this.checkRegionAvailability(resource.type, targetRegion);
      validationResult.validations.region = regionCheck;
      if (!regionCheck.available) {
        validationResult.isValid = false;
        validationResult.suggestions.push({
          type: 'region',
          message: 'Target region not available',
          alternatives: regionCheck.availableRegions
        });
      }

      // 2. Type-specific validations
      if (resource.type.includes('Microsoft.Web/serverfarms')) {
        // App Service Plan validation
        const sku = resource.sku?.name || 'B1';
        const skuCheck = await this.checkAppServiceSKUAvailability(sku, targetRegion);
        validationResult.validations.sku = skuCheck;
        
        if (!skuCheck.available) {
          validationResult.warnings.push(`SKU ${sku} not available, alternatives suggested`);
          validationResult.suggestions.push({
            type: 'sku',
            original: sku,
            alternatives: skuCheck.alternatives.length > 0 
              ? skuCheck.alternatives 
              : this.getRecommendedAppServiceSKUs().map(s => s.name)
          });
        }

        // Check quota
        const quotaCheck = await this.checkVMQuotaAvailability(targetRegion);
        validationResult.validations.quota = quotaCheck;
        
        if (!quotaCheck.available) {
          validationResult.warnings.push(`Quota may be exhausted in ${targetRegion}`);
          validationResult.suggestions.push({
            type: 'quota',
            message: quotaCheck.message,
            suggestions: quotaCheck.suggestions
          });
        }
      } else if (resource.type.includes('Microsoft.Web/sites')) {
        // Web App validation
        if (resource.properties?.siteConfig?.linuxFxVersion) {
          const runtime = resource.properties.siteConfig.linuxFxVersion;
          const runtimeCheck = await this.checkWebAppRuntimeAvailability(runtime, targetRegion);
          validationResult.validations.runtime = runtimeCheck;
          
          if (!runtimeCheck.available) {
            validationResult.warnings.push(`Runtime ${runtime} may not be available`);
            validationResult.suggestions.push({
              type: 'runtime',
              original: runtime,
              alternatives: runtimeCheck.alternatives,
              recommendation: runtimeCheck.recommendation
            });
          }
        }
      } else if (resource.type.includes('Microsoft.Compute/virtualMachines')) {
        // VM validation
        const quotaCheck = await this.checkVMQuotaAvailability(targetRegion);
        validationResult.validations.quota = quotaCheck;
        
        if (!quotaCheck.available) {
          validationResult.isValid = false;
          validationResult.suggestions.push({
            type: 'quota',
            message: quotaCheck.message,
            suggestions: quotaCheck.suggestions
          });
        }
      }

      console.log(`✅ Validation completed for ${resource.name}: ${validationResult.isValid ? 'VALID' : 'NEEDS ATTENTION'}`);
      return validationResult;
    } catch (error) {
      console.error(`❌ Error validating ${resource.name}:`, error.message);
      validationResult.warnings.push(`Validation error: ${error.message}`);
      return validationResult;
    }
  }

  /**
   * Validate entire resource group for cloning
   */
  async validateResourceGroupForCloning(sourceResourceGroup, targetResourceGroup, resources) {
    console.log(`🔍 Starting comprehensive validation for cloning ${sourceResourceGroup} to ${targetResourceGroup}...`);

    const overallValidation = {
      sourceResourceGroup: sourceResourceGroup,
      targetResourceGroup: targetResourceGroup,
      targetRegion: resources[0]?.location || 'eastus',
      totalResources: resources.length,
      validatedResources: [],
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      isValid: true
    };

    try {
      // Validate each resource
      for (const resource of resources) {
        const resourceValidation = await this.validateResourceForCloning(
          resource, 
          overallValidation.targetRegion
        );
        overallValidation.validatedResources.push(resourceValidation);

        if (!resourceValidation.isValid) {
          overallValidation.isValid = false;
          overallValidation.criticalIssues.push({
            resourceName: resource.name,
            issues: resourceValidation.suggestions
          });
        }

        if (resourceValidation.warnings.length > 0) {
          overallValidation.warnings.push(...resourceValidation.warnings);
        }
      }

      // Add overall recommendations
      if (!overallValidation.isValid) {
        overallValidation.recommendations.push(
          'Review suggested alternatives and click "Accept Suggestions" to proceed'
        );
      }

      if (overallValidation.warnings.length > 0) {
        overallValidation.recommendations.push(
          'Review warnings and ensure configurations are correct before proceeding'
        );
      }

      // Get recommended regions if current region has issues
      const recommendedRegions = await this.getRecommendedRegions('all', 5);
      overallValidation.recommendedRegions = recommendedRegions;

      console.log(`✅ Overall validation completed: ${overallValidation.isValid ? 'VALID' : 'REQUIRES USER INPUT'}`);
      return overallValidation;
    } catch (error) {
      console.error(`❌ Error during resource group validation:`, error.message);
      overallValidation.warnings.push(`Validation error: ${error.message}`);
      return overallValidation;
    }
  }
}

// Export singleton instance
module.exports = new AzureValidationService();

