### Azure sql server database service plan and webapp has been created but webapp content is not copied

Script - 

```bash
#!/bin/bash

# Variables
SOURCE_RG="hello-world-nextjs-rg"
TARGET_RG="sunny-rk-kush"
LOCATION="centralindia"  # Recommended region with available quota

# Extract resource names from validated configuration
SOURCE_WEBAPP_NAME="hello-world-static-1763324087"
TARGET_WEBAPP_NAME="hello-world-static-481215"
SOURCE_SQL_SERVER="sqlserver-1236"
TARGET_SQL_SERVER="sqlserver-481215"
SOURCE_DB_NAME="sqldb-6179"
TARGET_DB_NAME="sqldb-6179-clone"

# Verify Azure CLI authentication
echo "Verifying Azure CLI authentication..."
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: Azure CLI is not authenticated"
  echo "Please run: az login"
  exit 1
fi
echo "✅ Azure CLI authenticated successfully"

# Create target resource group
echo "Creating target resource group: $TARGET_RG in $LOCATION..."
if ! az group create --name "$TARGET_RG" --location "$LOCATION" >/dev/null 2>&1; then
  echo "ERROR: Failed to create resource group $TARGET_RG"
  exit 1
fi
echo "✅ Resource group $TARGET_RG created successfully"

# Clone App Service Plan
PLAN_NAME="appservice-plan-$RANDOM"
echo "Creating App Service Plan: $PLAN_NAME..."
if az appservice plan create --name "$PLAN_NAME" --resource-group "$TARGET_RG" --location "$LOCATION" --sku B1 >/dev/null 2>&1; then
  echo "✅ App Service Plan $PLAN_NAME created successfully"
else
  echo "ERROR: Failed to create App Service Plan $PLAN_NAME"
  exit 1
fi

# Clone Web App
echo "Creating Web App: $TARGET_WEBAPP_NAME..."
if az webapp create --name "$TARGET_WEBAPP_NAME" --resource-group "$TARGET_RG" --plan "$PLAN_NAME" >/dev/null 2>&1; then
  echo "✅ Web App $TARGET_WEBAPP_NAME created successfully"
else
  echo "ERROR: Failed to create Web App $TARGET_WEBAPP_NAME"
  exit 1
fi

# Clone SQL Server
echo "Creating SQL Server: $TARGET_SQL_SERVER..."
SQL_ADMIN_USER="sqladmin"
SQL_ADMIN_PASSWORD="P@ssw0rd$RANDOM"
if az sql server create --name "$TARGET_SQL_SERVER" --resource-group "$TARGET_RG" --location "$LOCATION" --admin-user "$SQL_ADMIN_USER" --admin-password "$SQL_ADMIN_PASSWORD" >/dev/null 2>&1; then
  echo "✅ SQL Server $TARGET_SQL_SERVER created successfully"
else
  echo "ERROR: Failed to create SQL Server $TARGET_SQL_SERVER"
  exit 1
fi

# Configure SQL Server firewall
echo "Configuring firewall for SQL Server: $TARGET_SQL_SERVER..."
if az sql server firewall-rule create --resource-group "$TARGET_RG" --server "$TARGET_SQL_SERVER" --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 >/dev/null 2>&1; then
  echo "✅ Firewall rule AllowAzureServices configured successfully"
else
  echo "ERROR: Failed to configure firewall rule for SQL Server $TARGET_SQL_SERVER"
  exit 1
fi

# Clone SQL Database
echo "Cloning SQL Database: $SOURCE_DB_NAME to $TARGET_DB_NAME..."
if az sql db copy --dest-name "$TARGET_DB_NAME" --dest-resource-group "$TARGET_RG" --dest-server "$TARGET_SQL_SERVER" --name "$SOURCE_DB_NAME" --resource-group "$SOURCE_RG" --server "$SOURCE_SQL_SERVER" >/dev/null 2>&1; then
  echo "✅ SQL Database $TARGET_DB_NAME cloned successfully"
else
  echo "ERROR: Failed to clone SQL Database $SOURCE_DB_NAME"
  exit 1
fi

echo "All resources cloned successfully."
```

