const axios = require('axios');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

/**
 * DevOps Monitor Service for Azure DevOps Integration
 * Handles projects, repositories, branches, commits, PRs, work items, and test generation
 */
class DevOpsMonitorService {
  constructor() {
    // Azure DevOps Configuration
    this.organization = process.env.AZURE_DEVOPS_ORGANIZATION || '';
    this.pat = process.env.AZURE_DEVOPS_PAT || '';
    this.baseUrl = this.organization 
      ? `https://dev.azure.com/${this.organization}`
      : '';
    
    // Azure OpenAI Configuration for Test Generation
    this.endpoint = process.env.AZURE_OPENAI_AGENT_ENDPOINT || 'https://smartdocs-hive.openai.azure.com/';
    this.apiKey = process.env.AZURE_OPENAI_AGENT_KEY || '';
    this.deploymentName = process.env.AZURE_OPENAI_AGENT_DEPLOYMENT || 'gpt-4o';
    
    this.client = null;
    this.initializeClient();
  }

  initializeClient() {
    try {
      if (this.apiKey && this.endpoint) {
        this.client = new OpenAIClient(
          this.endpoint,
          new AzureKeyCredential(this.apiKey)
        );
        console.log('✅ DevOps Monitor Service initialized with Azure OpenAI');
      } else {
        console.warn('⚠️ Azure OpenAI credentials not configured for DevOps Monitor');
      }
    } catch (error) {
      console.error('❌ Failed to initialize DevOps Monitor Service:', error.message);
    }
  }

