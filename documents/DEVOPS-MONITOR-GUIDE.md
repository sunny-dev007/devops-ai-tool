# DevOps Monitor for Azure - User Guide

## Overview

The DevOps Monitor is a comprehensive dashboard that integrates with Azure DevOps to provide:
- Real-time monitoring of branches, commits, and pull requests
- Work item tracking and management
- Automated test generation using AI (LLM-powered)
- Test execution and reporting
- Delta viewing for code changes

## Features

### 1. Project & Repository Selection
- Select Azure DevOps organization and project
- Browse and select repositories
- View repository metadata and statistics

### 2. Branch Monitoring
- View all branches in a repository
- See recent commits for each branch
- Track branch activity and changes

### 3. Pull Request Management
- View active pull requests
- See changed files in PRs
- View file diffs
- Generate automated tests for PR changes

### 4. Work Item Tracking
- View work items (User Stories, Bugs, Tasks, Epics)
- Track work item status and assignments
- Link work items to commits and PRs

### 5. Test Generation (AI-Powered)
- Generate Playwright BDD tests automatically using LLM
- Context-aware test generation based on:
  - Changed files
  - Recent commits
  - Pull request context
  - Related work items
- Preview and edit generated tests before saving

### 6. Test Execution
- Run generated tests on-demand
- Support for multiple browsers (Chromium, Firefox, WebKit)
- Real-time test execution status
- Test result reporting

### 7. Test Reports
- View test execution history
- Access Allure-style test reports
- Track test pass/fail rates
- View detailed test results with screenshots

## Setup Instructions

### 1. Azure DevOps Configuration

1. **Create a Personal Access Token (PAT)**:
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Create a new token with the following scopes:
     - Code (Read)
     - Work Items (Read)
     - Project and Team (Read)

2. **Get Your Organization Name**:
   - Your organization name is the part of your Azure DevOps URL
   - Example: If your URL is `https://dev.azure.com/myorg`, then `myorg` is your organization name

3. **Configure Environment Variables**:
   Add the following to your `.env` file:
   ```env
   AZURE_DEVOPS_ORGANIZATION=your-organization-name
   AZURE_DEVOPS_PAT=your_personal_access_token
   ```

### 2. Azure OpenAI Configuration (for Test Generation)

The DevOps Monitor uses Azure OpenAI for intelligent test generation. Ensure you have:
- `AZURE_OPENAI_AGENT_ENDPOINT` configured
- `AZURE_OPENAI_AGENT_KEY` configured
- `AZURE_OPENAI_AGENT_DEPLOYMENT` set to `gpt-4o` (or your preferred model)

## Usage Guide

### Accessing DevOps Monitor

1. Navigate to the **DevOps Monitor** menu item in the sidebar
2. If not connected, click "Connect Azure DevOps" to configure
3. Select a project and repository to start monitoring

### Monitoring Branches

1. Go to the **Branches** tab
2. Select a branch from the dropdown
3. View recent commits for that branch
4. See commit details including author, date, and message

### Working with Pull Requests

1. Go to the **Pull Requests** tab
2. Click on a PR to view details
3. See all changed files in the PR
4. Click on a file to view its diff
5. Click "Generate Tests" to create automated tests for the PR changes

### Generating Tests

1. Select a PR or branch with changes
2. Click "Generate Tests" button
3. The AI will analyze:
   - Changed files
   - Recent commits
   - PR context
   - Related work items
4. Generated test code will appear in the Test Editor
5. Review and edit the test code as needed
6. Click "Save" to save the test
7. Click "Run" to execute the test

### Running Tests

1. Go to the **Tests** tab
2. Select a saved test
3. Click "Run" button
4. Monitor test execution in real-time
5. View results in the **Reports** tab

### Viewing Reports

1. Go to the **Reports** tab
2. Select a test run to view details
3. See test results including:
   - Total tests
   - Passed/Failed counts
   - Execution duration
   - Individual test results
4. Access Allure reports (when available)

## API Endpoints

### Status & Configuration
- `GET /api/devops-monitor/status` - Check DevOps connection status

### Projects & Repositories
- `GET /api/devops-monitor/projects` - Get all projects
- `GET /api/devops-monitor/projects/:projectId/repositories` - Get repositories for a project

### Branches & Commits
- `GET /api/devops-monitor/projects/:projectId/repositories/:repositoryId/branches` - Get branches
- `GET /api/devops-monitor/projects/:projectId/repositories/:repositoryId/commits` - Get commits

### Pull Requests
- `GET /api/devops-monitor/projects/:projectId/repositories/:repositoryId/pull-requests` - Get PRs
- `GET /api/devops-monitor/projects/:projectId/repositories/:repositoryId/diff` - Get changed files
- `GET /api/devops-monitor/projects/:projectId/repositories/:repositoryId/diff/file` - Get file diff

### Work Items
- `GET /api/devops-monitor/projects/:projectId/work-items` - Get work items

### Test Generation & Execution
- `POST /api/devops-monitor/generate-tests` - Generate tests using AI
- `POST /api/devops-monitor/tests/:testId/save` - Save generated test
- `POST /api/devops-monitor/tests/:testId/run` - Run tests
- `GET /api/devops-monitor/test-runs/:runId` - Get test run results
- `GET /api/devops-monitor/test-runs/:runId/allure-report` - Get Allure report

## Architecture

### Frontend Components
- `DevOpsMonitor.js` - Main dashboard component
- Tab components: OverviewTab, BranchesTab, PullRequestsTab, WorkItemsTab, TestsTab, ReportsTab

### Backend Services
- `devopsMonitorService.js` - Core service for Azure DevOps API integration
  - Project and repository management
  - Branch and commit tracking
  - Pull request and diff handling
  - Work item queries
  - LLM-powered test generation
  - Test execution orchestration

### Backend Routes
- `routes/devopsMonitor.js` - API route handlers

## Security Considerations

1. **Personal Access Token (PAT)**:
   - Store PAT securely in environment variables
   - Use least privilege principle (only required scopes)
   - Rotate PATs regularly

2. **Azure OpenAI**:
   - API keys stored in environment variables
   - No sensitive data in prompts
   - Token usage monitoring recommended

3. **Test Code**:
   - Review generated tests before committing
   - Generated tests are aids, not replacements for manual review
   - Always validate test code before production use

## Troubleshooting

### Connection Issues
- Verify `AZURE_DEVOPS_ORGANIZATION` is correct
- Check PAT has required scopes
- Ensure PAT is not expired

### Test Generation Fails
- Verify Azure OpenAI configuration
- Check API key and endpoint are correct
- Ensure deployment name matches your Azure OpenAI deployment

### Test Execution Issues
- Ensure Playwright is installed (for local execution)
- Check test runner service is configured
- Verify test code syntax is valid

## Future Enhancements

- [ ] Webhook integration for real-time updates
- [ ] Full Playwright test runner implementation
- [ ] Allure report generation and serving
- [ ] Test history and versioning
- [ ] Integration with Azure Pipelines
- [ ] Role-based access control
- [ ] Audit logging
- [ ] Notifications (email/Slack)
- [ ] Test flakiness detection
- [ ] Analytics dashboard

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Azure DevOps API documentation
3. Check Azure OpenAI service status
4. Review application logs for detailed error messages

---

**Note**: This is a POC (Proof of Concept) implementation. For production use, additional features like proper test runner, Allure integration, database persistence, and enhanced security should be implemented.