================================================

Second RUN - 

#!/bin/bash

# Variables

# SQL SERVER NAME VALIDATION (Auto-added for safety)
# Strip .database.windows.net suffix if present in any SQL_SERVER* variables
for var in ${!SQL*SERVER*}; do
  if [[ "${!var}" == *.database.windows.net ]]; then
    echo "⚠️  WARNING: Variable $var contains .database.windows.net suffix"
    echo "   Current value: ${!var}"
    # Use parameter expansion to strip suffix
    new_value="${!var%.database.windows.net}"
    eval "$var="$new_value""
    echo "   Fixed value: ${!var}"
  fi
done


SOURCE_RG="hello-world-nextjs-rg"
TARGET_RG="sunny-rakesh-kushw"
LOCATION="centralindia"  # Recommended region with available quota

# Resource names from validated configuration
SOURCE_WEBAPP_NAME="hello-world-static-1763324087"
TARGET_WEBAPP_NAME="hello-world-static-236988"
SOURCE_SQL_SERVER="sqlserver-1236"
TARGET_SQL_SERVER="sqlserver-236988"
SOURCE_DB_NAME="sqldb-6179"
TARGET_DB_NAME="sqldb-236988"

# Verify Azure CLI authentication
echo "Verifying Azure CLI authentication..."
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: Azure CLI is not authenticated"
  echo "Please run: az login"
  exit 1
fi
echo "✅ Azure CLI authenticated successfully"

# Create target resource group
echo "Creating target resource group: $TARGET_RG in $LOCATION..."
if ! az group create --name "$TARGET_RG" --location "$LOCATION" >/dev/null 2>&1; then
  echo "ERROR: Failed to create resource group $TARGET_RG"
  exit 1
fi
echo "✅ Resource group created successfully"

# Create App Service Plan
PLAN_NAME="appservice-plan-$RANDOM"
echo "Creating App Service Plan: $PLAN_NAME..."
if ! az appservice plan create --name "$PLAN_NAME" --resource-group "$TARGET_RG" --location "$LOCATION" --sku B1 >/dev/null 2>&1; then
  echo "ERROR: Failed to create App Service Plan $PLAN_NAME"
  exit 1
fi
echo "✅ App Service Plan created successfully"

# Create Web App
echo "Creating Web App: $TARGET_WEBAPP_NAME..."
if ! az webapp create --name $TARGET_WEBAPP_NAME --resource-group $TARGET_RG --plan $PLAN_NAME >/dev/null 2>&1; then
  echo "ERROR: Failed to create Web App $TARGET_WEBAPP_NAME"
  exit 1
fi
echo "✅ Web App created successfully"

# Enable Basic Auth for SCM
echo "Enabling Basic Auth for SCM on source web app..."
if ! az resource update --resource-group "$SOURCE_RG" --name scm --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies --parent sites/$SOURCE_WEBAPP_NAME --set properties.allow=true >/dev/null 2>&1; then
  echo "ERROR: Failed to enable Basic Auth for SCM"
  exit 1
fi
echo "✅ Basic Auth enabled successfully"

# Get deployment credentials
echo "Fetching deployment credentials for source web app..."
CREDS=$(az webapp deployment list-publishing-profiles --name "$SOURCE_WEBAPP_NAME" --resource-group "$SOURCE_RG" --query "[?publishMethod=='MSDeploy'].{user:userName,pwd:userPWD}" -o json 2>/dev/null)
PUBLISH_USER=$(echo "$CREDS" | jq -r '.[0].user')
PUBLISH_PWD=$(echo "$CREDS" | jq -r '.[0].pwd')
if [[ -z "$PUBLISH_USER" || -z "$PUBLISH_PWD" ]]; then
  echo "ERROR: Failed to fetch deployment credentials"
  exit 1
