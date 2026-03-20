const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService'); // Already an instance
const executionService = require('../services/executionService'); // Already an instance
const AzureService = require('../services/azureService');
const { spawn } = require('child_process');

const azureService = new AzureService();

/**
 * Execute SQL query on a database
 * Helper function to run SQL queries via sqlcmd or Azure CLI
 */
async function executeSQLQuery(server, database, resourceGroup, query, username, password) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Executing SQL query on ${database}@${server}...`);
    
    // Use sqlcmd if available, otherwise return instructions
    const sqlcmd = spawn('sqlcmd', [
      '-S', `${server}.database.windows.net`,
      '-d', database,
      '-U', username,
      '-P', password,
      '-Q', query,
      '-h', '-1', // No headers
      '-s', '|',  // Column separator
      '-W'        // Remove trailing spaces
    ]);

    let output = '';
    let errorOutput = '';

    sqlcmd.stdout.on('data', (data) => {
      output += data.toString();
    });

    sqlcmd.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    sqlcmd.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: output.trim() });
      } else {
        resolve({ 
          success: false, 
          error: errorOutput || 'Query execution failed',
          sqlcmdNotInstalled: errorOutput.includes('command not found') || errorOutput.includes('ENOENT')
        });
      }
    });

    sqlcmd.on('error', (error) => {
      if (error.code === 'ENOENT') {
        resolve({
          success: false,
          sqlcmdNotInstalled: true,
          error: 'sqlcmd not installed. Install SQL Server command line tools or use Azure Portal.'
        });
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Get list of SQL servers across all resource groups
 */
router.get('/sql-servers', async (req, res) => {
  try {
    console.log('🗄️ Fetching SQL servers...');
    
    // Initialize Azure service if needed
    if (!azureService.isInitialized) {
      await azureService.initialize();
    }

    // Get all resources and filter SQL servers
    const resources = await azureService.makeAzureRequest(
      `/subscriptions/${azureService.subscriptionId}/resources`,
      { 'api-version': '2021-04-01' }
    );

    const sqlServers = resources.value.filter(r => 
      r.type === 'Microsoft.Sql/servers'
    ).map(server => ({
      id: server.id,
      name: server.name,
      resourceGroup: server.id.split('/')[4],
      location: server.location,
      type: server.type
    }));

    console.log(`✅ Found ${sqlServers.length} SQL servers`);

    res.json({
      success: true,
      data: sqlServers
    });
  } catch (error) {
    console.error('❌ Failed to fetch SQL servers:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get databases for a specific SQL server
 */
router.get('/sql-servers/:resourceGroup/:serverName/databases', async (req, res) => {
  try {
    const { resourceGroup, serverName } = req.params;
    console.log(`🗄️ Fetching databases for SQL server: ${serverName}`);
    
    if (!azureService.isInitialized) {
      await azureService.initialize();
    }

    const databases = await azureService.makeAzureRequest(
      `/subscriptions/${azureService.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Sql/servers/${serverName}/databases`,
      { 'api-version': '2021-11-01' }
    );

    res.json({
      success: true,
      data: databases.value || []
    });
  } catch (error) {
    console.error('❌ Failed to fetch databases:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate Azure CLI script based on user query using AI
 */
router.post('/generate-script', async (req, res) => {
  try {
    const { query, context } = req.body;
    
    console.log(`🤖 Generating SQL operation script for query: "${query}"`);
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // Create system prompt for SQL operations
    const systemPrompt = `You are an expert Azure SQL Database administrator and Azure CLI specialist.

Your task is to generate EXECUTABLE Azure CLI scripts for SQL/Database operations based on user queries.

CRITICAL RULES:
1. Output ONLY executable bash/Azure CLI commands
2. NO explanations, NO markdown fences, NO prose
3. Start immediately with commands (e.g., "az sql server...")
4. Use proper error handling with "if" statements
5. Echo status messages for user visibility
6. Use variables for reusability
7. Include verification steps after operations
8. Handle edge cases gracefully

SUPPORTED OPERATIONS:
- Update SQL server admin password
- Add/remove firewall rules
- Create/delete databases
- Update database SKU/tier
- Configure backup retention
- Enable/disable auditing
- Manage elastic pools
- Any other SQL-related Azure CLI operations

OUTPUT FORMAT:
- Pure executable bash script
- No markdown code fences
- No "Here is the script:" or similar prose
- Start with variable definitions if needed
- Echo commands for visibility (echo "Updating password...")
- Use proper exit codes

CRITICAL PASSWORD HANDLING:
- ALWAYS wrap passwords in double quotes: "$NEW_PASSWORD"
- PRESERVE special characters EXACTLY as provided (@, #, $, !, %, etc.)
- Multi-line commands with backslash continuations are FULLY SUPPORTED
- Example password: NitorDB@#$2025! should be used AS-IS

EXAMPLE INPUT: "Change password for SQL server myserver in resource group myrg to NitorDB@#$2025!"

EXAMPLE OUTPUT (what you should generate):
#!/bin/bash
set -e

RESOURCE_GROUP="myrg"
SQL_SERVER="myserver"
NEW_PASSWORD="NitorDB@#$2025!"

echo "Updating admin password for SQL server $SQL_SERVER in resource group $RESOURCE_GROUP..."
az sql server update \\
  --name "$SQL_SERVER" \\
  --resource-group "$RESOURCE_GROUP" \\
  --admin-password "$NEW_PASSWORD"

if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS: Admin password updated for SQL server $SQL_SERVER"
  echo ""
  az sql server show --name "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --query "{fqdn:fullyQualifiedDomainName, name:name, state:state}"
else
  echo "ERROR: Failed to update password"
  exit 1
fi

REMEMBER: 
- Output ONLY the executable script, no other text!
- Use the EXACT password provided by the user
- Wrap passwords in double quotes for safety`;

    // Generate script using AI
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Generate an Azure CLI script for this request:\n\n${query}\n\n${context ? `Context:\n${JSON.stringify(context, null, 2)}` : ''}`
      }
    ];

    const aiResponse = await aiAgentService.chat(messages);

    // Extract the message from AI response (chat returns {message, usage})
    let script = aiResponse?.message || aiResponse;
    
    // Ensure script is a string
    if (typeof script !== 'string') {
      console.error('❌ AI returned non-string response:', typeof script, script);
      throw new Error('AI returned invalid response type');
    }

    // Clean the script - remove markdown code blocks if present
    script = script.trim();
    script = script.replace(/^```(?:bash|sh|shell)?\n/gm, '');
    script = script.replace(/\n```$/gm, '');
    script = script.trim();

    console.log(`✅ Generated script (${script.length} chars)`);
    console.log(`📝 Script preview: ${script.substring(0, 100)}...`);

    if (!script || script.length === 0) {
      throw new Error('AI generated empty script');
    }

    res.json({
      success: true,
      data: {
        script: script,
        query: query,
        context: context
      }
    });
  } catch (error) {
    console.error('❌ Failed to generate script:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate script'
    });
  }
});