  /**
   * Get Azure DevOps API headers with authentication
   * Supports both PAT and OAuth token
   */
  getHeaders(accessToken = null) {
    if (accessToken) {
      // Use OAuth token (from MSAL)
      return {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
    } else if (this.pat) {
      // Fallback to PAT if available
      const auth = Buffer.from(`:${this.pat}`).toString('base64');
      return {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      };
    } else {
      throw new Error('No authentication method available');
    }
  }

  /**
   * Extract organization from access token or account
   */
  async extractOrganizationFromToken(accessToken) {
    try {
      // Try to get user profile to extract organization
      const response = await axios.get(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
        { headers: this.getHeaders(accessToken) }
      );
      // Organization is typically in the account structure
      // This is a placeholder - actual implementation may vary
      return '';
    } catch (error) {
      console.log('Could not extract organization from token');
      return '';
    }
  }

  /**
   * Check if DevOps is configured and connected using OAuth token
   */
  async checkConnectionWithToken(accessToken) {
    if (!accessToken) {
      return {
        connected: false,
        message: 'No access token provided'
      };
    }

    try {
      // Try to get projects to verify connection
      // First, we need to determine the organization
      // For now, we'll try to get user profile which works across organizations
      const profileResponse = await axios.get(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
        { headers: this.getHeaders(accessToken) }
      );

      // Get accounts (organizations) for the user
      const accountsResponse = await axios.get(
        'https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.1',
        { headers: this.getHeaders(accessToken) }
      );

      const accounts = accountsResponse.data.value || [];
      const organization = accounts.length > 0 ? accounts[0].accountName : '';

      return {
        connected: true,
        organization: organization,
        accounts: accounts
      };
    } catch (error) {
      return {
        connected: false,
        message: error.message
      };
    }
  }

  /**
   * Check if DevOps is configured and connected (legacy PAT method)
   */
  async checkConnection() {
    if (!this.organization || !this.pat) {
      return {
        connected: false,
        message: 'Azure DevOps not configured. Please authenticate using MSAL.'
      };
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/_apis/projects?api-version=7.1`,
        { headers: this.getHeaders() }
      );
      return {
        connected: true,
        organization: this.organization,
        projects: response.data.value || []
      };
    } catch (error) {
      return {
        connected: false,
        message: error.message
      };
    }
  }

  /**
   * Get all projects
   * @param {string} accessToken - OAuth access token
   * @param {string} organization - Azure DevOps organization name
   */
  async getProjects(accessToken = null, organization = null) {
    try {
      const org = organization || this.organization;
      if (!org) {
        throw new Error('Organization is required');
      }

      const baseUrl = `https://dev.azure.com/${org}`;
      const response = await axios.get(
        `${baseUrl}/_apis/projects?api-version=7.1`,
        { headers: this.getHeaders(accessToken) }
      );
      return response.data.value || [];
    } catch (error) {
      console.error('Failed to get projects:', error.message);
      throw new Error(`Failed to retrieve projects: ${error.message}`);
    }
  }

  /**
   * Get repositories for a project
   * @param {string} projectId - Project ID
   * @param {string} accessToken - OAuth access token
   * @param {string} organization - Azure DevOps organization name
   */
  async getRepositories(projectId, accessToken = null, organization = null) {
    try {
      const org = organization || this.organization;
      if (!org) {
        throw new Error('Organization is required');
      }

      const baseUrl = `https://dev.azure.com/${org}`;
      const response = await axios.get(
        `${baseUrl}/${projectId}/_apis/git/repositories?api-version=7.1`,
        { headers: this.getHeaders(accessToken) }
      );
      return response.data.value || [];
    } catch (error) {
      console.error('Failed to get repositories:', error.message);
      throw new Error(`Failed to retrieve repositories: ${error.message}`);
    }
  }

  /**
   * Get branches for a repository
   */
  async getBranches(projectId, repositoryId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${projectId}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=7.1`,
        { headers: this.getHeaders() }
      );
      return (response.data.value || []).map(ref => ({
        name: ref.name.replace('refs/heads/', ''),
        objectId: ref.objectId
      }));
    } catch (error) {
      console.error('Failed to get branches:', error.message);
      throw new Error(`Failed to retrieve branches: ${error.message}`);
    }
  }

  /**
   * Get commits for a repository and branch
   */
  async getCommits(projectId, repositoryId, branchName) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${projectId}/_apis/git/repositories/${repositoryId}/commits?searchCriteria.itemVersion.version=${branchName}&$top=50&api-version=7.1`,
        { headers: this.getHeaders() }
      );
      return response.data.value || [];
    } catch (error) {
      console.error('Failed to get commits:', error.message);
      throw new Error(`Failed to retrieve commits: ${error.message}`);
    }
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(projectId, repositoryId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${projectId}/_apis/git/repositories/${repositoryId}/pullrequests?status=active&api-version=7.1`,
        { headers: this.getHeaders() }
      );
      return response.data.value || [];
    } catch (error) {
      console.error('Failed to get pull requests:', error.message);
      throw new Error(`Failed to retrieve pull requests: ${error.message}`);
    }
  }

  /**
   * Get work items for a project
   */
  async getWorkItems(projectId) {
    try {
      // Get work items using WIQL (Work Item Query Language)
      const wiqlQuery = {
        query: `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.ChangedDate] DESC`
      };

      const response = await axios.post(
        `${this.baseUrl}/${projectId}/_apis/wit/wiql?api-version=7.1`,
        wiqlQuery,
        { headers: this.getHeaders() }
      );

      const workItemIds = response.data.workItems.map(wi => wi.id);
      
      if (workItemIds.length === 0) {
        return [];
      }

      // Get detailed work item information
      const detailsResponse = await axios.post(
        `${this.baseUrl}/${projectId}/_apis/wit/workitems?ids=${workItemIds.join(',')}&$expand=all&api-version=7.1`,
        null,
        { headers: this.getHeaders() }
      );

      return detailsResponse.data.value || [];
    } catch (error) {
      console.error('Failed to get work items:', error.message);
      throw new Error(`Failed to retrieve work items: ${error.message}`);
    }
  }

  /**
   * Get changed files between two refs (for PR diff)
   */
  async getChangedFiles(projectId, repositoryId, sourceRef, targetRef) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${projectId}/_apis/git/repositories/${repositoryId}/diffs/commits?baseVersion=${targetRef}&targetVersion=${sourceRef}&api-version=7.1`,
        { headers: this.getHeaders() }
      );
      
      return (response.data.changeCounts || []).map(change => ({
        path: change.item?.path || '',
        changeType: change.changeType || 'edit',
        linesAdded: change.linesAdded || 0,
        linesDeleted: change.linesDeleted || 0
      }));
    } catch (error) {
      console.error('Failed to get changed files:', error.message);
      // Return empty array if diff fails (might be due to ref format)
      return [];
    }
  }

  /**
   * Get file diff content
   */
  async getFileDiff(projectId, repositoryId, filePath, sourceRef, targetRef) {
    try {
      // Get the file content from both refs
      const [sourceContent, targetContent] = await Promise.all([
        this.getFileContent(projectId, repositoryId, filePath, sourceRef).catch(() => ''),
        this.getFileContent(projectId, repositoryId, filePath, targetRef).catch(() => '')
      ]);

      // Simple diff generation (in production, use a proper diff library)
      return this.generateSimpleDiff(targetContent, sourceContent);
    } catch (error) {
      console.error('Failed to get file diff:', error.message);
      throw new Error(`Failed to retrieve file diff: ${error.message}`);
    }
  }

  /**
   * Get file content from a specific ref
   */
  async getFileContent(projectId, repositoryId, filePath, ref) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${projectId}/_apis/git/repositories/${repositoryId}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${ref}&api-version=7.1`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate simple diff (for demo purposes)
   */
  generateSimpleDiff(oldContent, newContent) {
    const oldLines = (oldContent || '').split('\n');
    const newLines = (newContent || '').split('\n');
    
    let diff = '';
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (oldLine !== newLine) {
        if (oldLine) diff += `- ${oldLine}\n`;
        if (newLine) diff += `+ ${newLine}\n`;
      } else {
        diff += `  ${oldLine}\n`;
      }
    }
    
    return diff;
  }

  /**
   * Generate Playwright BDD tests using LLM
   */
  async generateTests(context) {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }

    const {
      projectId,
      repositoryId,
      branch,
      files,
      feature,
      context: additionalContext
    } = context;

    try {
      // Build system prompt for test generation
      const systemPrompt = `You are an expert QA automation engineer specializing in Playwright BDD test generation.