fi
echo "✅ Deployment credentials fetched successfully"

# Download content from source web app
echo "Downloading content from source web app..."
mkdir -p clone-content
HTTP_CODE=$(curl -s -o clone-content/source.zip -w "%{http_code}" -u "$PUBLISH_USER:$PUBLISH_PWD" "https://$SOURCE_WEBAPP_NAME.scm.azurewebsites.net/api/zip/site/wwwroot/")
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Failed to download content from source web app"
  exit 1
fi
echo "✅ Content downloaded successfully"

# Extract and repackage content
echo "Extracting and repackaging content..."
cd clone-content
unzip -q source.zip
rm source.zip
zip -r -q ../deploy.zip .
cd ..
echo "✅ Content repackaged successfully"

# Deploy content to target web app
echo "Deploying content to target web app..."
if ! az webapp deployment source config-zip --resource-group "$TARGET_RG" --name "$TARGET_WEBAPP_NAME" --src deploy.zip >/dev/null 2>&1; then
  echo "ERROR: Failed to deploy content to target web app"
  exit 1
fi
echo "✅ Content deployed successfully"

# Restart target web app
echo "Restarting target web app..."
if ! az webapp restart --name "$TARGET_WEBAPP_NAME" --resource-group "$TARGET_RG" >/dev/null 2>&1; then
  echo "ERROR: Failed to restart target web app"
  exit 1
fi
echo "✅ Target web app restarted successfully"

# Create SQL Server
echo "Creating SQL Server: $TARGET_SQL_SERVER..."
if ! az sql server create --name "$TARGET_SQL_SERVER" --resource-group "$TARGET_RG" --location "$LOCATION" --admin-user sqladmin --admin-password "P@ssw0rd1234" >/dev/null 2>&1; then
  echo "ERROR: Failed to create SQL Server $TARGET_SQL_SERVER"
  exit 1
fi
echo "✅ SQL Server created successfully"

# Configure firewall for SQL Server
echo "Configuring firewall for SQL Server..."
if ! az sql server firewall-rule create --resource-group "$TARGET_RG" --server "$TARGET_SQL_SERVER" --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 >/dev/null 2>&1; then
  echo "ERROR: Failed to configure firewall for SQL Server"
  exit 1
fi
echo "✅ Firewall configured successfully"

# Copy SQL Database
echo "Copying SQL Database: $SOURCE_DB_NAME to $TARGET_DB_NAME..."
if ! az sql db copy --dest-name "$TARGET_DB_NAME" --dest-resource-group "$TARGET_RG" --dest-server "$TARGET_SQL_SERVER" --name "$SOURCE_DB_NAME" --resource-group "$SOURCE_RG" --server "$SOURCE_SQL_SERVER" >/dev/null 2>&1; then
  echo "ERROR: Failed to copy SQL Database"
  exit 1
fi
echo "✅ SQL Database copied successfully"

echo "All resources cloned successfully."
📤 Execution Output (27 lines)
Verifying Azure CLI authentication...
✅ Azure CLI authenticated successfully
Creating target resource group: sunny-rakesh-kushw in centralindia...
✅ Resource group created successfully
Creating App Service Plan: appservice-plan-21662...
✅ App Service Plan created successfully
Creating Web App: hello-world-static-236988...
✅ Web App created successfully
Enabling Basic Auth for SCM on source web app...
✅ Basic Auth enabled successfully
Fetching deployment credentials for source web app...
✅ Deployment credentials fetched successfully
Downloading content from source web app...
✅ Content downloaded successfully
Extracting and repackaging content...
✅ Content repackaged successfully
Deploying content to target web app...
✅ Content deployed successfully
Restarting target web app...
✅ Target web app restarted successfully
Creating SQL Server: sqlserver-236988...
✅ SQL Server created successfully
Configuring firewall for SQL Server...
✅ Firewall configured successfully
Copying SQL Database: sqldb-6179 to sqldb-236988...
✅ SQL Database copied successfully
All resources cloned successfully.

