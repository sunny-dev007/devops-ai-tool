import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Server, Key, Shield, Plus, MessageSquare, Terminal, Loader2, Play, Eye, EyeOff, Info,
  RefreshCw, ChevronDown, ChevronUp, Search, CheckCircle, Table, Code, Zap, Book, AlertCircle, Copy
} from 'lucide-react';
import { useAzure } from '../context/AzureContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const SQLOperationsAssistant = () => {
  const { subscriptionSummary, refreshData } = useAzure();
  const [sqlServers, setSqlServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [databaseSchema, setDatabaseSchema] = useState(null);
  const [firewallRules, setFirewallRules] = useState([]);
  
  // Authentication
  const [dbUsername, setDbUsername] = useState('sqladmin');
  const [dbPassword, setDbPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatContainerRef = useRef(null);
  
  // UI state
  const [showSchemaDetails, setShowSchemaDetails] = useState(true);
  const [showFirewallRules, setShowFirewallRules] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  
  // Operations state
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'operations'
  const [operationQuery, setOperationQuery] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecutingOperation, setIsExecutingOperation] = useState(false);
  const [executionOutput, setExecutionOutput] = useState([]);

  useEffect(() => {
    fetchSqlServers();
  }, [subscriptionSummary]);

  useEffect(() => {
    if (selectedServer) {
      fetchServerDetails(selectedServer);
    } else {
      setDatabases([]);
      setFirewallRules([]);
      setSelectedDatabase(null);
      setDatabaseSchema(null);
    }
  }, [selectedServer]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchSqlServers = async () => {
    try {
      const response = await axios.get('/api/sql-operations/sql-servers');
      setSqlServers(response.data.data);
      if (response.data.data.length > 0 && !selectedServer) {
        setSelectedServer(response.data.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch SQL servers:', error);
      toast.error('Failed to fetch SQL servers');
    }
  };

  const fetchServerDetails = async (server) => {
    try {
      const dbResponse = await axios.get(`/api/sql-operations/sql-servers/${server.resourceGroup}/${server.name}/databases`);
      setDatabases(dbResponse.data.data || []);

      const fwResponse = await axios.get(`/api/sql-operations/sql-servers/${server.resourceGroup}/${server.name}/firewall-rules`);
      setFirewallRules(fwResponse.data.data || []);
    } catch (error) {
      console.error('Failed to fetch server details:', error);
      toast.error('Failed to fetch server details');
    }
  };

  const handleConnectToDatabase = async () => {
    if (!selectedDatabase || !dbPassword) {
      toast.error('Please select a database and enter password');
      return;
    }

    setIsConnected(false);
    toast.loading('Fetching database schema...');

    try {
      const response = await axios.post('/api/sql-operations/database-schema', {
        server: selectedServer.name,
        database: selectedDatabase.name,
        resourceGroup: selectedServer.resourceGroup,
        username: dbUsername,
        password: dbPassword
      });

      toast.dismiss();

      if (response.data.success) {
        setDatabaseSchema(response.data.data);
        setIsConnected(true);
        toast.success(`Connected! Found ${response.data.data.tableCount} tables`);
        
        // Add welcome message
        setChatMessages([{
          role: 'assistant',
          content: `🎉 **Connected to database: ${response.data.data.database}**\n\nI've analyzed your database schema and found **${response.data.data.tableCount} tables**:\n\n${response.data.data.tables.map((t, i) => `${i + 1}. ${t.schema}.${t.table} (${t.columns.length} columns)`).join('\n')}\n\nI'm ready to help you with:\n- SQL query generation\n- Schema analysis\n- Query optimization\n- Database design questions\n- Troubleshooting\n\nWhat would you like to do?`
        }]);
      } else if (response.data.sqlcmdRequired) {
        toast.error('sqlcmd not installed');
        setIsConnected(false);
        setChatMessages([{
          role: 'assistant',
          content: `⚠️ **sqlcmd Not Installed**\n\nSchema analysis requires sqlcmd command-line tools.\n\n**Install Instructions:**\n- **macOS:** \`brew install sqlcmd\`\n- **Windows:** Download from Microsoft\n- **Linux:** \`sudo apt-get install mssql-tools\`\n\nI can still help you with general SQL queries and guidance without schema access!`
        }]);
      }
    } catch (error) {
      toast.dismiss();
      console.error('Failed to fetch schema:', error);
      toast.error(error.response?.data?.error || 'Failed to connect');
      setIsConnected(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newUserMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatting(true);

    try {
      const response = await axios.post('/api/sql-operations/developer-chat', {
        messages: [...chatMessages, newUserMessage],
        schema: databaseSchema,
        server: selectedServer?.name,
        database: selectedDatabase?.name
      });

      const aiResponse = response.data?.data?.response;
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error('Chat failed:', error);
      toast.error('Chat failed. Please try again.');
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleExecuteQuery = async (query) => {
    if (!selectedDatabase || !dbPassword) {
      toast.error('Please connect to a database first');
      return;
    }

    toast.loading('Executing query...');

    try {
      const response = await axios.post('/api/sql-operations/execute-query', {
        server: selectedServer.name,
        database: selectedDatabase.name,
        resourceGroup: selectedServer.resourceGroup,
        query: query,
        username: dbUsername,
        password: dbPassword
      });

      toast.dismiss();

      if (response.data.success) {
        toast.success(`Query executed! ${response.data.data.rowCount} rows returned`);
        
        // Add result to chat
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Query Executed Successfully**\n\n**Rows returned:** ${response.data.data.rowCount}\n\n**Results:**\n\`\`\`\n${response.data.data.output}\n\`\`\``
        }]);
      } else if (response.data.sqlcmdRequired) {
        toast.error('sqlcmd not installed');
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ **sqlcmd Required**\n\nQuery execution requires sqlcmd. You can:\n1. Install sqlcmd\n2. Copy the query to Azure Data Studio/SSMS\n\n**Query:**\n\`\`\`sql\n${response.data.query}\n\`\`\``
        }]);
      }
    } catch (error) {
      toast.dismiss();
      console.error('Query execution failed:', error);
      toast.error('Query execution failed');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Execution Failed**\n\nError: ${error.response?.data?.error || error.message}`
      }]);
    }
  };

  const extractSQLFromMessage = (message) => {
    const sqlRegex = /```sql\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;
    
    while ((match = sqlRegex.exec(message)) !== null) {
      matches.push(match[1].trim());
    }
    
    return matches;
  };

  const handleGenerateOperationScript = async () => {
    if (!operationQuery.trim()) {
      toast.error('Please enter an operation query');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post('/api/sql-operations/generate-script', {
        query: operationQuery,
        context: {
          selectedServer: selectedServer,
          databases: databases.map(db => db.name),
          firewallRules: firewallRules.length
        }
      });

      const script = response.data?.data?.script;
      if (typeof script === 'string' && script.trim()) {
        setGeneratedScript(script);
        toast.success('Script generated successfully!');
      } else {
        console.error('Invalid script response:', response.data);
        toast.error('Generated script is invalid');
      }
    } catch (error) {
      console.error('Failed to generate script:', error);
      toast.error(error.response?.data?.error || 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteOperationScript = async () => {
    if (!generatedScript) {
      toast.error('No script to execute');
      return;
    }

    setIsExecutingOperation(true);
    setExecutionOutput([{ type: 'info', message: '⏳ Starting execution...' }]);
    
    try {
      const response = await axios.post('/api/sql-operations/execute-script', {
        script: generatedScript,
        description: `SQL Operation: ${operationQuery.substring(0, 50)}...`
      });
      
      const sessionId = response.data.data.sessionId;
      toast.success('Script execution started. Fetching output...');
      
      // Poll for execution status and output
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/api/sql-operations/execution/${sessionId}`);
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
            execution.steps.forEach((step, index) => {
              if (step.output) {
                // Split output by lines and add each line
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
          
          // Add final status
          if (execution.status === 'completed') {
            outputLines.push({
              type: 'success',
              message: '\n✅ Execution completed successfully!'
            });
            clearInterval(pollInterval);
            setIsExecutingOperation(false);
            toast.success('Execution completed successfully!');
            
            // Clear the script after successful execution
            setTimeout(() => {
              setGeneratedScript('');
              setOperationQuery('');
            }, 3000);
          } else if (execution.status === 'failed') {
            outputLines.push({
              type: 'error',
              message: '\n❌ Execution failed. Check errors above.'
            });
            clearInterval(pollInterval);
            setIsExecutingOperation(false);
            toast.error('Execution failed');
          }
          
          setExecutionOutput(outputLines);
          
        } catch (pollError) {
          console.error('Failed to poll execution status:', pollError);
          clearInterval(pollInterval);
          setIsExecutingOperation(false);
          toast.error('Failed to fetch execution status');
        }
      }, 2000); // Poll every 2 seconds
      
      // Set timeout to stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isExecutingOperation) {
          setIsExecutingOperation(false);
          setExecutionOutput(prev => [...prev, {
            type: 'error',
            message: '⏱️ Execution timeout. Please check Azure Portal for status.'
          }]);
        }
      }, 300000); // 5 minutes
      
    } catch (error) {
      console.error('Failed to execute script:', error);
      toast.error(error.response?.data?.error || 'Failed to execute script');
      setExecutionOutput([{ 
        type: 'error', 
        message: `❌ ${error.response?.data?.error || 'Execution failed.'}` 
      }]);
      setIsExecutingOperation(false);
    }
  };

  const quickOperations = selectedServer ? [
    {
      label: 'Change Password',
      icon: Key,
      query: `Change password for SQL server '${selectedServer.name}' in resource group '${selectedServer.resourceGroup}' to 'NewSecureP@ssw0rd2025!'`
    },
    {
      label: 'Add My IP to Firewall',
      icon: Plus,
      query: `Add my current public IP to firewall rules for SQL server '${selectedServer.name}' in resource group '${selectedServer.resourceGroup}'`
    },
    {
      label: 'List Firewall Rules',
      icon: Shield,
      query: `List all firewall rules for SQL server '${selectedServer.name}' in resource group '${selectedServer.resourceGroup}'`
    },
    {
      label: 'Create Database',
      icon: Database,
      query: `Create a new database named 'myNewDatabase' on SQL server '${selectedServer.name}' in resource group '${selectedServer.resourceGroup}'`
    }
  ] : [];

  const quickSuggestions = isConnected && databaseSchema ? [
    {
      icon: Table,
      label: 'Show All Data',
      query: `Show me all data from the ${databaseSchema.tables[0]?.table} table`
    },
    {
      icon: Search,
      label: 'Count Records',
      query: `How many records are in each table?`
    },
    {
      icon: Code,
      label: 'Find Relationships',
      query: `Show me the relationships between tables in this database`
    },
    {
      icon: Zap,
      label: 'Optimize Query',
      query: `Suggest indexes to improve query performance`
    }
  ] : [
    {
      icon: Database,
      label: 'Connect to DB',
      query: 'I need to connect to my database first'
    },
    {
      icon: Book,
      label: 'SQL Help',
      query: 'Help me write a SELECT query'
    },
    {
      icon: Info,
      label: 'Best Practices',
      query: 'What are SQL best practices?'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-full mx-auto px-4 py-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600" />
          SQL Developer AI Assistant
        </h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </div>

      <div className="lg:grid lg:grid-cols-5 gap-4">
        {/* Left Panel - Database Connection (40%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Server Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-5 border border-gray-200"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              SQL Server
            </h2>
            <select
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              value={selectedServer ? selectedServer.id : ''}
              onChange={(e) => {
                setSelectedServer(sqlServers.find(s => s.id === e.target.value));
                setSelectedDatabase(null);
                setDatabaseSchema(null);
                setIsConnected(false);
              }}
            >
              {sqlServers.length === 0 && <option value="">No SQL Servers Found</option>}
              {sqlServers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.resourceGroup})
                </option>
              ))}
            </select>
          </motion.div>

          {/* Database Selection */}
          {selectedServer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="bg-white rounded-2xl shadow-lg p-5 border border-gray-200"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Database
              </h2>
              <select
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all mb-4"
                value={selectedDatabase ? selectedDatabase.id : ''}
                onChange={(e) => {
                  setSelectedDatabase(databases.find(db => db.id === e.target.value));
                  setIsConnected(false);
                  setDatabaseSchema(null);
                }}
              >
                <option value="">Select a database...</option>
                {databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name} ({db.status})
                  </option>
                ))}
              </select>

              {selectedDatabase && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={dbUsername}
                      onChange={(e) => setDbUsername(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="sqladmin"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none pr-12"
                        placeholder="Enter password"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConnectToDatabase}
                    disabled={!dbPassword || isConnected}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Connected
                      </>
                    ) : (
                      <>
                        <Database className="w-5 h-5" />
                        Analyze Schema
                      </>
                    )}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* Schema Display */}
          {isConnected && databaseSchema && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-5 border border-gray-200"
            >
              <div 
                className="flex items-center justify-between mb-3 cursor-pointer"
                onClick={() => setShowSchemaDetails(!showSchemaDetails)}
              >
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Table className="w-5 h-5 text-purple-600" />
                  Database Schema ({databaseSchema.tableCount} tables)
                </h2>
                {showSchemaDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
              
              <AnimatePresence>
                {showSchemaDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 max-h-96 overflow-y-auto"
                  >
                    {databaseSchema.tables.map((table, index) => (
                      <div 
                        key={index}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedTable === table ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => setSelectedTable(selectedTable === table ? null : table)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-800">
                            {table.schema}.{table.table}
                          </p>
                          <span className="text-xs text-gray-500">{table.columns.length} cols</span>
                        </div>
                        <AnimatePresence>
                          {selectedTable === table && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 pt-2 border-t border-gray-200"
                            >
                              <div className="text-xs space-y-1">
                                {table.columns.map((col, colIndex) => (
                                  <div key={colIndex} className="flex items-center gap-2">
                                    {col.primaryKey && <Key className="w-3 h-3 text-yellow-500" />}
                                    <span className="font-medium">{col.name}</span>
                                    <span className="text-gray-500">
                                      {col.dataType}{col.maxLength ? `(${col.maxLength})` : ''}
                                    </span>
                                    {col.nullable && <span className="text-gray-400">NULL</span>}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Connection Status */}
          {!isConnected && selectedDatabase && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900">Not Connected</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Enter your database password and click "Analyze Schema" to enable AI-powered SQL assistance with full schema context.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Panel - Tabbed Interface (60%) */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl shadow-lg border border-gray-200 sticky top-4" style={{ height: 'calc(100vh - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}>
          {/* Tab Header */}
          <div className="p-5 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900 truncate">SQL Assistant</h2>
                  <p className="text-sm text-gray-600 truncate">
                    {selectedServer ? `Server: ${selectedServer.name}` : 'Select a server to begin'}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {isConnected ? 'Schema Loaded' : activeTab === 'operations' ? 'Operations' : 'General Mode'}
              </span>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('chat')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'chat'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Developer Chat
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('operations')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'operations'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Operations
                </div>
              </motion.button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'chat' ? (
            /* Developer Chat Tab */
            <>

          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: 0 }}>
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-semibold mb-2">SQL Developer AI Assistant</p>
                <p className="text-sm mb-6">
                  {isConnected 
                    ? `I know your database schema! Ask me anything about your ${databaseSchema?.tableCount} tables.`
                    : 'Connect to a database to get schema-aware SQL assistance, or ask general SQL questions.'}
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                  {quickSuggestions.map((suggestion, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setChatInput(suggestion.query)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                    >
                      <suggestion.icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">{suggestion.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg shadow-md ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        code: ({node, inline, className, children, ...props}) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          
                          if (!inline && match && match[1] === 'sql') {
                            return (
                              <div className="relative">
                                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-sm">
                                  <code {...props}>{children}</code>
                                </pre>
                                <div className="flex gap-2 mt-2">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      navigator.clipboard.writeText(codeString);
                                      toast.success('Query copied!');
                                    }}
                                    className="flex items-center gap-1 px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </motion.button>
                                  {isConnected && (
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleExecuteQuery(codeString)}
                                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    >
                                      <Play className="w-3 h-3" />
                                      Execute
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          
                          return !inline ? (
                            <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-sm">
                              <code {...props}>{children}</code>
                            </pre>
                          ) : (
                            <code className="bg-gray-200 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))
            )}
            {isChatting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-100 text-gray-800 p-4 rounded-lg rounded-bl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-5 border-t border-gray-200 flex-shrink-0">
            <form onSubmit={handleChatSubmit} className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  }
                }}
                placeholder={isChatting ? "AI is thinking..." : isConnected ? "Ask about your database schema, request SQL queries, or get help..." : "Ask SQL questions or connect to a database for schema-aware assistance..."}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                rows={2}
                disabled={isChatting}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 bg-blue-500 text-white rounded-xl shadow-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                disabled={isChatting || !chatInput.trim()}
              >
                {isChatting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              </motion.button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              💡 Tip: Press Enter to send, Shift+Enter for new line
            </p>
          </div>
            </>
          ) : (
            /* Operations Tab */
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: 0 }}>
                {/* Quick Operations */}
                {selectedServer && (
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
                )}

                {/* Operation Query Input */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-600" />
                    Operation Request
                  </h3>
                  <textarea
                    value={operationQuery}
                    onChange={(e) => setOperationQuery(e.target.value)}
                    placeholder="E.g., Change password for SQL server 'myserver' to 'NewPassword123!' or Add my IP to firewall rules"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none transition-all"
                    rows={3}
                  />
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerateOperationScript}
                    disabled={isGenerating || !operationQuery.trim()}
                    className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
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
                </div>

                {/* Generated Script Display */}
                {generatedScript && (
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
                          navigator.clipboard.writeText(generatedScript);
                          toast.success('Script copied to clipboard!');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                    </div>
                    
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto text-sm font-mono max-h-64">
                      {generatedScript}
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
                {executionOutput.length > 0 && (
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
                        {executionOutput.length} lines
                      </span>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-y-auto text-sm font-mono" style={{ maxHeight: '400px' }}>
                      {executionOutput.map((output, index) => (
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
                    {!isExecutingOperation && executionOutput.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 text-right">
                        Execution finished at {new Date().toLocaleTimeString()}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Info Box */}
                {!selectedServer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">Select a SQL Server</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Choose a SQL Server from the left panel to access operations like password changes, firewall rules, and database management.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Features List */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Available Operations:</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Change SQL Server admin password
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Add/remove firewall rules
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Create/delete databases
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Update database SKU/tier
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Configure backup and auditing
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SQLOperationsAssistant;