Your task is to generate comprehensive, production-ready Playwright BDD tests based on code changes, feature descriptions, and context.

Requirements:
1. Generate tests in Playwright format with BDD-style structure
2. Use proper selectors (prefer data-testid, role, or stable selectors)
3. Include explicit assertions and expected behaviors
4. Add proper test metadata (title, tags, severity, ticket id if available)
5. Follow best practices: page object pattern, proper waits, error handling
6. Include both positive and negative test cases where applicable
7. Use proper test organization (describe blocks, test cases)

Output format: Return only the test code, wrapped in markdown code block with language "typescript"`;

      // Build user prompt with context
      const userPrompt = `Generate Playwright BDD tests for the following:

Feature: ${feature || 'Default Feature'}
Branch: ${branch || 'main'}
Files Changed: ${files?.join(', ') || 'N/A'}

${additionalContext?.commits ? `Recent Commits:\n${JSON.stringify(additionalContext.commits.slice(0, 3), null, 2)}` : ''}

${additionalContext?.pr ? `Pull Request Context:\n${JSON.stringify(additionalContext.pr, null, 2)}` : ''}

${additionalContext?.workItems ? `Related Work Items:\n${JSON.stringify(additionalContext.workItems.slice(0, 3), null, 2)}` : ''}

Please generate comprehensive Playwright BDD tests that cover the functionality described in the changed files and context.`;

      const response = await this.client.getChatCompletions(
        this.deploymentName,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.2,
          maxTokens: 4000,
          topP: 0.9
        }
      );

      let testCode = response.choices[0].message.content;

      // Clean up markdown code blocks if present
      testCode = testCode.replace(/```typescript\n?/g, '').replace(/```\n?/g, '').trim();

      const testId = `test-${Date.now()}`;
      const testName = `Generated Test: ${feature || 'Default Feature'}`;

      return {
        testId,
        testName,
        testCode,
        files: files || [],
        status: 'generated',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to generate tests:', error.message);
      throw new Error(`Test generation failed: ${error.message}`);
    }
  }

  /**
   * Save generated test to repository (or storage)
   */
  async saveTest(testId, testCode, projectId, repositoryId) {
    // In a real implementation, this would:
    // 1. Save to a database/storage for tracking
    // 2. Optionally commit to a git branch in the repository
    // For now, we'll just return success
    
    return {
      success: true,
      testId,
      message: 'Test saved successfully'
    };
  }

  /**
   * Run tests using Playwright
   */
  async runTests(testId, options) {
    // In a real implementation, this would:
    // 1. Retrieve the test code
    // 2. Set up a test runner environment
    // 3. Execute Playwright tests
    // 4. Collect Allure results
    // 5. Generate and store reports
    
    const runId = `run-${Date.now()}`;
    
    // Simulate test execution (in production, this would be actual Playwright execution)
    return {
      runId,
      testId,
      status: 'running',
      startedAt: new Date().toISOString()
    };
  }

  /**
   * Get test run results
   */
  async getTestRunResults(runId) {
    // In a real implementation, this would retrieve actual test results
    // For now, return mock data
    return {
      id: runId,
      status: 'completed',
      results: {
        total: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        duration: 45000,
        tests: [
          { name: 'Login Test', status: 'passed', duration: 5000 },
          { name: 'Navigation Test', status: 'passed', duration: 3000 },
          { name: 'Form Validation Test', status: 'failed', duration: 2000, error: 'Element not found' }
        ]
      },
      allureReportUrl: `/api/devops-monitor/test-runs/${runId}/allure-report`
    };
  }
}

module.exports = new DevOpsMonitorService();

