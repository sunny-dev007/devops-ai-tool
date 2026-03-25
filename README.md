# 🚀 Azure AI Assistant - Intelligent Azure Resource Management

A comprehensive AI-powered chatbot application that helps you analyze, optimize, and manage your Azure resources with intelligent insights and cost optimization recommendations.

## 🌟 New: Web-Based Environment Switcher

**Switch between Azure environments with an intuitive web interface!** No more command-line scripts or manual `.env` editing.

### Key Features:
- 🎨 **Beautiful Visual Interface** - Modern, responsive UI with real-time progress tracking
- ✅ **Automatic Validation** - Test credentials before switching
- 🔐 **Permission Management** - One-click role assignment
- 📊 **Progress Visibility** - See every step as it happens
- 💾 **Auto Backup** - Your `.env` is automatically backed up
- 🚀 **Quick Switch** - Select from saved environments

📖 **[Read the full Environment Switcher Guide →](./ENVIRONMENT-SWITCHER.md)**

🎬 **[View the Demo Guide →](./DEMO-ENVIRONMENT-SWITCHER.md)**

## ✨ Features

### 🤖 **AI-Powered Intelligence**
- **Azure OpenAI Integration** - GPT-4 powered responses for complex queries
- **Natural Language Processing** - Ask questions in plain English
- **Context-Aware Responses** - AI understands your Azure environment
- **Smart Recommendations** - Get personalized optimization suggestions

### 📊 **Azure Resource Management**
- **Resource Inventory** - Complete overview of all Azure resources
- **Cost Analysis** - Detailed cost breakdowns and trends
- **Performance Monitoring** - Resource metrics and utilization
- **Resource Groups** - Organized resource management

### 💰 **Cost Optimization**
- **Cost Tracking** - Monthly, weekly, and daily cost analysis
- **Trend Analysis** - Visual cost trends and patterns
- **Optimization Tips** - AI-generated cost-saving recommendations
- **Budget Monitoring** - Stay within your budget limits

### 🔍 **Azure Advisor Integration**
- **Security Recommendations** - Improve your security posture
- **Performance Optimization** - Enhance resource performance
- **High Availability** - Ensure business continuity
- **Cost Optimization** - Reduce unnecessary spending

### 💬 **Intelligent Chat Interface**
- **Real-time Chat** - Interactive AI conversations
- **Session Management** - Save and manage chat history
- **Export Functionality** - Download chat sessions
- **Smart Suggestions** - Context-aware question prompts

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Node.js Backend │    │   Azure Cloud   │
│                 │    │                  │    │                 │
│ • Modern UI/UX  │◄──►│ • Express Server │◄──►│ • Resource Graph│
│ • Real-time Chat│    │ • Azure SDKs     │    │ • Cost Mgmt API │
│ • Charts & Data │    │ • OpenAI Client  │    │ • Advisor API   │
│ • Responsive    │    │ • Socket.IO      │    │ • Monitor API   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### **Frontend**
- **React 18** - Modern React with hooks
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations
- **Recharts** - Beautiful data visualizations
- **Lucide React** - Modern icon library

### **Backend**
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **Azure SDKs** - Official Azure client libraries
- **Azure OpenAI** - GPT-4 integration
- **Socket.IO** - Real-time communication

### **Azure Services**
- **Azure Resource Graph** - Resource querying
- **Azure Cost Management** - Cost analysis
- **Azure Advisor** - Optimization recommendations
- **Azure Monitor** - Performance metrics
- **Azure OpenAI** - AI capabilities

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Azure Global Administrator** access
- **Azure OpenAI Service** (GPT-4 deployment)
- **Azure CLI** installed and configured

### 1. Clone and Setup
```bash
git clone <repository-url>
cd Azure-Monitor-AI-Assistant
npm install
cd client && npm install
cd ..
```

### 2. Azure Configuration

#### Create Service Principal
```bash
# Login to Azure
az login

# Create service principal with required permissions
az ad sp create-for-rbac \
  --name "azure-ai-assistant" \
  --role "Reader" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID" \
  --sdk-auth

# IMPORTANT: Also assign Cost Management Reader role
az role assignment create \
  --assignee "YOUR_CLIENT_ID" \
  --role "Cost Management Reader" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

**Or use the automated setup script:**
```bash
./setup-azure.sh
```

#### Enable Required APIs
```bash
# Enable Resource Graph
az provider register --namespace Microsoft.ResourceGraph

