import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Search,
  Copy,
  Download,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Loader,
  MessageSquare,
  Code,
  FileCode,
  DollarSign,
  GitBranch,
  Server,
  Database,
  Network,
  HardDrive,
  Cpu,
  Send,
  RefreshCw,
  ChevronRight,
  Info,
  Sparkles,
  TrendingDown,
  AlertTriangle,
  Terminal,
  Zap,
  Play,
  Key,
  Plus,
  Shield,
  Loader2,
  X,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import InteractivePromptModal from '../components/InteractivePromptModal';

const AIAgent = () => {
  // State
  const [resourceGroups, setResourceGroups] = useState([]);
  const [selectedResourceGroup, setSelectedResourceGroup] = useState('');
  const [targetResourceGroup, setTargetResourceGroup] = useState('');
  const [discoveredResources, setDiscoveredResources] = useState(null);
  const [analysisStrategy, setAnalysisStrategy] = useState(null);
  const [generatedScripts, setGeneratedScripts] = useState({ terraform: null, cli: null });
  const [costEstimate, setCostEstimate] = useState(null);
  const [loading, setLoading] = useState({ discover: false, analyze: false, terraform: false, cli: false, cost: false });
  const [currentStep, setCurrentStep] = useState('select'); // select, discover, analyze, generate
  const [useStaticScript, setUseStaticScript] = useState(true); // Toggle for static script (default ON)
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your Azure AI Agent. I can help you clone entire resource groups with all their resources and configurations. What would you like to do today?'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const shownLongRunningWarning = useRef(false);
  const executionStartTime = useRef(null);
  
  // Operations tab state
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'operations', or 'cost-analyzer'
  const [operationQuery, setOperationQuery] = useState('');
  const [operationScript, setOperationScript] = useState('');
  const [isGeneratingOperation, setIsGeneratingOperation] = useState(false);
  const [isExecutingOperation, setIsExecutingOperation] = useState(false);
  const [operationOutput, setOperationOutput] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Cost Analyzer tab state
  const [costAnalysisData, setCostAnalysisData] = useState(null);
  const [costRecommendations, setCostRecommendations] = useState(null);
  const [isAnalyzingCosts, setIsAnalyzingCosts] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [costAnalysisPeriod, setCostAnalysisPeriod] = useState(30); // days
  const [showZeroCostResources, setShowZeroCostResources] = useState(false); // Toggle for zero-cost resources
  
  // Error fix execution state
  const [extractedFixCommands, setExtractedFixCommands] = useState(null);
  const [isExecutingFix, setIsExecutingFix] = useState(false);
  const [fixExecutionOutput, setFixExecutionOutput] = useState([]);
  
  // Validation and confirmation state (for Operations tab)
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  
  // Cloning validation and confirmation state (for Clone section)
  const [isValidatingClone, setIsValidatingClone] = useState(false);
  const [cloneValidationResult, setCloneValidationResult] = useState(null);
  const [showCloneConfirmationModal, setShowCloneConfirmationModal] = useState(false);
  
  // Execution state
  const [executionSession, setExecutionSession] = useState(null);
  const [executionData, setExecutionData] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionType, setExecutionType] = useState(null); // 'terraform' or 'cli'
  const [executionPolling, setExecutionPolling] = useState(null);
  
  // Interactive prompt state
  const [showInteractivePrompt, setShowInteractivePrompt] = useState(false);
  const [interactivePrompt, setInteractivePrompt] = useState(null);
  
  // Load resource groups on mount
  useEffect(() => {
    loadResourceGroups();
  }, []);
  
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  /**
   * Load available resource groups
   */
  const loadResourceGroups = async () => {
    try {
      const response = await axios.get('/api/ai-agent/resource-groups');
      if (response.data.success) {
        setResourceGroups(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load resource groups:', error);
      toast.error('Failed to load resource groups');
    }
  };
  
  /**
   * Discover resources in selected resource group
   */
  const handleDiscover = async () => {
    if (!selectedResourceGroup) {
      toast.error('Please select a resource group');
      return;
    }
    
    setLoading({ ...loading, discover: true });
    setCurrentStep('discover');
    
    try {
      const response = await axios.post('/api/ai-agent/discover', {
        resourceGroupName: selectedResourceGroup
      });
      
      if (response.data.success) {
        setDiscoveredResources(response.data.data);
        toast.success(`Discovered ${response.data.data.totalResources} resources!`);
        
        // Add to chat
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ I found ${response.data.data.totalResources} resources in "${selectedResourceGroup}". Ready to analyze and generate cloning strategy!`
        }]);
      }
    } catch (error) {
      console.error('Discovery failed:', error);
      toast.error('Failed to discover resources');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Failed to discover resources: ${error.response?.data?.message || error.message}`
      }]);
    } finally {
      setLoading({ ...loading, discover: false });
    }
  };
  
  /**
   * Analyze and validate resources for cloning (with pre-validation)
   */
  const handleAnalyze = async () => {
    if (!discoveredResources || !targetResourceGroup) {
      toast.error('Please provide target resource group name');
      return;
    }
    
    setIsValidatingClone(true);
    setLoading({ ...loading, analyze: true });
    setCurrentStep('analyze');
    
    try {
      // Step 1: Pre-validate cloning configuration
      const validationResponse = await axios.post('/api/ai-agent/validate-clone', {
        sourceResourceGroup: selectedResourceGroup,
        targetResourceGroup: targetResourceGroup,
        discoveredResources: discoveredResources,
        resources: discoveredResources.resources || []
      });
      
      if (validationResponse.data) {
        setCloneValidationResult(validationResponse.data);
        setShowCloneConfirmationModal(true);
        
        toast.success('Pre-validation complete! Please review the configuration.');
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔍 Pre-validation complete! I've analyzed all resources and validated the cloning configuration. Please review and confirm to proceed.`
        }]);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('Failed to validate cloning configuration');
      
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Validation failed: ${error.response?.data?.error || error.message}`
      }]);
    } finally {
      setIsValidatingClone(false);
      setLoading({ ...loading, analyze: false });
    }
  };
  
  /**
   * Confirm and proceed with cloning after validation
   */
  const handleConfirmClone = async () => {
    setShowCloneConfirmationModal(false);
    setLoading({ ...loading, analyze: true });
    
    try {
      // Step 2: Perform actual analysis with validated configuration
      const response = await axios.post('/api/ai-agent/analyze', {
        resourceGroupData: discoveredResources,
        targetResourceGroupName: targetResourceGroup,
        validatedConfig: cloneValidationResult // Pass entire validation result
      });
      
      if (response.data.success) {
        setAnalysisStrategy(response.data.data);
        toast.success('Analysis complete with validated configuration!');
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Analysis complete! All resources have been validated and optimized. Ready to generate scripts with corrected configurations!`
        }]);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Failed to analyze resources');
    } finally {
      setLoading({ ...loading, analyze: false });
    }
  };
  
  /**
   * Generate Terraform configuration with validated config
   */
  const handleGenerateTerraform = async () => {
    if (!discoveredResources) return;
    
    setLoading({ ...loading, terraform: true });
    setCurrentStep('generate');
    
    try {
      const response = await axios.post('/api/ai-agent/generate-terraform', {
        resourceGroupData: discoveredResources,
        targetResourceGroupName: targetResourceGroup,
        validatedConfig: cloneValidationResult // Pass entire validation result
      });
      
      if (response.data.success) {
        setGeneratedScripts({ ...generatedScripts, terraform: response.data.data });
        toast.success('Terraform configuration generated with validated parameters!');
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Terraform configuration generated successfully with all validated and corrected parameters!`
        }]);
      }
    } catch (error) {
      console.error('Terraform generation failed:', error);
      toast.error('Failed to generate Terraform');
    } finally {
      setLoading({ ...loading, terraform: false });
    }
  };
  
  /**
   * Generate Azure CLI script with validated config
   */
  const handleGenerateCLI = async () => {
    if (!discoveredResources) return;
    
    setLoading({ ...loading, cli: true });
    setCurrentStep('generate');
    
    try {
      // Log what we're sending for debugging
      console.log('🔍 Generating Azure CLI script...');
      console.log('Discovered Resources:', discoveredResources);
      console.log('Target Resource Group:', targetResourceGroup);
      console.log('Clone Validation Result:', cloneValidationResult);
      
      const response = await axios.post('/api/ai-agent/generate-cli', {
        resourceGroupData: discoveredResources,
        targetResourceGroupName: targetResourceGroup,
        validatedConfig: cloneValidationResult || null, // Pass validation result or null
        useStaticScript: useStaticScript // Pass toggle state
      });
      
      console.log('✅ Script generation response:', response.data);
      
      if (response.data.success) {
        setGeneratedScripts({ ...generatedScripts, cli: response.data.data });
        
        if (cloneValidationResult) {
          toast.success('Azure CLI script generated with validated parameters!');
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ Azure CLI script generated successfully with all validated and corrected parameters!`
          }]);
        } else {
          toast.success('Azure CLI script generated!');
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ Azure CLI script generated successfully! Note: For best results, use "Analyze with AI" first for pre-validation.`
          }]);
        }
      }
    } catch (error) {
      console.error('❌ CLI generation failed:', error);
      console.error('Error details:', error.response?.data);
      toast.error(`Failed to generate CLI script: ${error.response?.data?.message || error.message}`);
      
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Script generation failed: ${error.response?.data?.message || error.message}\n\nTip: Try clicking "Analyze with AI" first to validate resources before generating scripts.`
      }]);
    } finally {
      setLoading({ ...loading, cli: false });
    }
  };
  
  /**
   * Get actual current costs (in INR)
   */
  const handleEstimateCost = async () => {
    if (!discoveredResources) return;
    
    setLoading({ ...loading, cost: true });
    
    try {
      console.log('💰 Fetching actual costs for resource group:', selectedResourceGroup);
      
      const response = await axios.post('/api/ai-agent/get-actual-costs', {
        resourceGroupName: selectedResourceGroup,
        days: 30
      });
      
      if (response.data.success) {
        const costData = response.data.data;
        console.log('✅ Received actual cost data:', costData);
        
        // Transform the data to match the UI expectations
        const transformedData = {
          totalEstimatedCost: costData.totalCost.toFixed(2),
          currency: 'INR',
          period: costData.period,
          isActualCost: true, // Flag to indicate this is actual cost, not estimate
          breakdown: costData.breakdown.map(item => ({
            resourceName: item.resourceName,
            resourceType: item.resourceType,
            sku: item.sku || 'N/A',
            estimatedCost: item.totalCost.toFixed(2),
            costFactors: Object.entries(item.costByCategory).map(([category, cost]) => 
              `${category}: ₹${cost.toFixed(2)}`
            ),
            region: discoveredResources.resourceGroup.location
          })),
          savingsRecommendations: [],
          assumptions: [
            `Actual costs from ${costData.fromDate} to ${costData.toDate}`,
            `Original currency: ${costData.originalCurrency} (converted to INR at rate: ${costData.exchangeRate})`,
            'Costs are based on actual Azure usage and billing data'
          ],
          warnings: costData.breakdown.length === 0 ? [
            'No cost data available for this resource group in the selected period',
            'This may indicate the resources are new or not yet billed'
          ] : []
        };
        
        setCostEstimate(transformedData);
        toast.success(`✅ Actual costs loaded for last 30 days!`);
      }
    } catch (error) {
      console.error('Failed to get actual costs:', error);
      toast.error(error.response?.data?.message || 'Failed to get actual costs. Check permissions.');
    } finally {
      setLoading({ ...loading, cost: false });
    }
  };
  
  /**
   * Execute Azure CLI script
   */
  const handleExecuteCLI = async () => {
    if (!generatedScripts.cli) return;
    
    // Show confirmation
    const confirmed = window.confirm(
      `⚠️ EXECUTE AZURE CLI SCRIPT?\n\n` +
      `This will create REAL Azure resources in your account.\n\n` +
      `Target Resource Group: ${targetResourceGroup}\n` +
      `Resources to create: ${discoveredResources?.totalResources || 0}\n\n` +
      `Are you sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    try {
      toast.loading('Starting execution...', { id: 'execute-cli' });
      
      const response = await axios.post('/api/ai-agent/execute-cli', {
        script: generatedScripts.cli.script,
        options: {}
      });
      
      if (response.data.success) {
        const sessionId = response.data.data.sessionId;
        setExecutionSession(sessionId);
        setExecutionType('cli');
        setShowExecutionModal(true);
        
        // Start polling for status
        startExecutionPolling(sessionId);
        
        toast.success('Execution started!', { id: 'execute-cli' });
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Execution started! Session ID: ${sessionId}\n\nI'm now executing the Azure CLI commands to clone your resources. You can watch the progress in real-time!`
        }]);
      }
    } catch (error) {
      console.error('Execution failed:', error);
      toast.error('Failed to start execution', { id: 'execute-cli' });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Failed to start execution: ${error.response?.data?.message || error.message}`
      }]);
    }
  };
  
  /**
   * Execute Terraform configuration
   */
  const handleExecuteTerraform = async () => {
    if (!generatedScripts.terraform) return;
    
    // Show confirmation
    const confirmed = window.confirm(
      `⚠️ EXECUTE TERRAFORM?\n\n` +
      `This will create REAL Azure resources in your account.\n\n` +
      `Target Resource Group: ${targetResourceGroup}\n` +
      `Resources to create: ${discoveredResources?.totalResources || 0}\n\n` +
      `Are you sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    try {
      toast.loading('Starting Terraform execution...', { id: 'execute-tf' });
      
      const response = await axios.post('/api/ai-agent/execute-terraform', {
        terraform: generatedScripts.terraform.terraform,
        options: { dryRun: false }
      });
      
      if (response.data.success) {
        const sessionId = response.data.data.sessionId;
        setExecutionSession(sessionId);
        setExecutionType('terraform');
        setShowExecutionModal(true);
        
        // Start polling for status
        startExecutionPolling(sessionId);
        
        toast.success('Terraform execution started!', { id: 'execute-tf' });
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Terraform execution started! Session ID: ${sessionId}\n\nI'm now running terraform init, plan, and apply. This may take several minutes.`
        }]);
      }
    } catch (error) {
      console.error('Terraform execution failed:', error);
      toast.error('Failed to start Terraform execution', { id: 'execute-tf' });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Failed to start Terraform execution: ${error.response?.data?.message || error.message}`
      }]);
    }
  };
  
  /**
   * Start polling for execution status
   */
  const startExecutionPolling = (sessionId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/ai-agent/execution-status/${sessionId}`);
        
        if (response.data.success) {
          setExecutionData(response.data.data);
          
          // Check for interactive prompt (waiting for user input)
          if (response.data.data.status === 'waiting_for_input' && response.data.data.interactivePrompt) {
            console.log('🔔 Interactive prompt detected:', response.data.data.interactivePrompt);
            setInteractivePrompt(response.data.data.interactivePrompt);
            setShowInteractivePrompt(true);
            
            // Notify user
            toast('⏸️ Execution paused - User input required', {
              icon: '⚠️',
              duration: 5000
            });
            
            // Don't stop polling - wait for user response
            return;
          }
          
          // Stop polling if execution is complete
          if (response.data.data.status === 'completed' || response.data.data.status === 'failed' || response.data.data.status === 'cancelled' || response.data.data.status === 'completed_with_warnings') {
            clearInterval(pollInterval);
            setExecutionPolling(null);
            
            if (response.data.data.status === 'completed' || response.data.data.status === 'completed_with_warnings') {
              toast.success('Execution completed successfully!');
              const warningText = response.data.data.warnings?.length 
                ? `\n\n⚠️ Warnings:\n${response.data.data.warnings.map(w => `• ${w.message}`).join('\n')}`
                : '';
              setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `🎉 Execution completed ${response.data.data.status === 'completed_with_warnings' ? 'with warnings' : 'successfully'}!\n\nYour resources have been cloned to "${targetResourceGroup}".\n\nDuration: ${(response.data.data.duration / 1000).toFixed(1)}s${warningText}\n\nYou can now verify the resources in Azure Portal.`
              }]);
            } else if (response.data.data.status === 'failed') {
              toast.error('Execution failed - Analyzing error...');
              
              // Trigger AI error analysis for cloning failures
              analyzeCloningingError(response.data.data);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch execution status:', error);
        if (error.response?.status === 404) {
          clearInterval(pollInterval);
          setExecutionPolling(null);
        }
      }
    }, 2000); // Poll every 2 seconds
    
    setExecutionPolling(pollInterval);
  };
  
  /**
   * Cancel execution
   */
  const handleCancelExecution = async () => {
    if (!executionSession) return;
    
    if (!window.confirm('Are you sure you want to cancel the execution?')) {
      return;
    }
    
    try {
      await axios.post(`/api/ai-agent/cancel-execution/${executionSession}`);
      
      if (executionPolling) {
        clearInterval(executionPolling);
        setExecutionPolling(null);
      }
      
      toast.success('Execution cancelled');
      setShowExecutionModal(false);
      
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `🛑 Execution cancelled by user.`
      }]);
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      toast.error('Failed to cancel execution');
    }
  };
  
  /**
   * Handle interactive prompt response
   */
  const handlePromptResponse = async (action, userInput) => {
    if (!interactivePrompt) return;
    
    console.log('📤 Sending prompt response:', { action, userInput });
    
    try {
      const response = await axios.post('/api/ai-agent/prompt-response', {
        promptId: interactivePrompt.promptId,
        action,
        userInput
      });
      
      if (response.data.success) {
        // Close modal
        setShowInteractivePrompt(false);
        setInteractivePrompt(null);
        
        // Update execution data
        setExecutionData(response.data.data);
        
        // Show success message
        const actionLabels = {
          select_region: `Region changed to ${userInput.region}`,
          auto_region: 'Auto-selected available region',
          change_sku: 'SKU changed to lower tier',
          generate_new_name: 'Generated new unique name',
          skip_resource: 'Resource skipped',
          retry: 'Retrying operation',
          abort: 'Execution aborted'
        };
        
        toast.success(actionLabels[action] || 'Action applied');
        
        // Add chat message
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ ${actionLabels[action] || 'Action applied'}\n\nExecution ${action === 'abort' ? 'stopped' : action === 'skip_resource' ? 'continuing with other resources' : 'resumed'}...`
        }]);
        
        // If execution resumed, keep polling
        if (response.data.data.status === 'running') {
          console.log('▶️ Execution resumed, continuing to poll...');
        }
      }
    } catch (error) {
      console.error('Failed to handle prompt response:', error);
      toast.error('Failed to apply action: ' + (error.response?.data?.message || error.message));
    }
  };
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (executionPolling) {
        clearInterval(executionPolling);
      }
    };
  }, [executionPolling]);
  
  /**
   * Handle configuration validation (before script generation)
   */
  const handleValidateConfiguration = async () => {
    if (!operationQuery.trim()) {
      toast.error('Please enter an operation request');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await axios.post('http://localhost:5000/api/ai-agent-validation/analyze-request', {
        query: operationQuery,
        context: {
          selectedResourceGroup,
          discoveredResources,
          selectedRegion: 'centralindia' // Can be made dynamic
        }
      });

      console.log('✅ Validation result:', response.data);
      
      setValidationResult(response.data);
      setShowConfirmationModal(true);
      
      toast.success('Configuration validated! Please review.');
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      toast.error('Failed to validate configuration: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Handle user confirmation and proceed with script generation
   */
  const handleConfirmAndGenerate = async () => {
    setShowConfirmationModal(false);
    
    // Now generate the script with validated configuration
    await handleGenerateOperationScript(validationResult);
  };

  /**
   * Handle operations script generation
   */
  const handleGenerateOperationScript = async (validatedConfig = null) => {
    if (!operationQuery.trim()) {
      toast.error('Please enter an operation request');
      return;
    }

    setIsGeneratingOperation(true);
    setOperationScript('');
    setOperationOutput([]);
    
    try {
      const response = await axios.post('/api/ai-agent/generate-operation-script', {
        query: operationQuery,
        validatedConfig: validatedConfig ? validatedConfig.validatedConfig : null,
        context: {
          selectedResourceGroup,
          discoveredResources,
          analysisStrategy
        }
      });

      if (response.data.success && response.data.data.script) {
        setOperationScript(response.data.data.script);
        toast.success('Azure CLI script generated successfully!');
      } else {
        throw new Error('No script generated');
      }
    } catch (error) {
      console.error('Failed to generate operation script:', error);
      toast.error(error.response?.data?.message || 'Failed to generate script');
    } finally {
      setIsGeneratingOperation(false);
    }
  };

  /**
   * Handle operations script execution
   */
  const handleExecuteOperationScript = async () => {
    if (!operationScript) {
      toast.error('No script to execute');
      return;
    }

    setIsExecutingOperation(true);
    setOperationOutput([{ type: 'info', message: '⏳ Starting execution...' }]);
    setAiSummary(''); // Clear any previous summary
    shownLongRunningWarning.current = false; // Reset long running warning flag
    executionStartTime.current = Date.now(); // Track when execution started
    
    try {
      const response = await axios.post('/api/ai-agent/execute-operation-script', {
        script: operationScript,
        description: `Azure Operation: ${operationQuery.substring(0, 50)}...`
      });
      
      const sessionId = response.data.data.sessionId;
      toast.success('Script execution started. Fetching output...');
      
      // Poll for execution status and output
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/api/ai-agent/execution/${sessionId}`);
          const execution = statusResponse.data.data;
          
          // Build output array from execution data
          const outputLines = [];
          
          // Add authentication status
          outputLines.push({ 
            type: 'info', 
            message: '🔐 Authenticating with Azure CLI...' 
          });
          
          // Add step outputs
          if (execution.steps && execution.steps.length > 0) {
            execution.steps.forEach((step) => {
              if (step.output) {
                const lines = step.output.split('\n').filter(line => line.trim());
                lines.forEach(line => {
                  outputLines.push({
                    type: step.status === 'failed' ? 'error' : 'success',
                    message: line
                  });
                });
              }
              
              if (step.error && step.status === 'failed') {
                const errorLines = step.error.split('\n').filter(line => line.trim());
                errorLines.forEach(line => {
                  outputLines.push({
                    type: 'error',
                    message: `❌ ${line}`
                  });
                });
              }
            });
          }
          
          // Add execution errors
          if (execution.errors && execution.errors.length > 0) {
            execution.errors.forEach(error => {
              outputLines.push({
                type: 'error',
                message: `❌ Error: ${error.error}`
              });
            });
          }
          
          // Check if operation is running for a long time (> 2 minutes)
          const executionTime = executionStartTime.current ? Date.now() - executionStartTime.current : 0;
          if (execution.status === 'running' && executionTime > 120000 && !shownLongRunningWarning.current) {
            outputLines.push({
              type: 'info',
              message: '\n⏳ This operation is taking longer than expected. This is normal for:\n   • Web App creation (5-10 minutes)\n   • SQL Database operations (10-60 minutes)\n   • VM creation (5-10 minutes)\n   Please wait... The operation is still running in Azure.'
            });
            shownLongRunningWarning.current = true;
          }
          
          // Add final status
          if (execution.status === 'completed') {
            outputLines.push({
              type: 'success',
              message: '\n✅ Execution completed successfully!'
            });
            clearInterval(pollInterval);
            setIsExecutingOperation(false);
            executionStartTime.current = null; // Clear start time
            toast.success('Execution completed successfully!');
            
            // Generate AI summary of the results
            generateAISummary(execution, operationQuery);
            
            // Clear the script after successful execution
            setTimeout(() => {
              setOperationScript('');
              setOperationQuery('');
            }, 5000); // Increased to 5 seconds to allow reading summary
          } else if (execution.status === 'failed') {
            outputLines.push({
              type: 'error',
              message: '\n❌ Execution failed. Check errors above.'
            });
            clearInterval(pollInterval);
            setIsExecutingOperation(false);
            executionStartTime.current = null; // Clear start time
            toast.error('Execution failed - AI is analyzing the error...');
            
            // Generate AI error analysis for failed executions
            generateErrorAnalysis(execution, operationQuery);
          }
          
          setOperationOutput(outputLines);
          
        } catch (pollError) {
          console.error('Failed to poll execution status:', pollError);
          clearInterval(pollInterval);
          setIsExecutingOperation(false);
          executionStartTime.current = null; // Clear start time
          toast.error('Failed to fetch execution status');
        }
      }, 2000); // Poll every 2 seconds
      
      // Set timeout to stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isExecutingOperation) {
          setIsExecutingOperation(false);
          setOperationOutput(prev => [...prev, {
            type: 'error',
            message: '⏱️ Execution timeout. Please check Azure Portal for status.'
          }]);
        }
      }, 300000); // 5 minutes
      
    } catch (error) {
      console.error('Failed to execute script:', error);
      executionStartTime.current = null; // Clear start time
      toast.error(error.response?.data?.message || 'Failed to execute script');
      setOperationOutput([{ 
        type: 'error', 
        message: `❌ ${error.response?.data?.message || 'Execution failed.'}` 
      }]);
      setIsExecutingOperation(false);
    }
  };

  /**
   * Generate AI error analysis for failed executions
   */
  const generateErrorAnalysis = async (execution, query) => {
    setIsGeneratingSummary(true);
    setAiSummary('');
    setExtractedFixCommands(null); // Reset extracted commands
    
    try {
      // Extract error output from execution
      let errorOutput = '';
      let fullOutput = '';
      
      if (execution.steps && execution.steps.length > 0) {
        execution.steps.forEach(step => {
          if (step.output) {
            fullOutput += step.output + '\n';
          }
          if (step.error) {
            errorOutput += step.error + '\n';
          }
        });
      }
      
      if (execution.errors && execution.errors.length > 0) {
        execution.errors.forEach(err => {
          errorOutput += err.error + '\n';
        });
      }
      
      // Send to AI for error analysis
      const response = await axios.post('/api/ai-agent/analyze-execution-error', {
        query: query,
        output: fullOutput,
        errorOutput: errorOutput,
        status: execution.status
      });
      
      if (response.data.success && response.data.data.analysis) {
        setAiSummary(response.data.data.analysis);
        
        // Extract executable commands from the analysis
        extractCommandsFromAnalysis(response.data.data.analysis);
        
        toast.success('AI analyzed the error and provided solutions!', { duration: 5000 });
      }
    } catch (error) {
      console.error('Failed to generate error analysis:', error);
      // Don't show error toast, just log it
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /**
   * Execute inline command from chat (directly from error analysis)
   */
  const handleExecuteInlineCommand = async (command) => {
    try {
      const confirmed = window.confirm(
        `Execute this Azure CLI command?\n\n${command.substring(0, 200)}${command.length > 200 ? '...' : ''}\n\nThis will run on your Azure subscription.`
      );
      
      if (!confirmed) return;
      
      toast.loading('Executing command...', { id: 'inline-cmd' });
      
      const response = await axios.post('/api/ai-agent/execute-operation-script', {
        script: command,
        description: 'Inline command from error resolution'
      });
      
      if (response.data.success) {
        const sessionId = response.data.data.sessionId;
        
        // Start polling for output
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await axios.get(`/api/ai-agent/execution/${sessionId}`);
            
            if (statusResponse.data.success) {
              const execution = statusResponse.data.data;
              
              if (execution.status === 'completed' || execution.status === 'failed') {
                clearInterval(pollInterval);
                
                if (execution.status === 'completed') {
                  toast.success('Command executed successfully!', { id: 'inline-cmd' });
                  
                  // Add success message to chat
                  const output = execution.steps?.map(s => s.output).join('\n') || 'Command completed';
                  setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `✅ **Command executed successfully!**\n\n\`\`\`\n${output}\n\`\`\`\n\n🔄 You can now **retry the cloning operation** by clicking "Generate Azure CLI" and "Execute Now" again.`
                  }]);
                } else {
                  toast.error('Command failed!', { id: 'inline-cmd' });
                  
                  const errorOutput = execution.errors?.map(e => e.error).join('\n') || 'Command failed';
                  setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `❌ **Command failed:**\n\n\`\`\`\n${errorOutput}\n\`\`\`\n\nPlease check the error and try again.`
                  }]);
                }
              }
            }
          } catch (error) {
            console.error('Failed to poll execution status:', error);
            clearInterval(pollInterval);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to execute inline command:', error);
      toast.error('Failed to execute command', { id: 'inline-cmd' });
    }
  };
  
  /**
   * Extract Azure CLI commands from AI error analysis
   */
  const extractCommandsFromAnalysis = (analysis) => {
    try {
      // Extract code blocks that look like Azure CLI commands
      const codeBlockRegex = /```(?:bash|shell|sh)?\n([\s\S]*?)```/gm;
      const matches = [];
      let match;
      
      while ((match = codeBlockRegex.exec(analysis)) !== null) {
        const commands = match[1].trim();
        // Filter out commands that are just comments or empty
        if (commands && !commands.startsWith('#') && commands.includes('az ')) {
          matches.push({
            id: matches.length + 1,
            commands: commands,
            description: `Fix command ${matches.length + 1}`
          });
        }
      }
      
      if (matches.length > 0) {
        setExtractedFixCommands(matches);
        console.log(`✅ Extracted ${matches.length} fix command(s) from AI analysis`);
        
        // Show helpful toast to guide user to Operations tab
        setTimeout(() => {
          toast(
            `🔧 ${matches.length} executable fix command(s) detected! Switch to Operations tab to execute them.`,
            { 
              duration: 7000,
              icon: 'ℹ️',
              style: {
                background: '#3b82f6',
                color: '#fff',
              }
            }
          );
        }, 1500);
      } else {
        console.log('ℹ️ No executable commands found in AI analysis');
      }
    } catch (error) {
      console.error('Failed to extract commands:', error);
    }
  };

  /**
   * Execute a specific fix command from the AI analysis
   */
  const handleExecuteFixCommand = async (commandBlock) => {
    setIsExecutingFix(true);
    setFixExecutionOutput([{ 
      type: 'info', 
      message: `🚀 Executing fix command ${commandBlock.id}...` 
    }]);
    
    try {
      const response = await axios.post('/api/ai-agent/execute-operation-script', {
        script: commandBlock.commands,
        description: `Fix command ${commandBlock.id} from AI error analysis`
      });
      
      const sessionId = response.data.data.sessionId;
      
      toast.success('Fix command execution started!');
      setFixExecutionOutput([{ 
        type: 'info', 
        message: `🚀 Executing fix command ${commandBlock.id}...\n📝 Session ID: ${sessionId}` 
      }]);
      
      // Poll for execution status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/api/ai-agent/execution/${sessionId}`);
          const execution = statusResponse.data.data;
          
          // Build output lines
          const outputLines = [];
          
          // Add authentication status
          if (execution.authenticated) {
            outputLines.push({
              type: 'success',
              message: '✅ Azure authentication: SUCCESS'
            });
          }
          
          // Add step outputs
          if (execution.steps && execution.steps.length > 0) {
            execution.steps.forEach((step, index) => {
              if (step.output) {
                outputLines.push({
                  type: 'info',
                  message: `📤 Step ${index + 1} output:\n${step.output}`
                });
              }
              if (step.error) {
                outputLines.push({
                  type: 'error',
                  message: `❌ Step ${index + 1} error:\n${step.error}`
                });
              }
            });
          }
          
          // Add errors
          if (execution.errors && execution.errors.length > 0) {
            execution.errors.forEach((error, index) => {
              outputLines.push({
                type: 'error',
                message: `❌ Error ${index + 1}: ${error.error || error}`
              });
            });
          }
          
          // Add final status
          if (execution.status === 'completed') {
            outputLines.push({
              type: 'success',
              message: '\n✅ Fix command executed successfully!'
            });
            clearInterval(pollInterval);
            setIsExecutingFix(false);
            toast.success('Fix command executed successfully!');
            
            // Suggest re-running the original cloning operation
            setTimeout(() => {
              toast('You can now regenerate the Azure CLI script with corrected parameters', {
                icon: 'ℹ️',
                duration: 5000,
                style: {
                  background: '#3b82f6',
                  color: '#fff',
                }
              });
            }, 2000);
          } else if (execution.status === 'failed') {
            outputLines.push({
              type: 'error',
              message: '\n❌ Fix command execution failed. Check errors above.'
            });
            clearInterval(pollInterval);
            setIsExecutingFix(false);
            toast.error('Fix command execution failed');
          }
          
          setFixExecutionOutput(outputLines);
          
        } catch (pollError) {
          console.error('Failed to poll execution status:', pollError);
          clearInterval(pollInterval);
          setIsExecutingFix(false);
          toast.error('Failed to fetch execution status');
        }
      }, 2000); // Poll every 2 seconds
      
      // Set timeout to stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isExecutingFix) {
          setIsExecutingFix(false);
          setFixExecutionOutput(prev => [...prev, {
            type: 'error',
            message: '⏱️ Execution timeout. Please check Azure Portal for status.'
          }]);
        }
      }, 300000); // 5 minutes
      
    } catch (error) {
      console.error('Failed to execute fix command:', error);
      toast.error(error.response?.data?.message || 'Failed to execute fix command');
      setFixExecutionOutput([{ 
        type: 'error', 
        message: `❌ ${error.response?.data?.message || 'Execution failed.'}` 
      }]);
      setIsExecutingFix(false);
    }
  };

  /**
   * Analyze cloning execution errors with AI (for AI Chat tab)
   */
  const analyzeCloningingError = async (execution) => {
    try {
      console.log('🔍 Analyzing cloning error with AI...');
      
      // Extract error output from execution
      let errorOutput = '';
      let fullOutput = '';
      
      if (execution.steps && execution.steps.length > 0) {
        execution.steps.forEach(step => {
          if (step.output) {
            fullOutput += step.output + '\n';
          }
          if (step.error) {
            errorOutput += step.error + '\n';
          }
        });
      }
      
      if (execution.errors && execution.errors.length > 0) {
        execution.errors.forEach(err => {
          errorOutput += err.error + '\n';
        });
      }
      
      // Add a temporary message while analyzing
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔍 Analyzing the cloning error with AI... Please wait...'
      }]);
      
      // Send to AI for error analysis
      const response = await axios.post('/api/ai-agent/analyze-cloning-error', {
        sourceResourceGroup: selectedResourceGroup,
        targetResourceGroup: targetResourceGroup,
        output: fullOutput,
        errorOutput: errorOutput,
        status: execution.status
      });
      
      if (response.data.success && response.data.data.analysis) {
        // Remove temporary message and add AI analysis
        setChatMessages(prev => {
          const filtered = prev.filter(m => !m.content.includes('Analyzing the cloning error'));
          return [...filtered, {
            role: 'assistant',
            content: response.data.data.analysis
          }];
        });
        
        // Extract executable commands from the analysis for cloning errors too
        extractCommandsFromAnalysis(response.data.data.analysis);
        
        // Add retry cloning suggestion
        setTimeout(() => {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: '💡 **Quick Actions:**\n\n• Execute the fix commands above by hovering over them and clicking "Execute"\n• After fixing, regenerate and retry cloning\n• Or modify the configuration and try a different region',
            isRetryPrompt: true
          }]);
        }, 1000);
        
        toast.success('AI analyzed the error and provided comprehensive solutions!', { duration: 5000 });
      } else {
        // Fallback to basic error message
        setChatMessages(prev => {
          const filtered = prev.filter(m => !m.content.includes('Analyzing the cloning error'));
          const errorDetails = execution.errors?.map(e => `Step ${e.step}: ${e.error}`).join('\n') || 'Unknown error';
          return [...filtered, {
            role: 'assistant',
            content: `❌ Execution failed.\n\nErrors:\n${errorDetails}\n\nPlease check the execution modal for details.`
          }];
        });
      }
    } catch (error) {
      console.error('Failed to analyze cloning error:', error);
      
      // Fallback to basic error message
      setChatMessages(prev => {
        const filtered = prev.filter(m => !m.content.includes('Analyzing the cloning error'));
        const errorDetails = execution.errors?.map(e => `Step ${e.step}: ${e.error}`).join('\n') || 'Unknown error';
        return [...filtered, {
          role: 'assistant',
          content: `❌ Execution failed.\n\nErrors:\n${errorDetails}\n\nPlease check the execution modal for details.`
        }];
      });
    }
  };

  /**
   * Handle execution modal close - check for errors and trigger AI analysis
   */
  const handleExecutionModalClose = () => {
    console.log('🔍 Checking for errors before closing execution modal...');
    
    // Check if there are errors in the execution, even if status is "completed"
    const hasErrors = executionData && (
      (executionData.errors && executionData.errors.length > 0) ||
      (executionData.steps && executionData.steps.some(step => step.error)) ||
      executionData.status === 'failed' ||
      executionData.status === 'completed_with_warnings'
    );
    
    if (hasErrors) {
      console.log('✅ Errors detected, triggering AI analysis...');
      
      // Trigger AI error analysis
      analyzeCloningingError(executionData);
      
      // Show toast notification
      toast('🤖 AI is analyzing the errors...', {
        icon: '🔍',
        duration: 3000
      });
    } else {
      console.log('✓ No errors detected, execution was successful');
    }
    
    // Close the modal
    setShowExecutionModal(false);
  };

  /**
   * Generate AI summary of execution results
   */
  const generateAISummary = async (execution, query) => {
    setIsGeneratingSummary(true);
    setAiSummary('');
    
    try {
      // Extract the actual output from execution
      let fullOutput = '';
      if (execution.steps && execution.steps.length > 0) {
        execution.steps.forEach(step => {
          if (step.output) {
            fullOutput += step.output + '\n';
          }
        });
      }
      
      // Send to AI for analysis
      const response = await axios.post('/api/ai-agent/analyze-execution-output', {
        query: query,
        output: fullOutput,
        status: execution.status
      });
      
      if (response.data.success && response.data.data.summary) {
        setAiSummary(response.data.data.summary);
        toast.success('AI analysis complete!');
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      // Don't show error toast, just log it
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Quick operations for AI Agent
  const quickOperations = [
    {
      label: 'Clone Resource Group',
      icon: Copy,
      query: selectedResourceGroup 
        ? `Clone resource group '${selectedResourceGroup}' to a new resource group named '${selectedResourceGroup}-clone' with all resources and configurations`
        : 'Clone a resource group with all its resources'
    },
    {
      label: 'Create Resource Group',
      icon: Plus,
      query: 'Create a new resource group named "my-new-resource-group" in East US region'
    },
    {
      label: 'List All Resources',
      icon: Search,
      query: selectedResourceGroup
        ? `List all resources in resource group '${selectedResourceGroup}' with detailed information`
        : 'List all resource groups in my subscription'
    },
    {
      label: 'Backup Resources',
      icon: Database,
      query: selectedResourceGroup
        ? `Create backup snapshots for all VMs and databases in resource group '${selectedResourceGroup}'`
        : 'Create backup for resources in a resource group'
    }
  ];
  
  /**
   * Send chat message
   */
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    setChatLoading(true);
    
    try {
      const response = await axios.post('/api/ai-agent/chat', {
        messages: [...chatMessages, { role: 'user', content: userMessage }],
        context: {
          resourceGroupData: discoveredResources,
          analysisStrategy,
          targetResourceGroup
        }
      });
      
      if (response.data.success) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.data.message
        }]);
      }
    } catch (error) {
      console.error('Chat failed:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };
  
  /**
   * Copy to clipboard
   */
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  /**
   * Handle cost analysis
   */
  const handleCostAnalysis = async () => {
    if (!selectedResourceGroup) {
      toast.error('Please select a resource group first');
      return;
    }

    setIsAnalyzingCosts(true);
    setCostAnalysisData(null);
    setCostRecommendations(null);

    try {
      console.log(`💰 Starting cost analysis for: ${selectedResourceGroup} (${costAnalysisPeriod} days)`);
      
      const response = await axios.post('/api/cost-analyzer/analyze', {
        resourceGroupName: selectedResourceGroup,
        days: costAnalysisPeriod
      });

      if (response.data.success) {
        setCostAnalysisData(response.data.data);
        toast.success(`Cost analysis complete! Found ${response.data.data.resources.length} resources.`);
      } else {
        throw new Error(response.data.error || 'Cost analysis failed');
      }
    } catch (error) {
      console.error('Cost analysis failed:', error);
      toast.error(`Failed to analyze costs: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsAnalyzingCosts(false);
    }
  };

  /**
   * Generate cost optimization recommendations
   */
  const handleGenerateRecommendations = async () => {
    if (!costAnalysisData) {
      toast.error('Please run cost analysis first');
      return;
    }

    setIsGeneratingRecommendations(true);
    setCostRecommendations(null);

    try {
      console.log('🤖 Generating cost optimization recommendations...');
      
      const response = await axios.post('/api/cost-analyzer/recommendations', {
        analysisData: costAnalysisData
      });

      if (response.data.success) {
        setCostRecommendations(response.data.data.recommendations);
        toast.success('Cost optimization recommendations generated!');
      } else {
        throw new Error(response.data.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      toast.error(`Failed to generate recommendations: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };
  
  /**
   * Download file
   */
  const handleDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded!`);
  };
  
  /**
   * Get resource icon
   */
  const getResourceIcon = (resourceType) => {
    const type = resourceType?.toLowerCase() || '';
    if (type.includes('compute') || type.includes('virtualmachine')) return <Cpu className="w-5 h-5" />;
    if (type.includes('storage') || type.includes('storageaccount')) return <HardDrive className="w-5 h-5" />;
    if (type.includes('network') || type.includes('virtualnetwork')) return <Network className="w-5 h-5" />;
    if (type.includes('database') || type.includes('sql')) return <Database className="w-5 h-5" />;
    return <Server className="w-5 h-5" />;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-full mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Azure AI Agent
              </h1>
              <p className="text-gray-600 mt-1">
                Intelligent resource cloning powered by GPT-4o
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-800">AI-Powered</span>
            </div>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-3 space-y-5">
            {/* Step 1: Select Resource Group */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl shadow-lg p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Search className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Step 1: Select Source Resource Group</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Resource Group
                  </label>
                  <select
                    value={selectedResourceGroup}
                    onChange={(e) => setSelectedResourceGroup(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select resource group...</option>
                    {resourceGroups.map(rg => (
                      <option key={rg.id} value={rg.name}>{rg.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Resource Group Name
                  </label>
                  <input
                    type="text"
                    value={targetResourceGroup}
                    onChange={(e) => setTargetResourceGroup(e.target.value)}
                    placeholder="my-cloned-resources"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <button
                onClick={handleDiscover}
                disabled={!selectedResourceGroup || loading.discover}
                className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                {loading.discover ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Discovering Resources...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Discover Resources
                  </>
                )}
              </button>
            </motion.div>
            
            {/* Discovered Resources */}
            {discoveredResources && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Server className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Discovered Resources ({discoveredResources.totalResources})
                    </h2>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={!targetResourceGroup || loading.analyze}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading.analyze ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {discoveredResources.resources.map((resource, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="p-2 bg-white rounded-lg">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{resource.name}</p>
                        <p className="text-sm text-gray-600 truncate">{resource.type}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {resource.location}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* Analysis Strategy */}
            {analysisStrategy && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <GitBranch className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">AI Analysis & Strategy</h2>
                  </div>
                  {/* Static Script Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Use Script</span>
                    <button
                      type="button"
                      onClick={() => setUseStaticScript(!useStaticScript)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        useStaticScript ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={useStaticScript}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useStaticScript ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                
                {analysisStrategy.summary && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-gray-800">{analysisStrategy.summary}</p>
                  </div>
                )}
                
                {analysisStrategy.warnings && analysisStrategy.warnings.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      Warnings
                    </h3>
                    <div className="space-y-2">
                      {analysisStrategy.warnings.map((warning, index) => (
                        <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Terraform Button with Warning */}
                  <div className="relative">
                    <button
                      onClick={handleGenerateTerraform}
                      disabled={loading.terraform}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                      title="Requires Terraform to be installed on your system"
                    >
                      {loading.terraform ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Generating...</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4" />
                            <span>Generate Terraform</span>
                          </div>
                          <span className="text-xs opacity-75">⚠️ Requires Terraform Install</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Azure CLI Button with RECOMMENDED Badge */}
                  <div className="relative">
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-1 rounded-full font-bold z-10 shadow-lg animate-pulse">
                      ✓ RECOMMENDED
                    </div>
                    <button
                      onClick={handleGenerateCLI}
                      disabled={loading.cli}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-lg ring-2 ring-blue-300"
                    >
                      {loading.cli ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Generating...</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            <span className="font-semibold">Generate Azure CLI</span>
                          </div>
                          <span className="text-xs opacity-90">✓ Ready to use • No setup required</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={handleEstimateCost}
                  disabled={loading.cost}
                  className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading.cost ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Fetching Actual Costs...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      Get Current Costs (₹)
                    </>
                  )}
                </button>
              </motion.div>
            )}
            
            {/* Generated Scripts */}
            {(generatedScripts.terraform || generatedScripts.cli) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Code className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Generated Scripts</h2>
                </div>
                
                {generatedScripts.terraform && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">Terraform Configuration</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(generatedScripts.terraform.terraform, 'Terraform')}
                          className="p-2 text-gray-600 hover:text-purple-600 transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(generatedScripts.terraform.terraform, generatedScripts.terraform.filename)}
                          className="p-2 text-gray-600 hover:text-purple-600 transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleExecuteTerraform}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 text-sm font-semibold shadow-lg"
                          title="Execute Terraform automatically"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Execute Now
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                      {generatedScripts.terraform.terraform}
                    </pre>
                  </div>
                )}
                
                {generatedScripts.cli && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">Azure CLI Script</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(generatedScripts.cli.script, 'Azure CLI')}
                          className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(generatedScripts.cli.script, generatedScripts.cli.filename)}
                          className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleExecuteCLI}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center gap-2 text-sm font-semibold shadow-lg"
                          title="Execute Azure CLI automatically"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Execute Now
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 bg-gray-900 text-blue-400 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto">
                      {generatedScripts.cli.script}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
            
            {/* Cost Estimate - Enhanced */}
            {costEstimate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-xl shadow-2xl overflow-hidden border border-green-200"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-lg rounded-xl">
                      <DollarSign className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {costEstimate.isActualCost ? 'Actual Current Costs' : 'Cost Estimate'}
                      </h2>
                      <p className="text-sm text-green-100 mt-0.5">
                        {costEstimate.isActualCost ? 'Real Azure billing data from Cost Management API' : 'AI-powered pricing analysis'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Total Cost - Big and Bold */}
                  {costEstimate.totalEstimatedCost && costEstimate.totalEstimatedCost !== "N/A" && (
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 animate-pulse"></div>
                      <div className="relative p-6 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-green-300 shadow-lg">
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide">
                            Estimated {costEstimate.period || 'Monthly'} Cost
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                              ₹{costEstimate.totalEstimatedCost}
                            </span>
                            <span className="text-2xl font-bold text-gray-500">INR</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            For {discoveredResources?.resources?.length || 0} resources in {discoveredResources?.resourceGroup?.location}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {costEstimate.error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-800">Cost Estimation Error</p>
                          <p className="text-sm text-red-600 mt-1">{costEstimate.errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resource Breakdown */}
                  {costEstimate.breakdown && costEstimate.breakdown.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-gradient-to-r from-green-200 to-emerald-200"></div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cost Breakdown</h3>
                        <div className="h-px flex-1 bg-gradient-to-l from-green-200 to-emerald-200"></div>
                      </div>
                      <div className="space-y-3">
                        {costEstimate.breakdown.map((item, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 text-lg">{item.resourceName}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.resourceType}</p>
                                {item.sku && (
                                  <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                                    SKU: {item.sku}
                                  </span>
                                )}
                                {item.region && (
                                  <span className="inline-block mt-2 ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                                    📍 {item.region}
                                  </span>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-2xl font-black text-green-600">₹{item.estimatedCost}</p>
                                <p className="text-xs text-gray-500">
                                  {costEstimate.isActualCost ? '/30 days' : '/month'}
                                </p>
                              </div>
                            </div>
                            
                            {item.costFactors && item.costFactors.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-600 mb-2">💡 Cost Factors:</p>
                                <ul className="space-y-1">
                                  {item.costFactors.map((factor, idx) => (
                                    <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                      <span className="text-green-500 mt-0.5">•</span>
                                      <span>{factor}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Savings Recommendations */}
                  {costEstimate.savingsRecommendations && costEstimate.savingsRecommendations.length > 0 && (
                    <div className="p-5 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200 shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-yellow-600" />
                        <h3 className="text-lg font-bold text-yellow-900">💰 Cost Savings Opportunities</h3>
                      </div>
                      <div className="space-y-3">
                        {costEstimate.savingsRecommendations.map((rec, index) => (
                          <div key={index} className="p-4 bg-white rounded-lg shadow-sm border border-yellow-100">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-yellow-100 rounded-lg mt-1">
                                <TrendingDown className="w-5 h-5 text-yellow-700" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800 mb-1">{rec.recommendation}</p>
                                <p className="text-sm text-gray-600 mb-2">
                                  <span className="font-semibold text-yellow-700">Potential Savings:</span> {rec.potentialSavings}
                                </p>
                                <p className="text-xs text-gray-500 italic">
                                  ⚡ Action: {rec.action}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assumptions */}
                  {costEstimate.assumptions && costEstimate.assumptions.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <h4 className="text-sm font-bold text-blue-900">Pricing Assumptions</h4>
                      </div>
                      <ul className="space-y-1">
                        {costEstimate.assumptions.map((assumption, index) => (
                          <li key={index} className="text-xs text-blue-700 flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">ℹ️</span>
                            <span>{assumption}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {costEstimate.warnings && costEstimate.warnings.length > 0 && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h4 className="text-sm font-bold text-amber-900">Important Considerations</h4>
                      </div>
                      <ul className="space-y-1">
                        {costEstimate.warnings.map((warning, index) => (
                          <li key={index} className="text-xs text-amber-700 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">⚠️</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Note */}
                  <div className="text-center pt-4 border-t border-green-100">
                    <p className="text-xs text-gray-500">
                      {costEstimate.isActualCost ? (
                        <>💰 These are actual costs from Azure Cost Management API. Costs are in Indian Rupees (INR) converted from {costEstimate.assumptions?.[1]?.split('(')[1]?.split(')')[0] || 'USD'}.</>
                      ) : (
                        <>💡 These estimates are AI-generated and may vary based on actual usage patterns and Azure pricing changes.</>
                      )}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Right Panel - Tabbed Interface */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-purple-100 sticky top-4 flex flex-col"
              style={{ height: 'calc(100vh - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}
            >
              {/* Tab Header */}
              <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-4 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white/20 backdrop-blur-lg rounded-xl shadow-lg animate-pulse">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span className="truncate">Azure AI Assistant</span>
                      <span className="flex h-2 w-2 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </h2>
                    <p className="text-xs text-purple-100 mt-0.5 truncate">
                      {activeTab === 'chat' ? 'Ask me anything about Azure' : 
                       activeTab === 'operations' ? 'Execute Azure operations instantly' : 
                       'Analyze costs and optimize spending'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-lg rounded-full flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span className="text-xs font-semibold text-white">Online</span>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                      activeTab === 'chat'
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      AI Chat
                    </div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('operations')}
                    className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                      activeTab === 'operations'
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Terminal className="w-4 h-4" />
                      Operations
                    </div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('cost-analyzer')}
                    className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                      activeTab === 'cost-analyzer'
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Cost Analyzer
                    </div>
                  </motion.button>
                </div>
              </div>
              
              {/* Tab Content */}
              {activeTab === 'chat' ? (
                /* AI Chat Tab */
                <>
              
              {/* Chat Messages - Enhanced with proper scrolling */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-purple-50/30 to-blue-50/30"
                style={{ minHeight: 0 }}
              >
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg'
                          : 'bg-gradient-to-br from-green-400 to-blue-500 shadow-lg'
                      }`}>
                        {msg.role === 'user' ? (
                          <span className="text-white text-sm font-bold">U</span>
                        ) : (
                          <Bot className="w-5 h-5 text-white" />
                        )}
                      </div>
                      
                      {/* Message Bubble */}
                      <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                        <div
                          className={`p-4 rounded-2xl shadow-md min-w-0 max-w-full ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-tr-sm'
                              : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                          }`}
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                        >
                          {msg.role === 'user' ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : (
                            <div className="text-sm leading-relaxed prose prose-sm max-w-full break-words" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-gray-900 mb-3 mt-2 break-words" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-gray-800 mb-2 mt-2 break-words" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-base font-bold text-gray-800 mb-2 mt-2 break-words" {...props} />,
                                  h4: ({node, ...props}) => <h4 className="text-sm font-bold text-gray-700 mb-1 mt-1 break-words" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2 text-gray-800 leading-relaxed break-words" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-gray-900 break-words" {...props} />,
                                  em: ({node, ...props}) => <em className="italic text-gray-700 break-words" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 ml-2 space-y-1 break-words" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 ml-2 space-y-1 break-words" {...props} />,
                                  li: ({node, ...props}) => <li className="text-gray-800 leading-relaxed break-words" {...props} />,
                                  code: ({node, inline, className, children, ...props}) => {
                                    if (inline) {
                                      return <code className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-mono break-all font-semibold" {...props}>{children}</code>;
                                    }
                                    
                                    // Block code - check if it's an executable Azure CLI command
                                    const codeString = String(children).trim();
                                    const isAzureCommand = codeString.includes('az ') && !codeString.startsWith('#');
                                    
                                    return (
                                      <div className="relative group my-3">
                                        <code 
                                          className="block bg-gray-900 text-cyan-300 p-4 rounded-lg text-sm font-mono overflow-x-auto shadow-inner border border-gray-700 max-w-full" 
                                          style={{ 
                                            whiteSpace: 'pre', 
                                            overflowWrap: 'normal',
                                            lineHeight: '1.6',
                                            WebkitFontSmoothing: 'antialiased'
                                          }} 
                                          {...props}
                                        >
                                          {children}
                                        </code>
                                        {isAzureCommand && (
                                          <button
                                            onClick={() => {
                                              handleExecuteInlineCommand(codeString);
                                            }}
                                            className="absolute top-2 right-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs rounded-md hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg opacity-0 group-hover:opacity-100 flex items-center gap-1.5 font-semibold"
                                          >
                                            <Play className="w-3 h-3" />
                                            Execute
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(codeString);
                                            toast.success('Copied to clipboard!', { duration: 2000 });
                                          }}
                                          className="absolute bottom-2 right-2 px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                                        >
                                          <Copy className="w-3 h-3" />
                                          Copy
                                        </button>
                                      </div>
                                    );
                                  },
                                  pre: ({node, ...props}) => <pre className="bg-gray-900 rounded-lg p-3 mb-2 overflow-x-auto max-w-full" {...props} />,
                                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-2 bg-blue-50 text-gray-700 italic break-words" {...props} />,
                                  hr: ({node, ...props}) => <hr className="my-3 border-gray-300" {...props} />,
                                  a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 underline font-medium break-all" target="_blank" rel="noopener noreferrer" {...props} />,
                                  table: ({node, ...props}) => (
                                    <div className="overflow-x-auto mb-2 max-w-full">
                                      <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                                    </div>
                                  ),
                                  thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                                  tbody: ({node, ...props}) => <tbody className="divide-y divide-gray-200" {...props} />,
                                  tr: ({node, ...props}) => <tr {...props} />,
                                  th: ({node, ...props}) => <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider break-words" {...props} />,
                                  td: ({node, ...props}) => <td className="px-3 py-2 text-sm text-gray-800 break-words" {...props} />
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 mt-1 px-2">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {chatLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 shadow-lg flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-md border border-gray-100">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Helpful Prompts - New Feature */}
              <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-purple-100 flex-shrink-0">
                <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Quick suggestions:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setChatInput("How much will this cloning cost?")}
                    className="px-2 py-1 text-xs bg-white hover:bg-purple-100 border border-purple-200 rounded-full transition-colors"
                  >
                    💰 Estimate costs
                  </button>
                  <button
                    onClick={() => setChatInput("What resources did you find?")}
                    className="px-2 py-1 text-xs bg-white hover:bg-blue-100 border border-blue-200 rounded-full transition-colors"
                  >
                    🔍 Show resources
                  </button>
                  <button
                    onClick={() => setChatInput("Explain the cloning process")}
                    className="px-2 py-1 text-xs bg-white hover:bg-green-100 border border-green-200 rounded-full transition-colors"
                  >
                    📚 Explain process
                  </button>
                </div>
              </div>
              
              {/* Chat Input - Enhanced */}
              <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message here..."
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder-gray-400"
                    disabled={chatLoading}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {chatLoading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send
                </p>
              </div>
                </>
              ) : activeTab === 'operations' ? (
                /* Operations Tab */
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: 0 }}>
                    {/* Quick Operations */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Quick Operations
                      </h3>
                      <div className="grid grid-cols-2 gap-2 mb-6">
                        {quickOperations.map((operation, index) => (
                          <motion.button
                            key={index}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setOperationQuery(operation.query)}
                            className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                          >
                            <operation.icon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-700">{operation.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Operation Query Input */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-purple-600" />
                        Operation Request
                      </h3>
                      <textarea
                        value={operationQuery}
                        onChange={(e) => setOperationQuery(e.target.value)}
                        placeholder="E.g., Clone resource group 'demoai' to 'demoai-clone' or Create a new resource group in East US"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none transition-all"
                        rows={3}
                      />
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleValidateConfiguration}
                        disabled={isValidating || !operationQuery.trim()}
                        className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Validating Configuration...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5" />
                            Validate & Review Configuration
                          </>
                        )}
                      </motion.button>
                      
                      {validationResult && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleConfirmAndGenerate}
                          disabled={isGeneratingOperation}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isGeneratingOperation ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Generating Script...
                            </>
                          ) : (
                            <>
                              <Code className="w-5 h-5" />
                              Generate Azure CLI Script
                            </>
                          )}
                        </motion.button>
                      )}
                    </div>

                    {/* Generated Script Display */}
                    {operationScript && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-green-600" />
                            Generated Script
                          </h3>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(operationScript);
                              toast.success('Script copied to clipboard!');
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>
                        
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto text-sm font-mono max-h-64">
                          {operationScript}
                        </pre>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleExecuteOperationScript}
                          disabled={isExecutingOperation}
                          className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isExecutingOperation ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Execute Script
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* Execution Output */}
                    {operationOutput.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-blue-600" />
                            Execution Output
                            {isExecutingOperation && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Running...
                              </span>
                            )}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {operationOutput.length} lines
                          </span>
                        </div>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-y-auto text-sm font-mono" style={{ maxHeight: '400px' }}>
                          {operationOutput.map((output, index) => (
                            <p 
                              key={index} 
                              className={`mb-1 ${
                                output.type === 'error' ? 'text-red-400' : 
                                output.type === 'success' ? 'text-green-400' : 
                                output.type === 'info' ? 'text-blue-400' :
                                'text-gray-100'
                              }`}
                              style={{ wordBreak: 'break-word' }}
                            >
                              {output.message}
                            </p>
                          ))}
                          {isExecutingOperation && (
                            <p className="text-yellow-400 mt-2 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Fetching more output...
                            </p>
                          )}
                        </div>
                        {!isExecutingOperation && operationOutput.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 text-right">
                            Execution finished at {new Date().toLocaleTimeString()}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* AI Summary / Error Analysis */}
                    {(aiSummary || isGeneratingSummary) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className={`${
                          aiSummary && aiSummary.includes('❌ What Went Wrong')
                            ? 'bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-2 border-red-300'
                            : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-2 border-purple-200'
                        } rounded-xl p-5 shadow-lg`}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg shadow-lg ${
                              aiSummary && aiSummary.includes('❌ What Went Wrong')
                                ? 'bg-gradient-to-br from-red-600 to-orange-600'
                                : 'bg-gradient-to-br from-purple-600 to-blue-600'
                            }`}>
                              <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">
                                {aiSummary && aiSummary.includes('❌ What Went Wrong') 
                                  ? '🔍 AI Error Analysis & Solutions' 
                                  : 'AI Analysis'}
                              </h3>
                              <p className="text-xs text-gray-600">
                                {aiSummary && aiSummary.includes('❌ What Went Wrong')
                                  ? 'Intelligent error diagnosis with resolution steps'
                                  : 'User-friendly results summary'}
                              </p>
                            </div>
                            {isGeneratingSummary && (
                              <Loader2 className={`w-5 h-5 animate-spin ml-auto ${
                                aiSummary && aiSummary.includes('❌ What Went Wrong')
                                  ? 'text-red-600'
                                  : 'text-purple-600'
                              }`} />
                            )}
                          </div>
                          
                          {isGeneratingSummary ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-3 ${
                                  aiSummary && aiSummary.includes('❌ What Went Wrong')
                                    ? 'text-red-600'
                                    : 'text-purple-600'
                                }`} />
                                <p className="text-sm text-gray-600">
                                  {aiSummary && aiSummary.includes('❌ What Went Wrong')
                                    ? 'Analyzing error and finding solutions...'
                                    : 'Analyzing execution results...'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-gray-900 mb-3 mt-2" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-gray-800 mb-2 mt-2" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-base font-bold text-gray-800 mb-2 mt-2" {...props} />,
                                  h4: ({node, ...props}) => <h4 className="text-sm font-bold text-gray-700 mb-1 mt-1" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2 text-gray-800 leading-relaxed" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                                  em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 ml-2 space-y-1" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 ml-2 space-y-1" {...props} />,
                                  li: ({node, ...props}) => <li className="text-gray-800 leading-relaxed" {...props} />,
                                  code: ({node, inline, className, children, ...props}) => {
                                    const isInline = inline !== false;
                                    return isInline ? (
                                      <code className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-mono font-semibold" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code 
                                        className="block bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-3 shadow-inner" 
                                        style={{ 
                                          lineHeight: '1.6',
                                          whiteSpace: 'pre',
                                          WebkitFontSmoothing: 'antialiased'
                                        }} 
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    );
                                  },
                                  pre: ({node, children, ...props}) => (
                                    <pre className="bg-gray-900 rounded-lg p-0 mb-3 overflow-x-auto shadow-lg" {...props}>
                                      {children}
                                    </pre>
                                  ),
                                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-2 bg-blue-50 text-gray-700 italic" {...props} />,
                                  hr: ({node, ...props}) => <hr className="my-3 border-gray-300" {...props} />,
                                  a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                                  table: ({node, ...props}) => (
                                    <div className="overflow-x-auto mb-2">
                                      <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                                    </div>
                                  ),
                                  thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                                  tbody: ({node, ...props}) => <tbody className="divide-y divide-gray-200" {...props} />,
                                  tr: ({node, ...props}) => <tr {...props} />,
                                  th: ({node, ...props}) => <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider" {...props} />,
                                  td: ({node, ...props}) => <td className="px-3 py-2 text-sm text-gray-800" {...props} />
                                }}
                              >
                                {aiSummary}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Extracted Fix Commands - Executable Actions */}
                    {extractedFixCommands && extractedFixCommands.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-300 rounded-xl p-5 shadow-lg"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg shadow-lg">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              🔧 Executable Fix Commands
                            </h3>
                            <p className="text-xs text-gray-600">
                              Click to execute suggested fix commands one by one
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {extractedFixCommands.map((commandBlock) => (
                            <div key={commandBlock.id} className="bg-white rounded-lg p-4 border-2 border-emerald-200 shadow-sm">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-sm font-semibold text-emerald-700">
                                  Fix Command {commandBlock.id}
                                </span>
                                <button
                                  onClick={() => handleExecuteFixCommand(commandBlock)}
                                  disabled={isExecutingFix}
                                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
                                >
                                  {isExecutingFix ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Executing...
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-4 h-4" />
                                      Execute
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                                {commandBlock.commands}
                              </pre>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs text-yellow-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Note:</strong> Execute commands one by one to resolve issues step-by-step. 
                              After successful execution, you can regenerate the Azure CLI script with corrected parameters.
                            </span>
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Fix Command Execution Output */}
                    {fixExecutionOutput.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl shadow-lg p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-emerald-600" />
                            Fix Command Output
                            {isExecutingFix && (
                              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Executing...
                              </span>
                            )}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {fixExecutionOutput.length} lines
                          </span>
                        </div>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-y-auto text-sm font-mono" style={{ maxHeight: '400px' }}>
                          {fixExecutionOutput.map((output, index) => (
                            <p 
                              key={index} 
                              className={`mb-1 whitespace-pre-wrap ${
                                output.type === 'error' ? 'text-red-400' : 
                                output.type === 'success' ? 'text-green-400' : 
                                output.type === 'info' ? 'text-blue-400' :
                                'text-gray-100'
                              }`}
                              style={{ wordBreak: 'break-word' }}
                            >
                              {output.message}
                            </p>
                          ))}
                          {isExecutingFix && (
                            <p className="text-yellow-400 mt-2 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Fetching more output...
                            </p>
                          )}
                        </div>
                        {!isExecutingFix && fixExecutionOutput.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 text-right">
                            Execution finished at {new Date().toLocaleTimeString()}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Features List */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                      <h4 className="font-semibold text-purple-900 mb-2">Available Operations:</h4>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          Clone resource groups with all resources
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          Create/delete resource groups
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          Backup VMs and databases
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          List and manage Azure resources
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          Any Azure CLI operation
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : activeTab === 'cost-analyzer' ? (
                /* Cost Analyzer Tab */
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: 0 }}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                        Cost Analyzer
                      </h3>
                      <p className="text-sm text-gray-600">
                        Analyze resource costs, usage metrics, and get AI-powered optimization recommendations
                      </p>
                    </div>

                    {/* Resource Group Selection */}
                    <div className="bg-white rounded-xl shadow-md p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Resource Group
                      </label>
                      <select
                        value={selectedResourceGroup}
                        onChange={(e) => setSelectedResourceGroup(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select a resource group...</option>
                        {resourceGroups.map((rg) => (
                          <option key={rg.name} value={rg.name}>
                            {rg.name} ({rg.location})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Period Selection */}
                    <div className="bg-white rounded-xl shadow-md p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Analysis Period
                      </label>
                      <div className="flex gap-2">
                        {[30, 60, 90].map((days) => (
                          <button
                            key={days}
                            onClick={() => setCostAnalysisPeriod(days)}
                            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                              costAnalysisPeriod === days
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {days} Days
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Analyze Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCostAnalysis}
                      disabled={!selectedResourceGroup || isAnalyzingCosts}
                      className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isAnalyzingCosts ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing Costs...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-5 h-5" />
                          Analyze Costs
                        </>
                      )}
                    </motion.button>

                    {/* Cost Analysis Results */}
                    {costAnalysisData && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Summary Card */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            Cost Summary
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-sm text-gray-600">Total Cost ({costAnalysisData.period})</div>
                              <div className="text-2xl font-bold text-green-700">
                                ₹{(costAnalysisData.totalCost * 83).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">
                                ${costAnalysisData.totalCost.toFixed(2)} {costAnalysisData.currency}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">Cost-Generating Resources</div>
                              <div className="text-2xl font-bold text-orange-700">
                                {costAnalysisData.summary?.costGeneratingResources || costAnalysisData.resources.filter(r => r.monthlyCost > 0).length}
                              </div>
                              <div className="text-xs text-gray-500">
                                of {costAnalysisData.summary?.totalResources || costAnalysisData.resources.length} total
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">Top Cost Resource</div>
                              <div className="text-lg font-bold text-gray-700 truncate" title={costAnalysisData.resources.find(r => r.monthlyCost > 0)?.name || 'N/A'}>
                                {costAnalysisData.resources.find(r => r.monthlyCost > 0)?.name || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                ₹{((costAnalysisData.resources.find(r => r.monthlyCost > 0)?.monthlyCost || 0) * 83).toFixed(2)}/mo
                              </div>
                            </div>
                          </div>
                          {costAnalysisData.summary?.topCostResources && costAnalysisData.summary.topCostResources.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-green-300">
                              <div className="text-sm font-semibold text-gray-700 mb-2">Top 5 Cost Drivers:</div>
                              <div className="space-y-1">
                                {costAnalysisData.summary.topCostResources.slice(0, 5).map((resource, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-gray-600 truncate flex-1">{resource.name}</span>
                                    <span className="text-gray-900 font-semibold ml-2">₹{(resource.cost * 83).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Resources Table - Focus on Cost-Generating Resources */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                          <div className="p-4 bg-gray-50 border-b">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">Resource Details</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {costAnalysisData.resources.filter(r => r.monthlyCost > 0).length} cost-generating resources
                                  {costAnalysisData.resources.filter(r => r.monthlyCost === 0).length > 0 && 
                                    ` • ${costAnalysisData.resources.filter(r => r.monthlyCost === 0).length} zero-cost`
                                  }
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                {costAnalysisData.resources.filter(r => r.monthlyCost === 0).length > 0 && (
                                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={showZeroCostResources}
                                      onChange={(e) => setShowZeroCostResources(e.target.checked)}
                                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    Show zero-cost
                                  </label>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Sorted by:</span>
                                  <span className="text-xs font-semibold text-purple-600">Cost (High → Low)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="overflow-x-auto max-h-96">
                            <table className="w-full">
                              <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Resource</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Monthly Cost</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Avg CPU</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Max CPU</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SKU/Size</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {costAnalysisData.resources
                                  .filter(r => showZeroCostResources || r.monthlyCost > 0) // Filter based on toggle
                                  .map((resource, idx) => {
                                    const isUnderutilized = resource.avgCpu !== null && resource.avgCpu < 30 && resource.maxCpu !== null && resource.maxCpu < 50;
                                    return (
                                      <tr key={idx} className={`hover:bg-gray-50 ${isUnderutilized ? 'bg-yellow-50/50' : ''}`}>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{resource.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{resource.type.split('/').pop()}</td>
                                        <td className="px-4 py-3 text-sm">
                                          <span className="font-semibold text-green-700">
                                            ₹{(resource.monthlyCost * 83).toFixed(2)}
                                          </span>
                                          <div className="text-xs text-gray-500">
                                            ${resource.monthlyCost.toFixed(2)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                          {resource.avgCpu !== null ? (
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                              resource.avgCpu < 30 ? 'bg-green-100 text-green-800' :
                                              resource.avgCpu < 60 ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-red-100 text-red-800'
                                            }`}>
                                              {resource.avgCpu.toFixed(1)}%
                                            </span>
                                          ) : (
                                            <span className="text-gray-400 text-xs">No metrics</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                          {resource.maxCpu !== null ? (
                                            <span className="text-gray-700 text-xs">{resource.maxCpu.toFixed(1)}%</span>
                                          ) : (
                                            <span className="text-gray-400 text-xs">N/A</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                          {resource.configuration?.sku?.name || resource.configuration?.vmSize || resource.configuration?.sku?.tier || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                          {isUnderutilized ? (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                              Optimize
                                            </span>
                                          ) : resource.avgCpu === null ? (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                              No Data
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                              Normal
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                {costAnalysisData.resources.filter(r => r.monthlyCost > 0).length === 0 && (
                                  <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                      <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-8 h-8 text-yellow-500" />
                                        <div className="font-semibold">No cost-generating resources found</div>
                                        <div className="text-xs text-gray-400 max-w-md">
                                          All resources show ₹0.00 cost. This may indicate:
                                          <ul className="list-disc list-inside mt-2 text-left">
                                            <li>Cost data is not yet available for the selected period</li>
                                            <li>Resources are in a free tier or have no charges</li>
                                            <li>Costs are aggregated at a different level (e.g., App Service Plan vs. Web App)</li>
                                          </ul>
                                          <div className="mt-3 text-gray-600">
                                            Total cost shown (₹{(costAnalysisData.totalCost * 83).toFixed(2)}) may include costs not yet broken down to individual resources.
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Generate Recommendations Button */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleGenerateRecommendations}
                          disabled={isGeneratingRecommendations}
                          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isGeneratingRecommendations ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Generating Recommendations...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Get AI Optimization Recommendations
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* Recommendations */}
                    {costRecommendations && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl shadow-md p-6 space-y-4"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingDown className="w-5 h-5 text-green-600" />
                          Optimization Recommendations
                        </h4>
                        
                        {costRecommendations.summary && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700">{costRecommendations.summary}</p>
                          </div>
                        )}

                        {costRecommendations.totalPotentialSavings && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-1">Potential Savings</div>
                            <div className="text-2xl font-bold text-green-700">
                              {costRecommendations.totalPotentialSavings.monthly}
                            </div>
                            <div className="text-xs text-gray-500">
                              Annual: {costRecommendations.totalPotentialSavings.annual} 
                              ({costRecommendations.totalPotentialSavings.percentage} reduction)
                            </div>
                          </div>
                        )}

                        {costRecommendations.recommendations && costRecommendations.recommendations.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-gray-900">Optimization Recommendations</h5>
                              <span className="text-xs text-gray-500">
                                {costRecommendations.recommendations.length} recommendation(s)
                              </span>
                            </div>
                            {costRecommendations.recommendations
                              .sort((a, b) => (a.priority || 999) - (b.priority || 999))
                              .map((rec, idx) => (
                              <div key={idx} className="border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {rec.priority && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                                          Priority {rec.priority}
                                        </span>
                                      )}
                                      <div className="font-semibold text-gray-900 text-lg">{rec.resource}</div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">{rec.reason}</div>
                                    {rec.resourceType && (
                                      <div className="text-xs text-gray-500 mt-1">Type: {rec.resourceType}</div>
                                    )}
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    rec.riskLevel === 'Low' ? 'bg-green-100 text-green-800 border border-green-300' :
                                    rec.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                                    'bg-red-100 text-red-800 border border-red-300'
                                  }`}>
                                    {rec.riskLevel || 'Medium'} Risk
                                  </span>
                                </div>
                                
                                {/* Cost Comparison */}
                                <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-white rounded-lg border border-gray-200">
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Current Cost</div>
                                    <div className="text-lg font-bold text-gray-700">
                                      ₹{rec.currentMonthlyCost ? (rec.currentMonthlyCost * 83).toFixed(2) : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Projected Cost</div>
                                    <div className="text-lg font-bold text-green-700">
                                      ₹{rec.projectedMonthlyCost ? (rec.projectedMonthlyCost * 83).toFixed(2) : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Monthly Savings</div>
                                    <div className="text-lg font-bold text-emerald-700">
                                      {rec.estimatedMonthlySavings || 'N/A'}
                                    </div>
                                    {rec.estimatedAnnualSavings && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Annual: {rec.estimatedAnnualSavings}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* SKU Comparison */}
                                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 mb-1">Current SKU</div>
                                    <div className="font-semibold text-gray-900">{rec.currentSku || 'Unknown'}</div>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                    <div className="text-xs text-gray-600 mb-1">Recommended SKU</div>
                                    <div className="font-semibold text-green-700">{rec.recommendedSku || 'Unknown'}</div>
                                    {rec.savingsPercentage && (
                                      <div className="text-xs text-green-600 mt-1">
                                        {rec.savingsPercentage}% reduction
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Metrics */}
                                {rec.metrics && (
                                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-900 mb-2">Utilization Metrics:</div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      {rec.metrics.cpuUsage && (
                                        <div>
                                          <span className="text-blue-700">CPU: </span>
                                          <span className="font-semibold">Avg {rec.metrics.cpuUsage.avg}%</span>
                                          {rec.metrics.cpuUsage.max && (
                                            <span className="text-blue-600">, Max {rec.metrics.cpuUsage.max}%</span>
                                          )}
                                        </div>
                                      )}
                                      {rec.metrics.memoryUsage && (
                                        <div>
                                          <span className="text-blue-700">Memory: </span>
                                          <span className="font-semibold">Avg {rec.metrics.memoryUsage.avg}%</span>
                                          {rec.metrics.memoryUsage.max && (
                                            <span className="text-blue-600">, Max {rec.metrics.memoryUsage.max}%</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {rec.metrics.analysisPeriod && (
                                      <div className="text-xs text-blue-600 mt-2">
                                        Analysis based on {rec.metrics.analysisPeriod} of data
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Action Steps */}
                                {rec.actionSteps && rec.actionSteps.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <PlayCircle className="w-4 h-4 text-purple-600" />
                                      Implementation Steps
                                    </div>
                                    <div className="space-y-2">
                                      {rec.actionSteps.map((step, stepIdx) => (
                                        <div key={stepIdx} className="bg-white rounded-lg p-3 border border-gray-200">
                                          <div className="flex items-start gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                                              {step.step || stepIdx + 1}
                                            </span>
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-gray-900">{step.action}</div>
                                              {step.command && (
                                                <div className="mt-2">
                                                  <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block overflow-x-auto">
                                                    {step.command}
                                                  </code>
                                                </div>
                                              )}
                                              {step.estimatedTime && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                  ⏱️ {step.estimatedTime}
                                                  {step.downtime && ` • ${step.downtime}`}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Rollback Plan */}
                                {rec.rollbackPlan && (
                                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                    <div className="text-xs font-semibold text-orange-900 mb-2">🔄 Rollback Plan:</div>
                                    {rec.rollbackPlan.command && (
                                      <code className="text-xs bg-gray-900 text-orange-400 p-2 rounded block overflow-x-auto">
                                        {rec.rollbackPlan.command}
                                      </code>
                                    )}
                                    {rec.rollbackPlan.estimatedTime && (
                                      <div className="text-xs text-orange-700 mt-1">
                                        Estimated time: {rec.rollbackPlan.estimatedTime}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Expected Impact */}
                                {rec.expectedImpact && (
                                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <div className="text-xs font-semibold text-emerald-900 mb-1">Expected Impact:</div>
                                    <div className="text-sm text-emerald-800">{rec.expectedImpact}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {costRecommendations.warnings && costRecommendations.warnings.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h5 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5" />
                              Warnings
                            </h5>
                            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                              {costRecommendations.warnings.map((warning, idx) => (
                                <li key={idx}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Insights */}
                        {costRecommendations.insights && costRecommendations.insights.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                              <Info className="w-5 h-5" />
                              Key Insights
                            </h5>
                            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                              {costRecommendations.insights.map((insight, idx) => (
                                <li key={idx}>{insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Cost Breakdown by Type */}
                        {costRecommendations.costBreakdown?.costByType && (
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                            <h5 className="font-semibold text-purple-900 mb-3">Cost Breakdown by Resource Type</h5>
                            <div className="space-y-2">
                              {Object.entries(costRecommendations.costBreakdown.costByType)
                                .sort((a, b) => b[1] - a[1])
                                .map(([type, cost]) => (
                                  <div key={type} className="flex items-center justify-between bg-white rounded-lg p-2">
                                    <span className="text-sm text-gray-700">{type.split('/').pop()}</span>
                                    <span className="text-sm font-semibold text-purple-700">₹{(cost * 83).toFixed(2)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Execution Modal */}
      <AnimatePresence>
        {showExecutionModal && executionData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => {
              if (executionData.status !== 'running') {
                setShowExecutionModal(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  {executionType === 'terraform' ? (
                    <FileCode className="w-6 h-6 text-purple-600" />
                  ) : (
                    <Code className="w-6 h-6 text-blue-600" />
                  )}
                  {executionType === 'terraform' ? 'Terraform' : 'Azure CLI'} Execution
                </h2>
                {executionData.status !== 'running' && (
                  <button
                    onClick={handleExecutionModalClose}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Status */}
              <div className="mb-4">
                <div className={`px-4 py-3 rounded-lg font-semibold text-center ${
                  executionData.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  executionData.status === 'completed' ? 'bg-green-100 text-green-800' :
                  executionData.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {executionData.status === 'running' && <Loader className="w-5 h-5 inline animate-spin mr-2" />}
                  {executionData.status === 'completed' && <CheckCircle2 className="w-5 h-5 inline mr-2" />}
                  {executionData.status === 'failed' && <AlertCircle className="w-5 h-5 inline mr-2" />}
                  Status: {executionData.status.toUpperCase()}
                  {executionData.duration && ` (${(executionData.duration / 1000).toFixed(1)}s)`}
                </div>
              </div>
              
              {/* Steps */}
              <div className="space-y-3 mb-4">
                {executionData.steps.map((step, index) => (
                  <div key={index} className={`p-3 rounded-lg border-2 ${
                    step.status === 'running' ? 'border-blue-300 bg-blue-50' :
                    step.status === 'completed' ? 'border-green-300 bg-green-50' :
                    step.status === 'failed' ? 'border-red-300 bg-red-50' :
                    'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {step.status === 'running' && <Loader className="w-4 h-4 animate-spin text-blue-600" />}
                        {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {step.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600" />}
                        <span className="font-semibold text-sm">Step {step.index}</span>
                      </div>
                      {step.duration && (
                        <span className="text-xs text-gray-600">{(step.duration / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    
                    <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto mb-2">
                      {step.command}
                    </pre>
                    
                    {/* Show Script Content Button */}
                    {step.scriptContent && (
                      <details className="mb-3">
                        <summary className="text-xs font-semibold text-blue-600 cursor-pointer hover:text-blue-800 mb-2">
                          📜 View Full Script ({step.scriptContent.split('\n').length} lines)
                        </summary>
                        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto mt-2 max-h-60 border-2 border-blue-300">
                          {step.scriptContent}
                        </pre>
                      </details>
                    )}
                    
                    {/* Show full output with better formatting */}
                    {step.output && (
                      <div className="mb-2">
                        <details open>
                          <summary className="text-xs font-semibold text-green-700 mb-1 cursor-pointer hover:text-green-900">
                            📤 Execution Output ({step.output.split('\n').filter(l => l.trim()).length} lines)
                          </summary>
                          <div className="text-xs text-gray-700 bg-white p-3 rounded max-h-60 overflow-y-auto font-mono mt-2 border-2 border-green-200 whitespace-pre-wrap">
                            {step.output}
                          </div>
                        </details>
                      </div>
                    )}
                    
                    {/* Show errors prominently - only if there are actual errors (not just warnings) */}
                    {step.error && step.error.trim().length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Error Details:
                        </div>
                        <div className="text-xs text-red-700 bg-red-50 p-3 rounded font-mono border-2 border-red-300 whitespace-pre-wrap">
                          {step.error}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                {executionData.status === 'running' && (
                  <button
                    onClick={handleCancelExecution}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    Cancel Execution
                  </button>
                )}
                {executionData.status !== 'running' && (
                  <button
                    onClick={handleExecutionModalClose}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Configuration Confirmation Modal */}
      <AnimatePresence>
        {showConfirmationModal && validationResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8" />
                    <div>
                      <h3 className="text-2xl font-bold">Configuration Validation</h3>
                      <p className="text-blue-100 text-sm mt-1">Review and confirm before proceeding</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Original Request */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">📝 Your Request:</h4>
                  <p className="text-gray-700">{validationResult.originalRequest}</p>
                </div>

                {/* Detected Intent */}
                {validationResult.analysis && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">🎯 Detected Intent:</h4>
                    <p className="text-blue-700">{validationResult.analysis.detectedIntent}</p>
                  </div>
                )}

                {/* Validated Configuration */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="font-semibold text-green-900 mb-3">✅ Validated Configuration:</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(validationResult.validatedConfig || {}).map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Corrections */}
                {validationResult.corrections && validationResult.corrections.length > 0 && (
                  <div className="bg-yellow-50 rounded-xl p-4">
                    <h4 className="font-semibold text-yellow-900 mb-3">⚠️ Corrections Applied:</h4>
                    <div className="space-y-2">
                      {validationResult.corrections.map((correction, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border-l-4 border-yellow-500">
                          <div className="font-semibold text-gray-900">{correction.parameter}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Issue:</span> {correction.issue}
                          </div>
                          <div className="text-sm text-green-700 mt-1">
                            <span className="font-medium">Fix:</span> {correction.correction}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{correction.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-4">
                    <h4 className="font-semibold text-orange-900 mb-3">⚡ Warnings:</h4>
                    <div className="space-y-2">
                      {validationResult.warnings.map((warning, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3">
                          <div className="text-sm text-gray-700">{warning.message}</div>
                          {warning.recommendation && (
                            <div className="text-sm text-green-600 mt-1">
                              → {warning.recommendation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {validationResult.recommendations && validationResult.recommendations.length > 0 && (
                  <div className="bg-purple-50 rounded-xl p-4">
                    <h4 className="font-semibold text-purple-900 mb-3">💡 Recommendations:</h4>
                    <ul className="space-y-1">
                      {validationResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-purple-700 flex items-start gap-2">
                          <span className="text-purple-500">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cost & Time Estimates */}
                {(validationResult.estimatedCost || validationResult.deploymentTime) && (
                  <div className="grid grid-cols-2 gap-4">
                    {validationResult.estimatedCost && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                        <h4 className="font-semibold text-green-900 mb-2">💰 Estimated Cost:</h4>
                        <p className="text-2xl font-bold text-green-700">{validationResult.estimatedCost}</p>
                      </div>
                    )}
                    {validationResult.deploymentTime && (
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">⏱️ Deployment Time:</h4>
                        <p className="text-sm text-blue-700">{validationResult.deploymentTime}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmation Message */}
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-4 text-center">
                  <p className="text-lg font-semibold text-gray-900">{validationResult.confirmationMessage}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 p-6 rounded-b-2xl flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAndGenerate}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Generate Script
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        
        {/* Clone Validation Confirmation Modal */}
        {showCloneConfirmationModal && cloneValidationResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCloneConfirmationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-8 h-8" />
                    <div>
                      <h3 className="text-2xl font-bold">Cloning Validation Complete</h3>
                      <p className="text-green-100 text-sm mt-1">Review validated configurations for all resources</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCloneConfirmationModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Source & Target Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">📦 Source Resource Group:</h4>
                    <p className="text-blue-700 font-mono text-sm">{selectedResourceGroup}</p>
                    {cloneValidationResult.sourceInfo && (
                      <p className="text-blue-600 text-xs mt-2">
                        {cloneValidationResult.sourceInfo.resourceCount} resources found
                      </p>
                    )}
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <h4 className="font-semibold text-green-900 mb-2">🎯 Target Resource Group:</h4>
                    <p className="text-green-700 font-mono text-sm">{targetResourceGroup}</p>
                    {cloneValidationResult.targetInfo && (
                      <p className="text-green-600 text-xs mt-2">
                        Will be created in {cloneValidationResult.targetInfo.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quota & Region Availability - CRITICAL SECTION */}
                {cloneValidationResult.azureValidationStatus && (
                  <div className={`rounded-xl p-5 border-2 ${
                    cloneValidationResult.azureValidationStatus.quotaAvailable 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-amber-50 border-amber-400'
                  }`}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${
                        cloneValidationResult.azureValidationStatus.quotaAvailable 
                          ? 'bg-green-500' 
                          : 'bg-amber-500'
                      }`}>
                        {cloneValidationResult.azureValidationStatus.quotaAvailable ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <AlertTriangle className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold text-lg ${
                          cloneValidationResult.azureValidationStatus.quotaAvailable 
                            ? 'text-green-900' 
                            : 'text-amber-900'
                        }`}>
                          {cloneValidationResult.azureValidationStatus.quotaAvailable 
                            ? '✅ Quota Available' 
                            : '⚠️ Quota Check - Action Required'}
                        </h4>
                        {cloneValidationResult.azureValidationStatus.quotaDetails && (
                          <p className={`text-sm mt-1 ${
                            cloneValidationResult.azureValidationStatus.quotaAvailable 
                              ? 'text-green-700' 
                              : 'text-amber-700'
                          }`}>
                            {cloneValidationResult.azureValidationStatus.quotaDetails}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alternative Regions (if quota exhausted) */}
                    {!cloneValidationResult.azureValidationStatus.quotaAvailable && 
                     cloneValidationResult.azureValidationStatus.alternativeRegions && 
                     cloneValidationResult.azureValidationStatus.alternativeRegions.length > 0 && (
                      <div className="mt-4 bg-white rounded-lg p-4 border-2 border-amber-300">
                        <h5 className="font-semibold text-amber-900 mb-3">🌍 Recommended Regions with Available Quota:</h5>
                        <div className="space-y-2">
                          {cloneValidationResult.azureValidationStatus.alternativeRegions.map((region, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3 rounded-lg border-2 ${
                                idx === 0 
                                  ? 'bg-emerald-50 border-emerald-400' 
                                  : 'bg-gray-50 border-gray-300'
                              } hover:shadow-md transition-shadow`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {idx === 0 && <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded">RECOMMENDED</span>}
                                    <span className="font-bold text-gray-900">{region.region}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">{region.reason}</p>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-2xl font-bold text-emerald-600">{region.available}</div>
                                  <div className="text-xs text-gray-500">available</div>
                                  <div className="text-xs text-gray-400 mt-1">{region.percentUsed}% used</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <strong>💡 Tip:</strong> The script will use the <strong>recommended region</strong> ({cloneValidationResult.azureValidationStatus.recommendedRegion || 'top available'}) to avoid quota errors during execution.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Validated Resources */}
                {cloneValidationResult.validatedResources && cloneValidationResult.validatedResources.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">✅ Validated Resources ({cloneValidationResult.validatedResources.length}):</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {cloneValidationResult.validatedResources.map((resource, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            resource.status === 'validated' ? 'bg-green-100' : 
                            resource.status === 'corrected' ? 'bg-yellow-100' : 
                            'bg-blue-100'
                          }`}>
                            {resource.type === 'WebApp' && <Server className="w-4 h-4 text-blue-600" />}
                            {resource.type === 'Storage' && <HardDrive className="w-4 h-4 text-purple-600" />}
                            {resource.type === 'Database' && <Database className="w-4 h-4 text-green-600" />}
                            {resource.type === 'Network' && <Network className="w-4 h-4 text-indigo-600" />}
                            {!['WebApp', 'Storage', 'Database', 'Network'].includes(resource.type) && <Cpu className="w-4 h-4 text-gray-600" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{resource.originalName}</span>
                              {resource.newName && resource.newName !== resource.originalName && (
                                <>
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                  <span className="font-semibold text-green-600">{resource.newName}</span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{resource.type}</div>
                            {resource.corrections && resource.corrections.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {resource.corrections.map((corr, cIdx) => (
                                  <div key={cIdx} className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                                    ⚠️ {corr}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            resource.status === 'validated' ? 'bg-green-100 text-green-700' :
                            resource.status === 'corrected' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {resource.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Global Corrections */}
                {cloneValidationResult.globalCorrections && cloneValidationResult.globalCorrections.length > 0 && (
                  <div className="bg-yellow-50 rounded-xl p-4">
                    <h4 className="font-semibold text-yellow-900 mb-3">⚠️ Global Corrections Applied:</h4>
                    <div className="space-y-2">
                      {cloneValidationResult.globalCorrections.map((correction, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border-l-4 border-yellow-500">
                          <div className="text-sm text-gray-700">{correction.description}</div>
                          <div className="text-xs text-green-600 mt-1">→ {correction.fix}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {cloneValidationResult.warnings && cloneValidationResult.warnings.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-4">
                    <h4 className="font-semibold text-orange-900 mb-3">⚡ Warnings:</h4>
                    <div className="space-y-2">
                      {cloneValidationResult.warnings.map((warning, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                          <div className="flex-1 text-sm text-gray-700">{warning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost & Time Estimates */}
                {(cloneValidationResult.estimatedCost || cloneValidationResult.estimatedTime) && (
                  <div className="grid grid-cols-2 gap-4">
                    {cloneValidationResult.estimatedCost && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                        <h4 className="font-semibold text-green-900 mb-2">💰 Estimated Cost:</h4>
                        <p className="text-2xl font-bold text-green-700">{cloneValidationResult.estimatedCost}</p>
                      </div>
                    )}
                    {cloneValidationResult.estimatedTime && (
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">⏱️ Estimated Time:</h4>
                        <p className="text-sm text-blue-700">{cloneValidationResult.estimatedTime}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="bg-gradient-to-r from-green-100 to-teal-100 rounded-xl p-4 text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    {cloneValidationResult.summary || 'All resources validated and ready for cloning!'}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-gray-50 p-6 rounded-b-2xl flex gap-3 justify-end">
                <button
                  onClick={() => setShowCloneConfirmationModal(false)}
                  className="px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClone}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Proceed with Cloning
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Prompt Modal */}
      {showInteractivePrompt && interactivePrompt && (
        <InteractivePromptModal
          prompt={interactivePrompt}
          onResponse={handlePromptResponse}
          onClose={() => {
            // Allow closing only for certain error types
            if (interactivePrompt.errorType !== 'permission_denied') {
              setShowInteractivePrompt(false);
              setInteractivePrompt(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default AIAgent;

