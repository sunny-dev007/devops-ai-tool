import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  FileCode,
  Play,
  CheckCircle2,
  XCircle,
  Loader,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  User,
  Code,
  FileText,
  Download,
  Copy,
  Eye,
  Edit,
  Save,
  AlertCircle,
  Sparkles,
  BarChart3,
  Clock,
  TrendingUp,
  Activity,
  TestTube,
  FileCheck,
  History,
  Bell,
  Settings as SettingsIcon,
  ChevronRight,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { devopsMsalInstance, devopsLoginRequest } from '../config/msalConfig';

const DevOpsMonitor = () => {
  // Project & Repository State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [selectedRepository, setSelectedRepository] = useState('');
  const [loading, setLoading] = useState({
    projects: false,
    repos: false,
    branches: false,
    commits: false,
    prs: false,
    workItems: false
  });

  // Repository State
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [commits, setCommits] = useState([]);
  const [pullRequests, setPullRequests] = useState([]);
  const [selectedPR, setSelectedPR] = useState(null);
  const [workItems, setWorkItems] = useState([]);

  // Delta Viewer State
  const [changedFiles, setChangedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDiff, setFileDiff] = useState('');

  // Test Generation State
  const [generatedTests, setGeneratedTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testCode, setTestCode] = useState('');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [showTestEditor, setShowTestEditor] = useState(false);

  // Test Execution State
  const [testRuns, setTestRuns] = useState([]);
  const [selectedTestRun, setSelectedTestRun] = useState(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // UI State
  const [activeTab, setActiveTab] = useState('overview'); // overview, branches, prs, workitems, tests, reports
  const [expandedSections, setExpandedSections] = useState({
    branches: true,
    prs: true,
    workItems: true
  });

  // Configuration
  const [devopsConfig, setDevopsConfig] = useState({
    organization: '',
    accessToken: null,
    connected: false,
    account: null
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Initialize authentication check
    const initializeAuth = async () => {
      setIsCheckingAuth(true);
      try {
        // First, handle redirect if we're returning from authentication
        await handleRedirect();
        
        // Then check for existing authentication (in case user navigated here after login)
        await checkExistingAuth();
        
        // Check backend connection status
        await checkDevOpsConnection();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    initializeAuth();
  }, []);

  const handleRedirect = async () => {
    try {
      // Check if we're returning from a redirect
      const response = await devopsMsalInstance.handleRedirectPromise();
      if (response) {
        const account = response.account;
        if (account) {
          // Get access token
          const tokenResponse = await devopsMsalInstance.acquireTokenSilent({
            ...devopsLoginRequest,
            account: account
          });

          // Store token in backend
          const orgResponse = await axios.post('/api/devops-monitor/auth', {
            accessToken: tokenResponse.accessToken,
            account: {
              username: account.username,
              name: account.name
            }
          });

          setDevopsConfig({
            organization: orgResponse.data.organization || extractOrganizationFromAccount(account),
            accessToken: tokenResponse.accessToken,
            connected: true,
            account: account
          });

          toast.success('Successfully connected to Azure DevOps!');
          
          // Load projects automatically
          await loadProjects();
        }
      }
    } catch (error) {
      console.error('Redirect handling error:', error);
      if (error.errorCode !== 'user_cancelled') {
        toast.error('Authentication failed. Please try again.');
      }
    }
  };

  const checkExistingAuth = async () => {
    try {
      // Wait for MSAL to be ready
      await devopsMsalInstance.initialize();
      
      const accounts = devopsMsalInstance.getAllAccounts();
      console.log('Found accounts:', accounts.length);
      
      if (accounts.length > 0) {
        const account = accounts[0];
        console.log('Using account:', account.username);
        
        // Set account first
        setDevopsConfig(prev => ({
          ...prev,
          account: account,
          connected: false // Will be set to true after token acquisition
        }));
        
        // Get access token silently
        try {
          await getAccessTokenSilently(account);
        } catch (tokenError) {
          console.error('Failed to get token silently:', tokenError);
          // If silent token acquisition fails, user might need to re-authenticate
          if (tokenError.errorCode === 'interaction_required' || tokenError.errorCode === 'consent_required') {
            console.log('Interaction required, user may need to reconnect');
            setDevopsConfig(prev => ({
              ...prev,
              connected: false
            }));
          }
        }
      } else {
        console.log('No accounts found in MSAL cache');
      }
    } catch (error) {
      console.error('Error checking existing auth:', error);
    }
  };

  const getAccessTokenSilently = async (account) => {
    try {
      console.log('Acquiring token silently for account:', account.username);
      
      const response = await devopsMsalInstance.acquireTokenSilent({
        ...devopsLoginRequest,
        account: account
      });
      
      console.log('Token acquired successfully');
      
      // Store token in backend session
      try {
        const orgResponse = await axios.post('/api/devops-monitor/auth', {
          accessToken: response.accessToken,
          account: {
            username: account.username,
            name: account.name
          }
        });

        setDevopsConfig(prev => ({
          ...prev,
          accessToken: response.accessToken,
          connected: true,
          account: account,
          organization: orgResponse.data.organization || prev.organization || ''
        }));

        console.log('Authentication state updated, connected:', true);
        
        // Load projects automatically if we have a token
        if (response.accessToken) {
          await loadProjects();
        }
        
        return response.accessToken;
      } catch (backendError) {
        console.error('Failed to store token in backend:', backendError);
        // Still set the token locally even if backend storage fails
        setDevopsConfig(prev => ({
          ...prev,
          accessToken: response.accessToken,
          connected: true,
          account: account
        }));
        return response.accessToken;
      }
    } catch (error) {
      console.error('Failed to get token silently:', error);
      if (error.errorCode === 'interaction_required' || error.errorCode === 'consent_required') {
        console.log('Interaction required - user needs to authenticate');
      }
      throw error;
    }
  };

  const checkDevOpsConnection = async () => {
    try {
      const response = await axios.get('/api/devops-monitor/status');
      if (response.data.connected) {
        setDevopsConfig(prev => ({
          ...prev,
          organization: response.data.organization || '',
          connected: true
        }));
        if (response.data.projects) {
          setProjects(response.data.projects);
        }
      }
    } catch (error) {
      console.log('DevOps not configured yet');
    }
  };

  const handleConnectDevOps = async () => {
    setIsAuthenticating(true);
    try {
      // Check if user is already logged in
      const accounts = devopsMsalInstance.getAllAccounts();
      let account = accounts.length > 0 ? accounts[0] : null;

      if (!account) {
        // Use redirect flow instead of popup (more reliable)
        // This will redirect the entire page to Microsoft login
        await devopsMsalInstance.loginRedirect({
          ...devopsLoginRequest,
          redirectStartPage: window.location.href
        });
        // The page will redirect, so we don't need to continue here
        return;
      }

      // If account exists, get token silently
      try {
        const tokenResponse = await devopsMsalInstance.acquireTokenSilent({
          ...devopsLoginRequest,
          account: account
        });

        // Store token in backend
        const orgResponse = await axios.post('/api/devops-monitor/auth', {
          accessToken: tokenResponse.accessToken,
          account: {
            username: account.username,
            name: account.name
          }
        });

        setDevopsConfig({
          organization: orgResponse.data.organization || extractOrganizationFromAccount(account),
          accessToken: tokenResponse.accessToken,
          connected: true,
          account: account
        });

        toast.success('Successfully connected to Azure DevOps!');
        
        // Load projects automatically
        await loadProjects();
      } catch (tokenError) {
        // If silent token acquisition fails, try interactive
        if (tokenError.errorCode === 'interaction_required' || tokenError.errorCode === 'consent_required') {
          await devopsMsalInstance.acquireTokenRedirect({
            ...devopsLoginRequest,
            account: account
          });
          return;
        }
        throw tokenError;
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      if (error.errorCode === 'user_cancelled') {
        toast('Authentication cancelled by user');
      } else if (error.errorCode === 'AADSTS900971') {
        toast.error('Redirect URI not configured. Please check Azure AD app registration.');
      } else {
        toast.error(`Failed to connect: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnectDevOps = async () => {
    try {
      await axios.post('/api/devops-monitor/auth/logout');
      await devopsMsalInstance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + '/devops-monitor'
      });
      // Note: logoutRedirect will redirect the page, so state updates won't be visible
      // But we'll set them anyway in case redirect doesn't happen
      setDevopsConfig({
        organization: '',
        accessToken: null,
        connected: false,
        account: null
      });
      setProjects([]);
      setRepositories([]);
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, clear local state
      setDevopsConfig({
        organization: '',
        accessToken: null,
        connected: false,
        account: null
      });
      setProjects([]);
      setRepositories([]);
      toast.success('Disconnected from Azure DevOps');
    }
  };

  const extractOrganizationFromAccount = (account) => {
    // Try to extract organization from account username or tenant
    // This is a fallback - organization should be detected from API calls
    if (account.username && account.username.includes('@')) {
      const domain = account.username.split('@')[1];
      // Azure DevOps organizations are typically in format: org@dev.azure.com
      // But we'll detect it from actual API calls
      return '';
    }
    return '';
  };

  const loadProjects = async (accessToken = null, organization = null) => {
    const token = accessToken || devopsConfig.accessToken;
    const org = organization || devopsConfig.organization;
    
    if (!token) {
      console.log('No access token available for loading projects');
      return;
    }

    setLoading(prev => ({ ...prev, projects: true }));
    try {
      const response = await axios.get('/api/devops-monitor/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          organization: org
        }
      });
      setProjects(response.data.projects || []);
      console.log('Projects loaded:', response.data.projects?.length || 0);
    } catch (error) {
      console.error('Failed to load projects:', error);
      if (error.response?.status === 401) {
        console.log('Authentication expired, clearing connection');
        setDevopsConfig(prev => ({ ...prev, connected: false, accessToken: null }));
        toast.error('Authentication expired. Please reconnect.');
      } else {
        console.error('Project loading error:', error.message);
      }
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const loadRepositories = async (projectId) => {
    if (!projectId) return;
    setLoading(prev => ({ ...prev, repos: true }));
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories`);
      setRepositories(response.data.repositories || []);
    } catch (error) {
      toast.error('Failed to load repositories');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, repos: false }));
    }
  };

  const loadBranches = async (projectId, repoId) => {
    if (!projectId || !repoId) return;
    setLoading(prev => ({ ...prev, branches: true }));
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories/${repoId}/branches`);
      setBranches(response.data.branches || []);
    } catch (error) {
      toast.error('Failed to load branches');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, branches: false }));
    }
  };

  const loadCommits = async (projectId, repoId, branchName) => {
    if (!projectId || !repoId || !branchName) return;
    setLoading(prev => ({ ...prev, commits: true }));
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories/${repoId}/commits`, {
        params: { branch: branchName }
      });
      setCommits(response.data.commits || []);
    } catch (error) {
      toast.error('Failed to load commits');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, commits: false }));
    }
  };

  const loadPullRequests = async (projectId, repoId) => {
    if (!projectId || !repoId) return;
    setLoading(prev => ({ ...prev, prs: true }));
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories/${repoId}/pull-requests`);
      setPullRequests(response.data.pullRequests || []);
    } catch (error) {
      toast.error('Failed to load pull requests');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, prs: false }));
    }
  };

  const loadWorkItems = async (projectId) => {
    if (!projectId) return;
    setLoading(prev => ({ ...prev, workItems: true }));
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/work-items`);
      setWorkItems(response.data.workItems || []);
    } catch (error) {
      toast.error('Failed to load work items');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, workItems: false }));
    }
  };

  const loadChangedFiles = async (projectId, repoId, sourceRef, targetRef) => {
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories/${repoId}/diff`, {
        params: { sourceRef, targetRef }
      });
      setChangedFiles(response.data.changedFiles || []);
    } catch (error) {
      toast.error('Failed to load changed files');
      console.error(error);
    }
  };

  const loadFileDiff = async (projectId, repoId, filePath, sourceRef, targetRef) => {
    try {
      const response = await axios.get(`/api/devops-monitor/projects/${projectId}/repositories/${repoId}/diff/file`, {
        params: { filePath, sourceRef, targetRef }
      });
      setFileDiff(response.data.diff || '');
      setSelectedFile(filePath);
    } catch (error) {
      toast.error('Failed to load file diff');
      console.error(error);
    }
  };

  const handleGenerateTests = async (files, feature) => {
    if (!selectedProject || !selectedRepository) {
      toast.error('Please select a project and repository first');
      return;
    }

    setIsGeneratingTest(true);
    try {
      const response = await axios.post('/api/devops-monitor/generate-tests', {
        projectId: selectedProject,
        repositoryId: selectedRepository,
        branch: selectedBranch,
        files: files || changedFiles.map(f => f.path),
        feature: feature || 'default',
        context: {
          commits: commits.slice(0, 5),
          pr: selectedPR,
          workItems: workItems.filter(wi => wi.state === 'Active')
        }
      });

      const newTest = {
        id: response.data.testId,
        name: response.data.testName,
        code: response.data.testCode,
        files: response.data.files,
        status: 'generated',
        createdAt: new Date().toISOString()
      };

      setGeneratedTests(prev => [...prev, newTest]);
      setTestCode(response.data.testCode);
      setShowTestEditor(true);
      setSelectedTest(newTest);
      toast.success('Test generated successfully!');
    } catch (error) {
      toast.error('Failed to generate tests');
      console.error(error);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const handleSaveTest = async () => {
    if (!selectedTest) return;

    try {
      await axios.post(`/api/devops-monitor/tests/${selectedTest.id}/save`, {
        code: testCode,
        projectId: selectedProject,
        repositoryId: selectedRepository
      });
      toast.success('Test saved successfully');
      setGeneratedTests(prev => prev.map(t => 
        t.id === selectedTest.id ? { ...t, code: testCode, status: 'saved' } : t
      ));
    } catch (error) {
      toast.error('Failed to save test');
      console.error(error);
    }
  };

  const handleRunTests = async (testId) => {
    setIsRunningTests(true);
    try {
      const response = await axios.post(`/api/devops-monitor/tests/${testId}/run`, {
        projectId: selectedProject,
        repositoryId: selectedRepository,
        options: {
          browsers: ['chromium'],
          headless: true
        }
      });

      const testRun = {
        id: response.data.runId,
        testId: testId,
        status: 'running',
        startedAt: new Date().toISOString()
      };

      setTestRuns(prev => [...prev, testRun]);
      setSelectedTestRun(testRun);

      // Poll for results
      pollTestResults(response.data.runId);
    } catch (error) {
      toast.error('Failed to run tests');
      console.error(error);
      setIsRunningTests(false);
    }
  };

  const pollTestResults = async (runId) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/devops-monitor/test-runs/${runId}`);
        const run = response.data;

        setTestRuns(prev => prev.map(r => r.id === runId ? run : r));

        if (run.status === 'completed' || run.status === 'failed') {
          clearInterval(interval);
          setIsRunningTests(false);
          setTestResults(run.results);
          if (run.status === 'completed') {
            toast.success('Tests completed successfully');
          } else {
            toast.error('Tests failed');
          }
        }
      } catch (error) {
        clearInterval(interval);
        setIsRunningTests(false);
        console.error(error);
      }
    }, 2000);
  };

  useEffect(() => {
    if (selectedProject) {
      loadRepositories(selectedProject);
      loadWorkItems(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && selectedRepository) {
      loadBranches(selectedProject, selectedRepository);
      loadPullRequests(selectedProject, selectedRepository);
    }
  }, [selectedProject, selectedRepository]);

  useEffect(() => {
    if (selectedProject && selectedRepository && selectedBranch) {
      loadCommits(selectedProject, selectedRepository, selectedBranch);
    }
  }, [selectedProject, selectedRepository, selectedBranch]);

  useEffect(() => {
    if (selectedPR) {
      loadChangedFiles(
        selectedProject,
        selectedRepository,
        selectedPR.sourceRefName,
        selectedPR.targetRefName
      );
    }
  }, [selectedPR, selectedProject, selectedRepository]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <GitBranch className="w-8 h-8 text-blue-600" />
                DevOps Monitor for Azure
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor branches, commits, PRs, work items, and generate automated tests
              </p>
            </div>
            <div className="flex items-center gap-3">
              {devopsConfig.connected && devopsConfig.account && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Connected as {devopsConfig.account.name || devopsConfig.account.username}</span>
                  {devopsConfig.organization && (
                    <span className="text-xs text-gray-500">({devopsConfig.organization})</span>
                  )}
                </div>
              )}
              {!devopsConfig.connected ? (
                <button
                  onClick={handleConnectDevOps}
                  disabled={isAuthenticating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <SettingsIcon className="w-4 h-4" />
                      Connect Azure DevOps
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadProjects()}
                    disabled={loading.projects}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading.projects ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Refresh Projects
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDisconnectDevOps}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Selector */}
        {isCheckingAuth ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Checking authentication...</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Project & Repository</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Azure DevOps Project
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value);
                      setSelectedRepository('');
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading.projects || !devopsConfig.connected}
                  >
                    <option value="">Select a project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadProjects()}
                    disabled={loading.projects || !devopsConfig.connected}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading.projects ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository
                </label>
                <select
                  value={selectedRepository}
                  onChange={(e) => setSelectedRepository(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading.repos || !selectedProject || !devopsConfig.connected}
                >
                  <option value="">Select a repository</option>
                  {repositories.map(repo => (
                    <option key={repo.id} value={repo.id}>
                      {repo.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'branches', label: 'Branches', icon: GitBranch },
                { id: 'prs', label: 'Pull Requests', icon: GitPullRequest },
                { id: 'workitems', label: 'Work Items', icon: FileText },
                { id: 'tests', label: 'Tests', icon: TestTube },
                { id: 'reports', label: 'Reports', icon: FileCheck }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab
                branches={branches}
                commits={commits}
                pullRequests={pullRequests}
                workItems={workItems}
                testRuns={testRuns}
                loading={loading}
              />
            )}

            {activeTab === 'branches' && (
              <BranchesTab
                branches={branches}
                selectedBranch={selectedBranch}
                onSelectBranch={setSelectedBranch}
                commits={commits}
                loading={loading}
              />
            )}

            {activeTab === 'prs' && (
              <PullRequestsTab
                pullRequests={pullRequests}
                selectedPR={selectedPR}
                onSelectPR={setSelectedPR}
                changedFiles={changedFiles}
                selectedFile={selectedFile}
                fileDiff={fileDiff}
                onLoadFileDiff={loadFileDiff}
                onGenerateTests={handleGenerateTests}
                isGeneratingTest={isGeneratingTest}
                loading={loading}
                projectId={selectedProject}
                repositoryId={selectedRepository}
              />
            )}

            {activeTab === 'workitems' && (
              <WorkItemsTab
                workItems={workItems}
                loading={loading}
              />
            )}

            {activeTab === 'tests' && (
              <TestsTab
                generatedTests={generatedTests}
                selectedTest={selectedTest}
                onSelectTest={setSelectedTest}
                testCode={testCode}
                onTestCodeChange={setTestCode}
                showTestEditor={showTestEditor}
                onShowTestEditor={setShowTestEditor}
                onSaveTest={handleSaveTest}
                onRunTests={handleRunTests}
                isGeneratingTest={isGeneratingTest}
                isRunningTests={isRunningTests}
                onGenerateTests={handleGenerateTests}
                changedFiles={changedFiles}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsTab
                testRuns={testRuns}
                selectedTestRun={selectedTestRun}
                onSelectTestRun={setSelectedTestRun}
                testResults={testResults}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ branches, commits, pullRequests, workItems, testRuns, loading }) => {
  const stats = [
    { label: 'Branches', value: branches.length, icon: GitBranch, color: 'blue' },
    { label: 'Active PRs', value: pullRequests.filter(pr => pr.status === 'active').length, icon: GitPullRequest, color: 'green' },
    { label: 'Work Items', value: workItems.length, icon: FileText, color: 'purple' },
    { label: 'Test Runs', value: testRuns.length, icon: TestTube, color: 'orange' }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => (
          <div key={stat.label} className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 text-${stat.color}-500`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Commits</h3>
          <div className="space-y-2">
            {commits.slice(0, 5).map(commit => (
              <div key={commit.commitId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <GitCommit className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{commit.comment || 'No message'}</p>
                  <p className="text-xs text-gray-500">{commit.author?.name} • {new Date(commit.author?.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Active Pull Requests</h3>
          <div className="space-y-2">
            {pullRequests.filter(pr => pr.status === 'active').slice(0, 5).map(pr => (
              <div key={pr.pullRequestId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <GitPullRequest className="w-4 h-4 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{pr.title}</p>
                  <p className="text-xs text-gray-500">#{pr.pullRequestId} • {pr.createdBy?.displayName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Branches Tab Component
const BranchesTab = ({ branches, selectedBranch, onSelectBranch, commits, loading }) => {
  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Branch
        </label>
        <select
          value={selectedBranch}
          onChange={(e) => onSelectBranch(e.target.value)}
          className="w-full md:w-1/3 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          disabled={loading.branches}
        >
          <option value="">Select a branch</option>
          {branches.map(branch => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {selectedBranch && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Recent Commits</h3>
          <div className="space-y-2">
            {commits.map(commit => (
              <div key={commit.commitId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{commit.comment || 'No message'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {commit.author?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(commit.author?.date).toLocaleString()}
                      </span>
                      <span className="font-mono text-xs">{commit.commitId.substring(0, 7)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Pull Requests Tab Component
const PullRequestsTab = ({
  pullRequests,
  selectedPR,
  onSelectPR,
  changedFiles,
  selectedFile,
  fileDiff,
  onLoadFileDiff,
  onGenerateTests,
  isGeneratingTest,
  loading,
  projectId,
  repositoryId
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Pull Requests</h3>
        <div className="space-y-2">
          {pullRequests.map(pr => (
            <div
              key={pr.pullRequestId}
              onClick={() => onSelectPR(pr)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedPR?.pullRequestId === pr.pullRequestId
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{pr.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    #{pr.pullRequestId} • {pr.createdBy?.displayName}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      pr.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {pr.status}
                    </span>
                    {pr.mergeStatus && (
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                        {pr.mergeStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPR && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Changed Files</h3>
            <button
              onClick={() => onGenerateTests(changedFiles.map(f => f.path), selectedPR.title)}
              disabled={isGeneratingTest || !projectId || !repositoryId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingTest ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Tests
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {changedFiles.map(file => (
              <div
                key={file.path}
                onClick={() => onLoadFileDiff(projectId, repositoryId, file.path, selectedPR.sourceRefName, selectedPR.targetRefName)}
                className={`p-3 rounded-lg border cursor-pointer ${
                  selectedFile === file.path
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{file.path}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    file.changeType === 'add' ? 'bg-green-100 text-green-700' :
                    file.changeType === 'edit' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {file.changeType}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {fileDiff && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">File Diff</h4>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                {fileDiff}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Work Items Tab Component
const WorkItemsTab = ({ workItems, loading }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Work Items</h3>
      <div className="space-y-2">
        {workItems.map(item => (
          <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">#{item.id}</span>
                  <span className="text-sm font-medium">{item.fields?.['System.Title']}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{item.fields?.['System.WorkItemType']}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>State: {item.fields?.['System.State']}</span>
                  <span>Assigned: {item.fields?.['System.AssignedTo']?.displayName || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Tests Tab Component
const TestsTab = ({
  generatedTests,
  selectedTest,
  onSelectTest,
  testCode,
  onTestCodeChange,
  showTestEditor,
  onShowTestEditor,
  onSaveTest,
  onRunTests,
  isGeneratingTest,
  isRunningTests,
  onGenerateTests,
  changedFiles
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Generated Tests</h3>
          <button
            onClick={() => onGenerateTests(changedFiles.map(f => f.path))}
            disabled={isGeneratingTest || changedFiles.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {isGeneratingTest ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate New Test
              </>
            )}
          </button>
        </div>

        <div className="space-y-2">
          {generatedTests.map(test => (
            <div
              key={test.id}
              onClick={() => {
                onSelectTest(test);
                onTestCodeChange(test.code);
                onShowTestEditor(true);
              }}
              className={`p-4 rounded-lg border cursor-pointer ${
                selectedTest?.id === test.id
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{test.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {test.files?.length || 0} files • {new Date(test.createdAt).toLocaleDateString()}
                  </p>
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                    test.status === 'saved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {test.status}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunTests(test.id);
                  }}
                  disabled={isRunningTests || test.status !== 'saved'}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showTestEditor && selectedTest && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Test Editor</h3>
            <div className="flex gap-2">
              <button
                onClick={onSaveTest}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
          <textarea
            value={testCode}
            onChange={(e) => onTestCodeChange(e.target.value)}
            className="w-full h-96 font-mono text-sm border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500"
            placeholder="Test code will appear here..."
          />
        </div>
      )}
    </div>
  );
};

// Reports Tab Component
const ReportsTab = ({ testRuns, selectedTestRun, onSelectTestRun, testResults }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Test Reports</h3>
      <div className="space-y-2">
        {testRuns.map(run => (
          <div
            key={run.id}
            onClick={() => onSelectTestRun(run)}
            className={`p-4 rounded-lg border cursor-pointer ${
              selectedTestRun?.id === run.id
                ? 'bg-blue-50 border-blue-500'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Test Run #{run.id}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(run.startedAt).toLocaleString()}
                </p>
              </div>
              <span className={`px-3 py-1 rounded text-sm ${
                run.status === 'completed' ? 'bg-green-100 text-green-700' :
                run.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {run.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {testResults && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-4">Test Results</h4>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DevOpsMonitor;