# Enable Cost Management
az provider register --namespace Microsoft.CostManagement

# Enable Advisor
az provider register --namespace Microsoft.Advisor
```

#### Create Azure OpenAI Resource
```bash
# Create OpenAI resource
az cognitiveservices account create \
  --name "your-openai-resource" \
  --resource-group "your-rg" \
  --location "eastus" \
  --kind "OpenAI" \
  --sku "S0"

# Deploy GPT-4 model
az cognitiveservices account deployment create \
  --resource-group "your-rg" \
  --account-name "your-openai-resource" \
  --deployment-name "gpt-4" \
  --model-name "gpt-4" \
  --model-version "0613" \
  --model-format "OpenAI"
```

### 3. Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Edit .env with your Azure credentials
nano .env
```

**Required Environment Variables:**
```env
# Azure Configuration
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_SUBSCRIPTION_ID=your_subscription_id

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Application Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 4. Start the Application
```bash
# Start backend server
npm run dev

# In another terminal, start frontend
cd client && npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 📱 Usage Guide

### **Dashboard Overview**
- View key metrics and resource counts
- Monitor cost trends and patterns
- Get AI-generated insights
- Quick access to all features

### **AI Chat Assistant**
- Ask questions about your Azure environment
- Get cost optimization recommendations
- Understand resource utilization
- Receive personalized advice

### **Resource Management**
- Browse all Azure resources
- Filter by type, location, or resource group
- View resource details and metrics
- Monitor performance and health

### **Cost Analysis**
- Track monthly spending
- Analyze cost trends over time
- Identify expensive resources
- Get optimization suggestions

### **Recommendations**
- View Azure Advisor recommendations
- Filter by category and impact
- Implement optimization steps
- Track improvement progress

## 🔧 Configuration Options

### **Azure Permissions**

The service principal needs these roles:
- **Reader** - View all Azure resources (required for dashboard, AI Agent discovery)
- **Cost Management Reader** - View cost and billing data (required for cost analysis)
- **Contributor** - Create and manage resources (required for AI Agent cloning)

#### 🎯 How to Assign Roles

**Option 1: Automated Script** (Recommended)
```bash
./fix-azure-permissions.sh
```

**Option 2: Web-Based Environment Switcher**
1. Navigate to: http://localhost:3000/environment-switcher
2. Enter your credentials and validate
3. Click "Assign Required Permissions" button
4. Watch real-time progress

**Option 3: Manual Assignment via Azure Portal** (Step-by-Step)
📖 **[Complete Manual Guide →](./MANUAL-ROLE-ASSIGNMENT-GUIDE.md)** - Detailed step-by-step with screenshots  
⚡ **[Quick 5-Minute Guide →](./QUICK-ROLE-ASSIGNMENT-STEPS.md)** - Visual quick reference

**Troubleshooting**:
- If you encounter authorization errors (403), see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- If automated script fails, use the manual Azure Portal method
- Wait 5-10 minutes after role assignment for Azure RBAC propagation

### **OpenAI Model Configuration**
- **Model**: GPT-4 or GPT-4o-mini
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 1000 (response length)
- **Deployment**: Custom deployment name

### **Data Refresh Intervals**
- **Subscription Summary**: 5 minutes
- **Resources**: 10 minutes
- **Costs**: 15 minutes
- **Recommendations**: 30 minutes

## 🚀 Deployment

### **Azure App Service**
```bash
# Build the application
npm run build

# Deploy to Azure App Service
az webapp up \
  --name "azure-ai-assistant" \
  --resource-group "your-rg" \
  --runtime "NODE|18-lts"
```

### **Azure Container Instances**
```bash
# Build Docker image
docker build -t azure-ai-assistant .

# Deploy to ACI
az container create \
  --resource-group "your-rg" \
  --name "azure-ai-assistant" \
  --image "azure-ai-assistant:latest" \
  --ports 5000
```

### **Azure Kubernetes Service**
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS Protection** - Cross-origin restrictions
- **Rate Limiting** - API abuse prevention
- **Input Validation** - XSS protection
- **Secure Credentials** - Environment variables

## 📊 Performance Features

- **Data Caching** - React Query integration
- **Lazy Loading** - Component optimization
- **Compression** - Gzip compression
- **Connection Pooling** - Azure SDK optimization
- **Real-time Updates** - Socket.IO integration

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client && npm test