====================================================

Thrid RUN - When i just add two new service for open AI in same resource group for cloning this time i got the error in the Database copy and webapp content deployment issue i dont know why this is appearing the issue even above second RUN execute successfully with all the Database migration and webapp content migration as well

#!/bin/bash

# Variables

# SQL SERVER NAME VALIDATION (Auto-added for safety)
# Strip .database.windows.net suffix if present in any SQL_SERVER* variables
for var in ${!SQL*SERVER*}; do
  if [[ "${!var}" == *.database.windows.net ]]; then
    echo "⚠️  WARNING: Variable $var contains .database.windows.net suffix"
    echo "   Current value: ${!var}"
    # Use parameter expansion to strip suffix
    new_value="${!var%.database.windows.net}"
    eval "$var="$new_value""
    echo "   Fixed value: ${!var}"
  fi
done


SOURCE_RG="hello-world-nextjs-rg"
TARGET_RG="sunny-rakesh-clone"
LOCATION="centralus"

# Validated resource names
HELLO_WORLD_STATIC_1763324087="hello-world-static-1763324087-134759"
SQLSERVER_1236="sqlserver-1236-134759"
SQLSERVER_1236_SQLDB_6179="sqlserver-1236-134759/sqldb-6179"
SQLSERVER_1236_MASTER="sqlserver-1236-134759/master"
WEBAISEARCH="webaisearch-134759"
WEBAISEARCH_FIRSTPROJECT="webaisearch-134759/firstProject"

# Ensure Azure CLI is authenticated
echo "Verifying Azure CLI authentication..."
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: Azure CLI is not authenticated"
  echo "Please run: az login"
  exit 1
fi
echo "✅ Azure CLI authenticated successfully"

# Create target resource group
echo "Creating target resource group..."
if ! az group create --name "$TARGET_RG" --location "$LOCATION" >/dev/null 2>&1; then
  echo "ERROR: Failed to create resource group $TARGET_RG in $LOCATION"
  exit 1
fi
echo "✅ Target resource group created: $TARGET_RG"

# Clone App Service Plan and Web App
APP_PLAN_NAME="app-plan-$RANDOM"
echo "Creating App Service Plan: $APP_PLAN_NAME..."
if az appservice plan create --name "$APP_PLAN_NAME" --resource-group "$TARGET_RG" --location "$LOCATION" --sku B1 >/dev/null 2>&1; then
  echo "✅ App Service Plan created successfully: $APP_PLAN_NAME"
else
  echo "ERROR: Failed to create App Service Plan $APP_PLAN_NAME"
  exit 1
fi

TARGET_WEBAPP_NAME="$HELLO_WORLD_STATIC_1763324087"
echo "Creating Web App: $TARGET_WEBAPP_NAME..."
if az webapp create --name $TARGET_WEBAPP_NAME --resource-group $TARGET_RG --plan $APP_PLAN_NAME >/dev/null 2>&1; then
  echo "✅ Web App created successfully: $TARGET_WEBAPP_NAME"
else
  echo "ERROR: Failed to create Web App $TARGET_WEBAPP_NAME"
  exit 1
fi

# Clone SQL Server and Databases
SQL_ADMIN_USER="sqladmin"
SQL_ADMIN_PASSWORD="P@ssw0rd$RANDOM"
echo "Creating SQL Server: $SQLSERVER_1236..."
if az sql server create --name "$SQLSERVER_1236" --resource-group "$TARGET_RG" --location "$LOCATION" --admin-user "$SQL_ADMIN_USER" --admin-password "$SQL_ADMIN_PASSWORD" >/dev/null 2>&1; then
  echo "✅ SQL Server created successfully: $SQLSERVER_1236"
