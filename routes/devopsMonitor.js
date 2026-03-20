const express = require('express');
const router = express.Router();
const devopsMonitorService = require('../services/devopsMonitorService');

/**
 * DevOps Monitor Routes for Azure DevOps Integration
 */

// Store access tokens in memory (in production, use Redis or database)
const tokenStore = new Map();

// Authentication endpoints
router.post('/auth', async (req, res) => {
  try {
    const { accessToken, account } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    // Store token (keyed by username)
    const key = account?.username || 'default';
    tokenStore.set(key, {
      accessToken,
      account,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    });

    // Extract organization from token or account
    const organization = await devopsMonitorService.extractOrganizationFromToken(accessToken);

    res.json({
      success: true,
      message: 'Authentication successful',
      organization
    });
  } catch (error) {
    console.error('Failed to store authentication:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/auth/logout', async (req, res) => {
  try {
    // Clear token store
    tokenStore.clear();
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Failed to logout:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware to get access token from request
const getAccessToken = (req) => {
  // Try to get from Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get from token store (for session-based auth)
  const tokens = Array.from(tokenStore.values());
  if (tokens.length > 0) {
    const token = tokens[0];
    // Check if token is expired
    if (token.expiresAt > Date.now()) {
      return token.accessToken;
    } else {
      // Remove expired token
      tokenStore.delete(tokens[0].account?.username || 'default');
    }
  }

  return null;
};

// Check DevOps connection status
router.get('/status', async (req, res) => {
  try {
    const accessToken = getAccessToken(req);
    
    if (!accessToken) {
      return res.json({
        connected: false,
        message: 'Not authenticated. Please connect to Azure DevOps.'
      });
    }

    // Use the access token to check connection
    const status = await devopsMonitorService.checkConnectionWithToken(accessToken);
    res.json(status);
  } catch (error) {
    console.error('Failed to check DevOps status:', error.message);
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const accessToken = getAccessToken(req);
    const { organization } = req.query;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Please connect to Azure DevOps first.'
      });
    }

    const projects = await devopsMonitorService.getProjects(accessToken, organization);
    res.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Failed to get projects:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get repositories for a project
router.get('/projects/:projectId/repositories', async (req, res) => {
  try {
    const { projectId } = req.params;
    const accessToken = getAccessToken(req);
    const { organization } = req.query;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Please connect to Azure DevOps first.'
      });
    }

    const repositories = await devopsMonitorService.getRepositories(projectId, accessToken, organization);
    res.json({
      success: true,
      repositories
    });
  } catch (error) {
    console.error('Failed to get repositories:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get branches for a repository
router.get('/projects/:projectId/repositories/:repositoryId/branches', async (req, res) => {
  try {
    const { projectId, repositoryId } = req.params;
    const branches = await devopsMonitorService.getBranches(projectId, repositoryId);
    res.json({
      success: true,
      branches
    });
  } catch (error) {
    console.error('Failed to get branches:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get commits for a repository and branch
router.get('/projects/:projectId/repositories/:repositoryId/commits', async (req, res) => {
  try {
    const { projectId, repositoryId } = req.params;
    const { branch } = req.query;
    
    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'Branch parameter is required'
      });
    }

    const commits = await devopsMonitorService.getCommits(projectId, repositoryId, branch);
    res.json({
      success: true,
      commits
    });
  } catch (error) {
    console.error('Failed to get commits:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get pull requests for a repository
router.get('/projects/:projectId/repositories/:repositoryId/pull-requests', async (req, res) => {
  try {
    const { projectId, repositoryId } = req.params;
    const pullRequests = await devopsMonitorService.getPullRequests(projectId, repositoryId);
    res.json({
      success: true,
      pullRequests
    });
  } catch (error) {
    console.error('Failed to get pull requests:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get work items for a project
router.get('/projects/:projectId/work-items', async (req, res) => {
  try {
    const { projectId } = req.params;
    const workItems = await devopsMonitorService.getWorkItems(projectId);
    res.json({
      success: true,
      workItems
    });
  } catch (error) {
    console.error('Failed to get work items:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get changed files (diff) between two refs
router.get('/projects/:projectId/repositories/:repositoryId/diff', async (req, res) => {
  try {
    const { projectId, repositoryId } = req.params;
    const { sourceRef, targetRef } = req.query;
    
    if (!sourceRef || !targetRef) {
      return res.status(400).json({
        success: false,
        error: 'sourceRef and targetRef parameters are required'
      });
    }

    const changedFiles = await devopsMonitorService.getChangedFiles(
      projectId,
      repositoryId,
      sourceRef,
      targetRef
    );
    
    res.json({
      success: true,
      changedFiles
    });
  } catch (error) {
    console.error('Failed to get changed files:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get file diff content
router.get('/projects/:projectId/repositories/:repositoryId/diff/file', async (req, res) => {
  try {
    const { projectId, repositoryId } = req.params;
    const { filePath, sourceRef, targetRef } = req.query;
    
    if (!filePath || !sourceRef || !targetRef) {
      return res.status(400).json({
        success: false,
        error: 'filePath, sourceRef, and targetRef parameters are required'
      });
    }

    const diff = await devopsMonitorService.getFileDiff(
      projectId,
      repositoryId,
      filePath,
      sourceRef,
      targetRef
    );
    
    res.json({
      success: true,
      diff
    });
  } catch (error) {
    console.error('Failed to get file diff:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate tests using LLM
router.post('/generate-tests', async (req, res) => {
  try {
    const {
      projectId,
      repositoryId,
      branch,
      files,
      feature,
      context
    } = req.body;

    if (!projectId || !repositoryId) {
      return res.status(400).json({
        success: false,
        error: 'projectId and repositoryId are required'
      });
    }

    const testResult = await devopsMonitorService.generateTests({
      projectId,
      repositoryId,
      branch,
      files,
      feature,
      context
    });

    res.json({
      success: true,
      ...testResult
    });
  } catch (error) {
    console.error('Failed to generate tests:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save generated test
router.post('/tests/:testId/save', async (req, res) => {
  try {
    const { testId } = req.params;
    const { code, projectId, repositoryId } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Test code is required'
      });
    }

    const result = await devopsMonitorService.saveTest(testId, code, projectId, repositoryId);
    res.json(result);
  } catch (error) {
    console.error('Failed to save test:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Run tests
router.post('/tests/:testId/run', async (req, res) => {
  try {
    const { testId } = req.params;
    const { options } = req.body;

    const runResult = await devopsMonitorService.runTests(testId, options);
    res.json({
      success: true,
      ...runResult
    });
  } catch (error) {
    console.error('Failed to run tests:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get test run results
router.get('/test-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const results = await devopsMonitorService.getTestRunResults(runId);
    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Failed to get test run results:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Allure report (placeholder)
router.get('/test-runs/:runId/allure-report', async (req, res) => {
  try {
    const { runId } = req.params;
    // In production, this would serve the generated Allure HTML report
    res.json({
      success: true,
      message: 'Allure report endpoint - to be implemented',
      runId
    });
  } catch (error) {
    console.error('Failed to get Allure report:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