/**
 * Execute generated Azure CLI script
 */
router.post('/execute-script', async (req, res) => {
  try {
    const { script, description } = req.body;
    
    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Script is required'
      });
    }

    console.log(`🚀 Executing SQL operation script: ${description || 'SQL Operation'}`);

    // Execute using the execution service
    const sessionId = `sql_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const execution = await executionService.executeAzureCLI(
      sessionId,
      script,
      description || 'SQL Database Operation'
    );

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        execution: execution
      }
    });
  } catch (error) {
    console.error('❌ Failed to execute script:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Get execution status
 */
router.get('/execution/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const execution = executionService.getExecution(sessionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    console.error('❌ Failed to get execution status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get firewall rules for a SQL server
 */
router.get('/sql-servers/:resourceGroup/:serverName/firewall-rules', async (req, res) => {
  try {
    const { resourceGroup, serverName } = req.params;
    console.log(`🔥 Fetching firewall rules for: ${serverName}`);
    
    if (!azureService.isInitialized) {
      await azureService.initialize();
    }

    const rules = await azureService.makeAzureRequest(
      `/subscriptions/${azureService.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Sql/servers/${serverName}/firewallRules`,
      { 'api-version': '2021-11-01' }
    );

    res.json({
      success: true,
      data: rules.value || []
    });
  } catch (error) {
    console.error('❌ Failed to fetch firewall rules:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * AI Chat endpoint for SQL operations guidance
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log(`💬 SQL Operations chat with ${messages.length} messages`);

    // Add system message for SQL operations context
    const systemMessage = {
      role: 'system',
      content: `You are an expert Azure SQL Database administrator. Help users with:
- Changing SQL server passwords
- Managing firewall rules
- Creating/managing databases
- Configuring security settings
- Optimizing database performance
- Troubleshooting issues

Always provide clear, actionable advice and Azure CLI commands when relevant.
${context ? `\n\nCurrent context:\n${JSON.stringify(context, null, 2)}` : ''}`
    };

    const fullMessages = [systemMessage, ...messages];
    const aiResponse = await aiAgentService.chat(fullMessages);
    
    // Extract message from AI response (chat returns {message, usage})
    const responseText = aiResponse?.message || aiResponse;

    res.json({
      success: true,
      data: {
        response: responseText,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Chat failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get database schema (tables, columns, data types)
 * This is the heart of the SQL Developer AI Assistant
 */
router.post('/database-schema', async (req, res) => {
  try {
    const { server, database, resourceGroup, username, password } = req.body;
    
    if (!server || !database) {
      return res.status(400).json({
        success: false,
        error: 'Server and database names are required'
      });
    }

    console.log(`📊 Fetching schema for database: ${database} on ${server}...`);

    // SQL query to get all tables and their columns
    const schemaQuery = `
      SELECT 
        t.TABLE_SCHEMA as [Schema],
        t.TABLE_NAME as [Table],
        c.COLUMN_NAME as [Column],
        c.DATA_TYPE as [DataType],
        c.CHARACTER_MAXIMUM_LENGTH as [MaxLength],
        c.IS_NULLABLE as [Nullable],
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as [PrimaryKey]
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN INFORMATION_SCHEMA.COLUMNS c 
        ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
        AND c.TABLE_NAME = pk.TABLE_NAME 
        AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
    `;

    // Try to execute the query
    const result = await executeSQLQuery(
      server, 
      database, 
      resourceGroup, 
      schemaQuery, 
      username || 'sqladmin', 
      password
    );

    if (result.success) {
      // Parse the output into structured data
      const lines = result.output.split('\n').filter(line => line.trim());
      const schemaData = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        return {
          schema: parts[0],
          table: parts[1],
          column: parts[2],
          dataType: parts[3],
          maxLength: parts[4],
          nullable: parts[5],
          primaryKey: parts[6]
        };
      });

      // Group by table
      const tableMap = {};
      schemaData.forEach(col => {
        const tableName = `${col.schema}.${col.table}`;
        if (!tableMap[tableName]) {
          tableMap[tableName] = {
            schema: col.schema,
            table: col.table,
            columns: []
          };
        }
        tableMap[tableName].columns.push({
          name: col.column,
          dataType: col.dataType,
          maxLength: col.maxLength,
          nullable: col.nullable === 'YES',
          primaryKey: col.primaryKey === 'YES'
        });
      });

      const tables = Object.values(tableMap);

      console.log(`✅ Retrieved schema for ${tables.length} tables`);

      res.json({
        success: true,
        data: {
          server: server,
          database: database,
          tableCount: tables.length,
          tables: tables
        }
      });
    } else if (result.sqlcmdNotInstalled) {
      // sqlcmd not available, provide alternative
      console.log('⚠️ sqlcmd not installed, returning guidance');
      res.json({
        success: false,
        sqlcmdRequired: true,
        message: 'SQL schema inspection requires sqlcmd to be installed. The AI can still help with SQL queries and guidance.',
        installInstructions: {
          macos: 'brew install sqlcmd',
          windows: 'Download from https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility',
          linux: 'sudo apt-get install mssql-tools'
        }
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Failed to fetch database schema:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Execute SQL query from chat
 */
router.post('/execute-query', async (req, res) => {
  try {
    const { server, database, resourceGroup, query, username, password } = req.body;
    
    if (!server || !database || !query) {
      return res.status(400).json({
        success: false,
        error: 'Server, database, and query are required'
      });
    }

    console.log(`🚀 Executing query on ${database}@${server}...`);
    console.log(`📝 Query: ${query.substring(0, 100)}...`);

    const result = await executeSQLQuery(
      server,
      database,
      resourceGroup,
      query,
      username || 'sqladmin',
      password
    );

    if (result.success) {
      res.json({
        success: true,
        data: {
          output: result.output,
          rowCount: result.output.split('\n').filter(line => line.trim()).length,
          query: query
        }
      });
    } else if (result.sqlcmdNotInstalled) {
      res.json({
        success: false,
        sqlcmdRequired: true,
        message: 'SQL query execution requires sqlcmd. Install it or copy the query to Azure Data Studio/SSMS.',
        query: query,
        installInstructions: {
          macos: 'brew install sqlcmd',
          windows: 'Download from https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility',
          linux: 'sudo apt-get install mssql-tools'
        }
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Query execution failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enhanced AI Chat for SQL Development
 * Context-aware chat with database schema knowledge
 */
router.post('/developer-chat', async (req, res) => {
  try {
    const { messages, schema, server, database } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log(`💬 SQL Developer chat with ${messages.length} messages`);
    console.log(`📊 Schema context: ${schema ? `${schema.tableCount} tables` : 'No schema'}`);

    // Build comprehensive system message with schema context
    let systemPrompt = `You are an expert SQL Server database developer and architect. You help developers with:

🎯 PRIMARY CAPABILITIES:
1. **Schema Analysis** - Understanding database structure, relationships, and design
2. **SQL Query Writing** - Generate optimized SELECT, INSERT, UPDATE, DELETE queries
3. **Query Optimization** - Improve query performance, suggest indexes
4. **Database Design** - Table design, normalization, relationships
5. **Troubleshooting** - Debug errors, connection issues, performance problems
6. **Best Practices** - Security, data integrity, transaction management
7. **Azure SQL Specific** - Azure-specific features, DTU optimization, elastic pools

💡 RESPONSE STYLE:
- Be concise but comprehensive
- Provide working SQL code examples
- Explain complex concepts clearly
- Suggest best practices
- Warn about potential issues
- Offer multiple solutions when applicable

🔍 QUERY GENERATION RULES:
- Always provide syntactically correct SQL Server (T-SQL) queries
- Include comments explaining complex parts
- Use meaningful table/column aliases
- Consider performance implications
- Add WHERE clauses for safety (prevent full table scans)
- Use transactions for data modifications
`;

    if (schema && schema.tables && schema.tables.length > 0) {
      systemPrompt += `\n\n📊 CURRENT DATABASE CONTEXT:
Server: ${server}
Database: ${database}
Total Tables: ${schema.tableCount}

DATABASE SCHEMA:
${schema.tables.map(table => `
Table: ${table.schema}.${table.table}
Columns:
${table.columns.map(col => 
  `  - ${col.name} (${col.dataType}${col.maxLength ? `(${col.maxLength})` : ''}) ${col.nullable ? 'NULL' : 'NOT NULL'}${col.primaryKey ? ' [PK]' : ''}`
).join('\n')}
`).join('\n')}

When generating queries, use these EXACT table and column names from the schema above.
`;
    } else {
      systemPrompt += `\n\n⚠️ No database schema available. You can still help with general SQL queries, but cannot reference specific tables. Suggest the user to provide database credentials for schema analysis.`;
    }

    // Add system message
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Get AI response
    const aiResponse = await aiAgentService.chat(fullMessages);
    const responseText = aiResponse?.message || aiResponse;

    console.log(`✅ Generated response (${responseText.length} chars)`);

    res.json({
      success: true,
      data: {
        response: responseText,
        hasSchema: !!(schema && schema.tables && schema.tables.length > 0),
        schemaTableCount: schema?.tableCount || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Developer chat failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