else
  echo "ERROR: Failed to create SQL Server $SQLSERVER_1236"
  exit 1
fi

echo "Creating firewall rule for SQL Server..."
if az sql server firewall-rule create --resource-group "$TARGET_RG" --server "$SQLSERVER_1236" --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 >/dev/null 2>&1; then
  echo "✅ Firewall rule created for SQL Server: AllowAzureServices"
else
  echo "ERROR: Failed to create firewall rule for SQL Server"
  exit 1
fi

echo "Copying database: $SQLSERVER_1236_SQLDB_6179..."
if az sql db copy --dest-name "$SQLSERVER_1236_SQLDB_6179" --dest-resource-group "$TARGET_RG" --dest-server "$SQLSERVER_1236" --name "sqldb-6179" --resource-group "$SOURCE_RG" --server "sqlserver-1236" >/dev/null 2>&1; then
  echo "✅ Database copied successfully: $SQLSERVER_1236_SQLDB_6179"
else
  echo "ERROR: Failed to copy database $SQLSERVER_1236_SQLDB_6179"
fi

echo "Copying database: $SQLSERVER_1236_MASTER..."
if az sql db copy --dest-name "$SQLSERVER_1236_MASTER" --dest-resource-group "$TARGET_RG" --dest-server "$SQLSERVER_1236" --name "master" --resource-group "$SOURCE_RG" --server "sqlserver-1236" >/dev/null 2>&1; then
  echo "✅ Database copied successfully: $SQLSERVER_1236_MASTER"
else
  echo "ERROR: Failed to copy database $SQLSERVER_1236_MASTER"
fi

# Clone Cognitive Services Account
echo "Creating Cognitive Services Account: $WEBAISEARCH..."
if az cognitiveservices account create --name "$WEBAISEARCH" --resource-group "$TARGET_RG" --location "$LOCATION" --sku S0 --kind "AIServices" >/dev/null 2>&1; then
  echo "✅ Cognitive Services Account created successfully: $WEBAISEARCH"
else
  echo "ERROR: Failed to create Cognitive Services Account $WEBAISEARCH"
  exit 1
fi

echo "Creating Cognitive Services Project: $WEBAISEARCH_FIRSTPROJECT..."
if az cognitiveservices account project create --account-name "$WEBAISEARCH" --resource-group "$TARGET_RG" --project-name "firstProject" >/dev/null 2>&1; then
  echo "✅ Cognitive Services Project created successfully: $WEBAISEARCH_FIRSTPROJECT"
else
  echo "ERROR: Failed to create Cognitive Services Project $WEBAISEARCH_FIRSTPROJECT"
  exit 1
fi

echo "All resources cloned successfully."
📤 Execution Output (20 lines)
Verifying Azure CLI authentication...
✅ Azure CLI authenticated successfully
Creating target resource group...
✅ Target resource group created: sunny-rakesh-clone
Creating App Service Plan: app-plan-27931...
✅ App Service Plan created successfully: app-plan-27931
Creating Web App: hello-world-static-1763324087-134759...
✅ Web App created successfully: hello-world-static-1763324087-134759
Creating SQL Server: sqlserver-1236-134759...
✅ SQL Server created successfully: sqlserver-1236-134759
Creating firewall rule for SQL Server...
✅ Firewall rule created for SQL Server: AllowAzureServices
Copying database: sqlserver-1236-134759/sqldb-6179...
ERROR: Failed to copy database sqlserver-1236-134759/sqldb-6179
Copying database: sqlserver-1236-134759/master..
ERROR: Failed to copy database sqlserver-1236-134759/master
Creating Cognitive Services Account: webaisearch-134759...
✅ Cognitive Services Account created successfully: webaisearch-134759
Creating Cognitive Services Project: webaisearch-134759/firstProject...
ERROR: Failed to create Cognitive Services Project webaisearch-134759/firstProject

=====================================================