# Run integration tests
npm run test:integration
```

## 📈 Monitoring & Logging

- **Morgan** - HTTP request logging
- **Console Logging** - Structured logging
- **Error Tracking** - Comprehensive error handling
- **Performance Metrics** - Response time monitoring
- **Health Checks** - Service status endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

- **Troubleshooting Guide**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions
- **Permission Issues**: Run `./fix-azure-permissions.sh` to fix authorization errors
- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions
- **Email**: Contact the development team

### Common Issues

1. **Authorization Failed (403)**: Service principal missing required roles
   - **Solution**: Run `./fix-azure-permissions.sh` or see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

2. **Cost Management API 403**: Missing "Cost Management Reader" role
   - **Solution**: `az role assignment create --assignee "$CLIENT_ID" --role "Cost Management Reader" --scope "/subscriptions/$SUBSCRIPTION_ID"`

3. **Different Azure Account Issues**: Roles need to be assigned in each subscription
   - **Solution**: Use the fix script in the correct subscription context

## 🔮 Roadmap

### **Phase 2 Features**
- [ ] Multi-tenant support
- [ ] Advanced cost forecasting
- [ ] Automated optimization actions
- [ ] Integration with FinOps tools
- [ ] Mobile application

### **Phase 3 Features**
- [ ] Machine learning cost predictions
- [ ] Advanced security analysis
- [ ] Compliance reporting
- [ ] API marketplace integration
- [ ] Enterprise SSO

---

## 🎯 Demo Use Cases

### **For IT Administrators**
- "Show me all VMs with low CPU utilization"
- "What are my top 5 most expensive resources?"
- "How can I reduce my monthly Azure costs?"

### **For DevOps Engineers**
- "Which resources are not properly tagged?"
- "Show me performance recommendations for my AKS clusters"
- "What's the cost impact of scaling my app services?"

### **For Business Users**
- "Give me a cost summary for this quarter"
- "What's the forecasted spend for next month?"
- "Which departments are using the most resources?"

---

**Built with ❤️ for the Azure community**


# Amit Azure Configuration ######
ClientID=1f16c4c4-8c61-4083-bda0-b5cd4f847dff
TenantID=a8f047ad-e0cb-4b81-badd-4556c4cd71f4
ClientSecretID=<YOUR_CLIENT_SECRET>
SubscriptionID=5588ec4e-3711-4cd3-a62a-52d031b0a6c8

### My Account Cred for Application
AZURE_TENANT_ID=d4740603-c108-4cbe-9be8-c75289d4da2a
AZURE_CLIENT_ID=699e9e0b-c260-4f6f-968a-67fbd24be352
AZURE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
AZURE_SUBSCRIPTION_ID=a06001b5-a47c-44ac-b403-8be695f05440

### Nitor Environment Cred #######
AZURE_TENANT_ID=8c3dad1d-b6bc-4f8b-939b-8263372eced6
AZURE_CLIENT_ID=574a70af-933c-4b26-a2be-34b4249bf9f6
AZURE_CLIENT_SECRET=<SET_IN_ENV_FILE>
AZURE_SUBSCRIPTION_ID=892a27f1-3f34-4954-a9e9-7bb01aac763e


# Azure OpenAI Configuration for AI Agent (Resource Cloning)
AZURE_OPENAI_AGENT_ENDPOINT=https://smartdocs-hive.openai.azure.com/
AZURE_OPENAI_AGENT_KEY=<SET_IN_ENV_FILE>
AZURE_OPENAI_AGENT_DEPLOYMENT=gpt-4o


if we are using the gpt 4.1 with daily 10k token uses modal in this particular group group so what would the estimate cost of monthly

if i scale up my storage account so what would be the estimate average cost ?



please see the screenshot as i attached i see the clone is done and its appearing all 3 rsources which is correct but i got the error as below once exceution is complete so please have a look and please fix this issue properly 

Error Details:
ERROR: (InternalServerError) An unexpected error occured while processing the request. Tracking ID: 'ac3f5e77-45f4-4a8f-8062-8913683c59f5'
Code: InternalServerError
Message: An unexpected error occured while processing the request. Tracking ID: 'ac3f5e77-45f4-4a8f-8062-8913683c59f5'

Can you please remove the automatic test the database connection even i have to test the database connection by manually so please maintain all the firewall IP in the cloned version it should be mentioned the IP and firewall settings or other settings should clone from the original one.


az sql server update \
  --name azdevopsai-2666 \
  --resource-group clone-M \
  --admin-password "NewSecureP@ssw0rd123!"