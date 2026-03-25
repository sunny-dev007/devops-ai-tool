# 🏗️ Azure AI Agent - Technical Architecture & Flow Diagrams

## 📊 Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [GenAI Integration Architecture](#2-genai-integration-architecture)
3. [Complete Cloning Workflow](#3-complete-cloning-workflow)
4. [Component Interaction Diagram](#4-component-interaction-diagram)
5. [Data Flow Architecture](#5-data-flow-architecture)
6. [GenAI Processing Pipeline](#6-genai-processing-pipeline)
7. [Execution Service Architecture](#7-execution-service-architecture)

---

## 1. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (React Frontend)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │   AI Agent Page  │  │   Chat Interface  │  │  Operations Tab   │        │
│  │   (AIAgent.js)   │  │   (Chat Tab)      │  │  (Operations Tab) │        │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘        │
│           │                      │                      │                    │
│           └──────────────────────┴──────────────────────┘                    │
│                              │                                                │
│                    ┌─────────▼─────────┐                                      │
│                    │  React Context    │                                      │
│                    │  (AzureContext)   │                                      │
│                    └─────────┬─────────┘                                      │
└──────────────────────────────┼────────────────────────────────────────────────┘
                               │ HTTP/REST API
                               │ (Axios)
┌──────────────────────────────▼────────────────────────────────────────────────┐
│                        API LAYER (Express.js Routes)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │  /api/ai-agent/* │  │  /api/chat/*     │  │  /api/azure/*    │        │
│  │  (aiAgent.js)    │  │  (chat.js)       │  │  (azure.js)      │        │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘        │
│           │                      │                      │                    │
└───────────┼──────────────────────┼──────────────────────┼────────────────────┘
            │                      │                      │
┌───────────▼──────────────────────▼──────────────────────▼────────────────────┐
│                        SERVICE LAYER (Business Logic)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │  AIAgentService      │  │  ExecutionService     │                        │
│  │  (GenAI Integration) │  │  (Script Execution)  │                        │
│  └──────────┬───────────┘  └──────────┬───────────┘                        │
│             │                          │                                     │
│  ┌──────────▼───────────┐  ┌───────────▼───────────┐                        │
│  │  AzureValidation    │  │  AzureService          │                        │
│  │  Service            │  │  (Resource Management) │                        │
│  └──────────┬──────────┘  └───────────┬───────────┘                        │
│             │                          │                                     │
└─────────────┼──────────────────────────┼─────────────────────────────────────┘
              │                          │
┌─────────────▼──────────────────────────▼─────────────────────────────────────┐
│                        EXTERNAL SERVICES LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │  Azure OpenAI        │  │  Azure Resource       │                        │
│  │  (GPT-4o)            │  │  Manager API          │                        │
│  │  - Chat Completions  │  │  - Resource Discovery │                        │
│  │  - Code Generation   │  │  - Validation         │                        │
│  │  - Analysis          │  │  - Quota Checks       │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │  Azure CLI           │  │  Terraform            │                        │
│  │  (Execution)         │  │  (Execution)          │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

```
Frontend:
├── React 18 (UI Framework)
├── Framer Motion (Animations)
├── React Query (Data Fetching)
├── Axios (HTTP Client)
└── Tailwind CSS (Styling)

Backend:
├── Node.js (Runtime)
├── Express.js (Web Framework)
├── @azure/openai (Azure OpenAI SDK)
├── @azure/arm-* (Azure Management SDKs)
└── child_process (Script Execution)

External:
├── Azure OpenAI GPT-4o (GenAI)
├── Azure Resource Manager API
├── Azure CLI (Execution)
└── Terraform (Execution)
```

---

## 2. GenAI Integration Architecture

### Azure OpenAI Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENAI PROCESSING PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  User Action    │
│  (Frontend)     │
└────────┬────────┘
         │
         │ HTTP POST Request
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Route Handler                                                           │
│  (routes/aiAgent.js)                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/ai-agent/discover                                          │  │
│  │  POST /api/ai-agent/validate-clone                                    │  │
│  │  POST /api/ai-agent/analyze                                           │  │
│  │  POST /api/ai-agent/generate-cli                                      │  │
│  │  POST /api/ai-agent/generate-terraform                                │  │
│  │  POST /api/ai-agent/chat                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Service Call
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI Agent Service                                                            │
│  (services/aiAgentService.js)                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. Build Context                                                    │  │
│  │     ├── Resource Group Data                                          │  │
│  │     ├── Validation Results                                           │  │
│  │     └── Historical Patterns                                          │  │
│  │                                                                       │  │
│  │  2. Construct System Prompt                                          │  │
│  │     ├── Role Definition (50-100 lines)                               │  │
│  │     ├── Task Specification (200-500 lines)                          │  │
│  │     ├── Domain Knowledge (500-1000 lines)                            │  │
│  │     ├── Output Format (200-400 lines)                                │  │
│  │     └── Few-Shot Examples (300-600 lines)                             │  │
│  │     Total: 1,500-3,000 lines                                         │  │
│  │                                                                       │  │
│  │  3. Build User Prompt                                                │  │
│  │     ├── Resource Data (JSON)                                         │  │
│  │     ├── Target Configuration                                         │  │
│  │     └── Validation Context                                           │  │
│  │                                                                       │  │
│  │  4. Configure Model Parameters                                        │  │
│  │     ├── Temperature: 0.2-0.7 (task-specific)                        │  │
│  │     ├── Max Tokens: 2K-8K (operation-specific)                      │  │
│  │     ├── Top-P: 0.9-0.95 (balanced precision)                        │  │
│  │     └── Frequency/Presence Penalty: 0-0.3                            │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Azure OpenAI API Call
         │ (getChatCompletions)
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure OpenAI Service                                                        │
│  (GPT-4o Deployment)                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Model: gpt-4o                                                       │  │
│  │  Context Window: 128K tokens                                         │  │
│  │  Endpoint: https://smartdocs-hive.openai.azure.com/                  │  │
│  │                                                                       │  │
│  │  Processing:                                                         │  │
│  │  ├── Tokenization (Input)                                            │  │
│  │  ├── Context Understanding                                           │  │
│  │  ├── Pattern Recognition                                             │  │
│  │  ├── Code Generation                                                 │  │
│  │  ├── Analysis & Reasoning                                            │  │
│  │  └── Tokenization (Output)                                           │  │
│  │                                                                       │  │
│  │  Response:                                                           │  │
│  │  ├── Generated Content                                               │  │
│  │  ├── Token Usage (prompt/completion/total)                           │  │
│  │  └── Finish Reason                                                   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ AI Response
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Response Processing                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. Parse Response                                                   │  │
│  │     ├── Extract JSON (if structured)                                 │  │
│  │     ├── Clean Markdown (if code)                                     │  │
│  │     └── Validate Format                                              │  │
│  │                                                                       │  │
│  │  2. Post-Processing                                                  │  │
│  │     ├── Schema Validation                                            │  │
│  │     ├── Syntax Validation (for scripts)                              │  │
│  │     ├── Semantic Validation                                         │  │
│  │     └── Error Correction                                             │  │
│  │                                                                       │  │
│  │  3. Return to Frontend                                               │  │
│  │     ├── Success Response                                             │  │
│  │     └── Error Handling                                               │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ JSON Response
         ▼
┌─────────────────┐
│  Frontend        │
│  (Display/Use)   │
└─────────────────┘
```

### GenAI Model Parameters by Use Case

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENAI PARAMETER CONFIGURATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────┬─────────────┬──────────┬──────────────┐
│ Use Case             │ Temperature  │ Max Tokens  │ Top-P    │ Penalties    │
├──────────────────────┼──────────────┼─────────────┼──────────┼──────────────┤
│ Resource Analysis    │ 0.3          │ 4,000       │ 0.95     │ 0, 0         │
│ Strategy Generation  │              │             │          │              │
├──────────────────────┼──────────────┼─────────────┼──────────┼──────────────┤
│ Script Generation    │ 0.2          │ 8,000       │ 0.9      │ 0, 0         │
│ (Azure CLI/Terraform)│              │             │          │              │
├──────────────────────┼──────────────┼─────────────┼──────────┼──────────────┤
│ Conversational Chat  │ 0.7          │ 2,000       │ 0.95     │ 0, 0         │
│ (AI Assistant)       │              │             │          │              │
├──────────────────────┼──────────────┼─────────────┼──────────┼──────────────┤
│ Cost Estimation      │ 0.2          │ 3,000       │ 0.9      │ 0, 0         │
├──────────────────────┼──────────────┼─────────────┼──────────┼──────────────┤
│ Error Analysis       │ 0.7          │ 2,000       │ 0.95     │ 0.3, 0.3     │
└──────────────────────┴──────────────┴─────────────┴──────────┴──────────────┘

Rationale:
- Temperature 0.2-0.3: Deterministic, consistent outputs for code/analysis
- Temperature 0.7: Natural, conversational responses for chat
- Max Tokens: Sized for operation complexity (scripts need more)
- Top-P 0.9-0.95: Balanced precision and diversity
- Penalties: Used only for chat to encourage varied explanations
```

---

## 3. Complete Cloning Workflow

### End-to-End Cloning Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE RESOURCE CLONING WORKFLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: RESOURCE DISCOVERY                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User Action: Select Resource Group → Click "Discover Resources"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  handleDiscover()                                                    │  │
│  │  POST /api/ai-agent/discover                                         │  │
│  │  { resourceGroupName: "source-rg" }                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: routes/aiAgent.js                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  router.post('/discover')                                            │  │
│  │  → aiAgentService.discoverResourceGroup()                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: aiAgentService.js                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  1. Get Azure Access Token (OAuth 2.0)                               │  │
│  │  2. Query Azure Resource Manager API                                 │  │
│  │     ├── GET /subscriptions/{id}/resourceGroups/{name}                │  │
│  │     └── GET /subscriptions/{id}/resourceGroups/{name}/resources      │  │
│  │  3. Deep Configuration Extraction                                    │  │
│  │     ├── For each resource: GET /{resourceId}?api-version=...         │  │
│  │     ├── Web Apps: Detect deployment type                             │  │
│  │     ├── SQL: Extract firewall rules, connection strings               │  │
│  │     └── Storage: Extract access tiers, replication                    │  │
│  │  4. Return: { resourceGroup, resources[], totalResources }           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Response: Discovered Resources
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Display Resources                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Resource list with icons                                          │  │
│  │  - Resource types and names                                          │  │
│  │  - Configuration summary                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: PRE-VALIDATION & AI ANALYSIS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User Action: Enter Target RG Name → Click "Analyze with AI"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  handleAnalyze()                                                    │  │
│  │  POST /api/ai-agent/validate-clone                                   │  │
│  │  {                                                                   │  │
│  │    sourceResourceGroup: "source-rg",                                 │  │
│  │    targetResourceGroup: "target-rg",                                 │  │
│  │    discoveredResources: {...},                                      │  │
│  │    resources: [...]                                                 │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: routes/aiAgent.js                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  router.post('/validate-clone')                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │  Step 1: Azure API Validation                                │   │  │
│  │  │  → azureValidationService.validateResourceGroupForCloning()  │   │  │
│  │  │    ├── Check region availability                             │   │  │
│  │  │    ├── Check quota availability                               │   │  │
│  │  │    ├── Check SKU availability                                 │   │  │
│  │  │    └── Check provider registration                             │   │  │
│  │  │                                                                 │   │  │
│  │  │  Step 2: Quota Check Across Regions                            │   │  │
│  │  │  → azureValidationService.checkQuotaAcrossRegions()            │   │  │
│  │  │    └── Returns: availableRegions[], exhaustedRegions[]         │   │  │
│  │  │                                                                 │   │  │
│  │  │  Step 3: GenAI Validation                                      │   │  │
│  │  │  → aiAgentService.chat()                                       │   │  │
│  │  │    ├── System Prompt: 2,000+ lines                             │   │  │
│  │  │    ├── Context: Azure validation results                       │   │  │
│  │  │    ├── Context: Discovered resources                           │   │  │
│  │  │    └── Temperature: 0.3                                        │   │  │
│  │  │                                                                 │   │  │
│  │  │  GenAI Tasks:                                                  │   │  │
│  │  │  ├── Generate globally unique names                            │   │  │
│  │  │  ├── Correct runtime formats                                    │   │  │
│  │  │  ├── Validate SKUs and tiers                                    │   │  │
│  │  │  ├── Suggest alternative regions                                │   │  │
│  │  │  ├── Map dependencies                                           │   │  │
│  │  │  └── Estimate costs                                              │   │  │
│  │  │                                                                 │   │  │
│  │  │  Response: Validation Result JSON                               │   │  │
│  │  │  {                                                              │   │  │
│  │  │    validatedResources: [...],                                  │   │  │
│  │  │    validatedConfig: { resourceMappings: {...} },               │   │  │
│  │  │    warnings: [...],                                             │   │  │
│  │  │    recommendations: [...]                                       │   │  │
│  │  │  }                                                              │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Validation Result
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Confirmation Modal                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Display validated resources                                       │  │
│  │  - Show corrections applied                                         │  │
│  │  - Display warnings and recommendations                             │  │
│  │  - User confirms or cancels                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ User Confirms
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: handleConfirmClone()                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/ai-agent/analyze                                          │  │
│  │  {                                                                   │  │
│  │    resourceGroupData: discoveredResources,                          │  │
│  │    targetResourceGroupName: "target-rg",                             │  │
│  │    validatedConfig: cloneValidationResult                            │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: GenAI Strategy Generation                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  aiAgentService.analyzeAndGenerateStrategy()                         │  │
│  │  ├── System Prompt: Azure Architect Expert                           │  │
│  │  ├── User Prompt: Resources + Validated Config                       │  │
│  │  ├── Temperature: 0.3                                                │  │
│  │  ├── Max Tokens: 4,000                                               │  │
│  │  └── Response: Strategy JSON                                         │  │
│  │     {                                                                │  │
│  │       resourceInventory: [...],                                     │  │
│  │       dependencies: [...],                                           │  │
│  │       deploymentOrder: [...],                                        │  │
│  │       warnings: [...],                                               │  │
│  │       estimatedTime: "...",                                         │  │
│  │       recommendations: [...]                                         │  │
│  │     }                                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: SCRIPT GENERATION                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User Action: Click "Generate Azure CLI" or "Generate Terraform"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  handleGenerateCLI() or handleGenerateTerraform()                    │  │
│  │  POST /api/ai-agent/generate-cli                                     │  │
│  │  POST /api/ai-agent/generate-terraform                               │  │
│  │  {                                                                   │  │
│  │    resourceGroupData: discoveredResources,                          │  │
│  │    targetResourceGroupName: "target-rg",                             │  │
│  │    validatedConfig: cloneValidationResult,                           │  │
│  │    useStaticScript: true/false                                        │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: GenAI Script Generation                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  aiAgentService.generateAzureCLIScripts()                           │  │
│  │  OR                                                                  │  │
│  │  aiAgentService.generateTerraformConfig()                            │  │
│  │                                                                      │  │
│  │  System Prompt: 3,000+ lines                                         │  │
│  │  ├── Azure CLI/Terraform syntax rules                                │  │
│  │  ├── Anti-hang patterns                                              │  │
│  │  ├── Error handling templates                                        │  │
│  │  ├── Validation steps                                                │  │
│  │  └── Best practices                                                  │  │
│  │                                                                      │  │
│  │  User Prompt:                                                        │  │
│  │  ├── Resource configurations                                         │  │
│  │  ├── Validated names and mappings                                    │  │
│  │  └── Target configuration                                            │  │
│  │                                                                      │  │
│  │  Model Parameters:                                                   │  │
│  │  ├── Temperature: 0.2 (ultra-deterministic)                          │  │
│  │  ├── Max Tokens: 8,000                                               │  │
│  │  └── Top-P: 0.9                                                      │  │
│  │                                                                      │  │
│  │  Post-Processing:                                                     │  │
│  │  ├── Remove markdown fences                                          │  │
│  │  ├── Validate syntax                                                │  │
│  │  ├── Fix common errors                                               │  │
│  │  └── Add shebang if missing                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Generated Script
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Display Script                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Code editor with syntax highlighting                              │  │
│  │  - Copy/Download buttons                                             │  │
│  │  - Execute button (if enabled)                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: EXECUTION (Optional)                                               │
└─────────────────────────────────────────────────────────────────────────────┘

User Action: Click "Execute Now"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  handleExecuteCLI() or handleExecuteTerraform()                      │  │
│  │  POST /api/ai-agent/execute-cli                                      │  │
│  │  POST /api/ai-agent/execute-terraform                                │  │
│  │  { script: "...", options: {...} }                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: Execution Service                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  executionService.executeAzureCLI()                                 │  │
│  │  OR                                                                  │  │
│  │  executionService.executeTerraform()                                 │  │
│  │                                                                      │  │
│  │  Process:                                                            │  │
│  │  ├── Create session ID                                               │  │
│  │  ├── Spawn child process (Azure CLI or Terraform)                    │  │
│  │  ├── Stream output in real-time                                      │  │
│  │  ├── Handle interactive prompts                                      │  │
│  │  ├── Detect errors                                                   │  │
│  │  └── Update status (running/completed/failed)                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Polling: GET /api/ai-agent/execution-status/:sessionId
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Real-Time Execution Modal                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Status indicator (Running/Completed/Failed)                        │  │
│  │  - Step-by-step progress                                              │  │
│  │  - Real-time output stream                                            │  │
│  │  - Error display (if failed)                                         │  │
│  │  - Cancel button                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Interaction Diagram

### Frontend Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENT ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

App.js (Root)
│
├─── Router (React Router)
│    │
│    ├─── Layout Component
│    │    │
│    │    ├─── Dashboard
│    │    ├─── Resources
│    │    ├─── Costs
│    │    ├─── Recommendations
│    │    │
│    │    └─── AIAgent (Main Feature)
│    │         │
│    │         ├─── State Management
│    │         │    ├─── resourceGroups[]
│    │         │    ├─── selectedResourceGroup
│    │         │    ├─── targetResourceGroup
│    │         │    ├─── discoveredResources
│    │         │    ├─── analysisStrategy
│    │         │    ├─── generatedScripts
│    │         │    ├─── cloneValidationResult
│    │         │    └─── executionData
│    │         │
│    │         ├─── Clone Section
│    │         │    ├─── Resource Group Selector
│    │         │    ├─── Discover Resources Button
│    │         │    ├─── Resource List Display
│    │         │    ├─── Analyze with AI Button
│    │         │    ├─── Validation Confirmation Modal
│    │         │    ├─── Generate Scripts Buttons
│    │         │    └─── Script Display & Actions
│    │         │
│    │         ├─── Chat Tab
│    │         │    ├─── Chat Messages List
│    │         │    ├─── Chat Input
│    │         │    └─── Send Button
│    │         │
│    │         └─── Operations Tab
│    │              ├─── Operation Query Input
│    │              ├─── Generate Script Button
│    │              ├─── Script Display
│    │              ├─── Execute Button
│    │              ├─── Execution Output
│    │              └─── AI Error Analysis
│    │
│    └─── Other Routes...
│
└─── Context Providers
     ├─── AzureProvider (AzureContext)
     │    └─── subscriptionSummary, resources, etc.
     │
     └─── ChatProvider (ChatContext)
          └─── chatHistory, sessions, etc.
```

### Backend Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVICE ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

Express Server (app.js)
│
├─── Routes Layer
│    │
│    ├─── routes/aiAgent.js
│    │    ├─── GET  /resource-groups
│    │    ├─── POST /discover
│    │    ├─── POST /validate-clone
│    │    ├─── POST /analyze
│    │    ├─── POST /generate-cli
│    │    ├─── POST /generate-terraform
│    │    ├─── POST /chat
│    │    ├─── POST /execute-cli
│    │    ├─── POST /execute-terraform
│    │    ├─── GET  /execution-status/:sessionId
│    │    ├─── POST /generate-operation-script
│    │    ├─── POST /analyze-execution-error
│    │    └─── POST /analyze-cloning-error
│    │
│    ├─── routes/chat.js
│    ├─── routes/azure.js
│    └─── routes/sqlOperations.js
│
└─── Services Layer
     │
     ├─── services/aiAgentService.js
     │    ├─── discoverResourceGroup()
     │    ├─── analyzeAndGenerateStrategy()
     │    ├─── generateAzureCLIScripts()
     │    ├─── generateTerraformConfig()
     │    ├─── chat()
     │    └─── getAccessToken()
     │
     ├─── services/executionService.js
     │    ├─── executeAzureCLI()
     │    ├─── executeTerraform()
     │    ├─── getExecution()
     │    ├─── cancelExecution()
     │    └─── handlePromptResponse()
     │
     ├─── services/azureValidationService.js
     │    ├─── validateResourceGroupForCloning()
     │    ├─── checkQuotaAcrossRegions()
     │    ├─── checkRegionAvailability()
     │    └─── checkSKUAvailability()
     │
     └─── services/azureService.js
          ├─── getResourceGroups()
          ├─── getResources()
          └─── getResourceGroupCosts()
```

---

## 5. Data Flow Architecture

### Request-Response Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   User       │
│  (Browser)   │
└──────┬───────┘
       │
       │ 1. User Action (Click Button)
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  State Update                                                         │  │
│  │  ├─── setLoading({ discover: true })                                 │  │
│  │  └─── setCurrentStep('discover')                                      │  │
│  │                                                                       │  │
│  │  HTTP Request (Axios)                                                 │  │
│  │  POST /api/ai-agent/discover                                          │  │
│  │  Body: { resourceGroupName: "source-rg" }                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 2. HTTP Request
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: routes/aiAgent.js                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Route Handler                                                       │  │
│  │  ├─── Extract request body                                           │  │
│  │  ├─── Validate input                                                 │  │
│  │  └─── Call service method                                           │  │
│  │      aiAgentService.discoverResourceGroup(resourceGroupName)         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 3. Service Call
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: aiAgentService.js                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Business Logic                                                      │  │
│  │  ├─── Get Azure Access Token                                          │  │
│  │  │    └─── OAuth 2.0 to Azure AD                                      │  │
│  │  │                                                                     │  │
│  │  ├─── Query Azure Resource Manager API                                │  │
│  │  │    ├─── GET Resource Group                                        │  │
│  │  │    ├─── GET Resources List                                         │  │
│  │  │    └─── GET Resource Details (for each)                            │  │
│  │  │                                                                     │  │
│  │  └─── Process & Structure Data                                        │  │
│  │       └─── Return: { resourceGroup, resources[], totalResources }     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 4. Azure API Response
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  External: Azure Resource Manager API                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Azure Cloud                                                          │  │
│  │  └─── Returns: Resource data (JSON)                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 5. Processed Data
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: Return to Route                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Format Response                                                      │  │
│  │  {                                                                    │  │
│  │    success: true,                                                     │  │
│  │    data: {                                                            │  │
│  │      resourceGroup: {...},                                           │  │
│  │      resources: [...],                                               │  │
│  │      totalResources: 5                                                │  │
│  │    }                                                                  │  │
│  │  }                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 6. HTTP Response
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Receive & Update State                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Response Handling                                                    │  │
│  │  ├─── setDiscoveredResources(response.data.data)                      │  │
│  │  ├─── setLoading({ discover: false })                                │  │
│  │  ├─── Update UI (display resources)                                  │  │
│  │  └─── Show success toast                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
       │ 7. UI Update
       ▼
┌──────────────┐
│   User       │
│  (Sees Results)│
└──────────────┘
```

### GenAI Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENAI DATA FLOW                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Input Data Collection                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User Input
     │
     ├─── Resource Group Selection
     ├─── Target Resource Group Name
     └─── Discovered Resources Data
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Context Building                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  aiAgentService.buildContext()                                       │  │
│  │  ├─── Resource Group Data (JSON)                                    │  │
│  │  │    └─── 20,000-50,000 tokens                                      │  │
│  │  ├─── Azure Validation Results                                       │  │
│  │  │    └─── 5,000-10,000 tokens                                       │  │
│  │  ├─── Validated Configuration                                        │  │
│  │  │    └─── 2,000-5,000 tokens                                        │  │
│  │  └─── Historical Patterns (optional)                                 │  │
│  │       └─── 1,000-3,000 tokens                                        │  │
│  │                                                                       │  │
│  │  Total Context: 28,000-68,000 tokens                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Prompt Construction                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  System Prompt (1,500-3,000 lines)                                   │  │
│  │  ├─── Role Definition                                                │  │
│  │  ├─── Task Specification                                             │  │
│  │  ├─── Domain Knowledge                                               │  │
│  │  ├─── Output Format                                                  │  │
│  │  └─── Few-Shot Examples                                              │  │
│  │       └─── 2,000-3,000 tokens                                        │  │
│  │                                                                       │  │
│  │  User Prompt                                                          │  │
│  │  ├─── Context Data (from above)                                       │  │
│  │  └─── Specific Request                                               │  │
│  │       └─── 28,000-68,000 tokens                                      │  │
│  │                                                                       │  │
│  │  Total Input: 30,000-71,000 tokens                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Azure OpenAI API Call
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure OpenAI GPT-4o                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Processing                                                          │  │
│  │  ├─── Tokenization (Input)                                           │  │
│  │  ├─── Context Understanding                                          │  │
│  │  ├─── Pattern Recognition                                            │  │
│  │  ├─── Code Generation / Analysis                                     │  │
│  │  └─── Tokenization (Output)                                          │  │
│  │                                                                       │  │
│  │  Response                                                            │  │
│  │  ├─── Generated Content                                              │  │
│  │  │    └─── 2,000-8,000 tokens                                        │  │
│  │  ├─── Usage Statistics                                               │  │
│  │  │    ├─── promptTokens: 30,000-71,000                                │  │
│  │  │    ├─── completionTokens: 2,000-8,000                              │  │
│  │  │    └─── totalTokens: 32,000-79,000                                 │  │
│  │  └─── Finish Reason: "stop"                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ AI Response
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Response Processing                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Post-Processing                                                      │  │
│  │  ├─── Parse JSON (if structured output)                               │  │
│  │  ├─── Remove Markdown (if code)                                      │  │
│  │  ├─── Validate Schema                                                │  │
│  │  ├─── Validate Syntax (if script)                                    │  │
│  │  └─── Error Correction                                               │  │
│  │                                                                       │  │
│  │  Return Processed Data                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Processed Response
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Display/Use                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Update State                                                       │  │
│  │  - Display in UI                                                      │  │
│  │  - Enable Next Actions                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. GenAI Processing Pipeline

### Detailed GenAI Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENAI PROCESSING PIPELINE DETAIL                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: PRE-PROCESSING                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Input Data
     │
     ├─── Discovered Resources
     │    └─── Raw Azure API JSON
     │
     ├─── Azure Validation Results
     │    ├─── Quota Availability
     │    ├─── Region Availability
     │    └─── SKU Availability
     │
     └─── User Configuration
          ├─── Source Resource Group
          ├─── Target Resource Group
          └─── Options/Preferences
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Data Transformation                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ├─── Filter Relevant Properties                                      │  │
│  │  ├─── Structure for AI Consumption                                   │  │
│  │  ├─── Add Metadata                                                   │  │
│  │  └─── Compress Redundant Data                                         │  │
│  │       └─── Token Optimization: 30-40% reduction                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PROMPT ENGINEERING                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  System Prompt Construction                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. Role Definition (50-100 lines)                                   │  │
│  │     "You are an expert Azure Cloud Architect..."                     │  │
│  │                                                                       │  │
│  │  2. Task Specification (200-500 lines)                                │  │
│  │     "Your task is to analyze Azure resources..."                     │  │
│  │     "You must generate production-ready scripts..."                   │  │
│  │                                                                       │  │
│  │  3. Domain Knowledge (500-1000 lines)                                 │  │
│  │     - Azure resource schemas                                          │  │
│  │     - Dependency relationships                                        │  │
│  │     - Best practices                                                  │  │
│  │     - Common patterns                                                 │  │
│  │                                                                       │  │
│  │  4. Output Format (200-400 lines)                                     │  │
│  │     - JSON schema definitions                                         │  │
│  │     - Code structure requirements                                     │  │
│  │     - Validation rules                                                │  │
│  │                                                                       │  │
│  │  5. Few-Shot Examples (300-600 lines)                                 │  │
│  │     - Example inputs                                                  │  │
│  │     - Example outputs                                                 │  │
│  │     - Edge case examples                                              │  │
│  │                                                                       │  │
│  │  Total: 1,500-3,000 lines                                             │  │
│  │  Tokens: 2,000-3,000 tokens                                           │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Prompt Construction                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ├─── Context Data (transformed input)                                │  │
│  │  ├─── Specific Request                                                │  │
│  │  └─── Validation Instructions                                         │  │
│  │       └─── 28,000-68,000 tokens                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: AI PROCESSING                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure OpenAI GPT-4o Processing                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Input Tokens: 30,000-71,000                                          │  │
│  │                                                                       │  │
│  │  Processing Steps:                                                    │  │
│  │  ├─── 1. Tokenization                                                 │  │
│  │  │    └─── Convert text to tokens                                    │  │
│  │  │                                                                     │  │
│  │  ├─── 2. Context Understanding                                        │  │
│  │  │    ├─── Parse system prompt                                        │  │
│  │  │    ├─── Understand role & task                                     │  │
│  │  │    └─── Load domain knowledge                                       │  │
│  │  │                                                                     │  │
│  │  ├─── 3. Pattern Recognition                                          │  │
│  │  │    ├─── Identify resource types                                     │  │
│  │  │    ├─── Map dependencies                                            │  │
│  │  │    └─── Recognize configurations                                    │  │
│  │  │                                                                     │  │
│  │  ├─── 4. Reasoning & Analysis                                         │  │
│  │  │    ├─── Dependency graph construction                               │  │
│  │  │    ├─── Configuration validation                                    │  │
│  │  │    ├─── Name generation (globally unique)                           │  │
│  │  │    └─── Cost estimation                                             │  │
│  │  │                                                                     │  │
│  │  ├─── 5. Code Generation (if script)                                  │  │
│  │  │    ├─── Azure CLI syntax                                            │  │
│  │  │    ├─── Error handling patterns                                     │  │
│  │  │    ├─── Validation steps                                            │  │
│  │  │    └─── Best practices                                              │  │
│  │  │                                                                     │  │
│  │  └─── 6. Output Generation                                            │  │
│  │       ├─── Structure response (JSON or code)                           │  │
│  │       ├─── Apply formatting                                            │  │
│  │       └─── Tokenize output                                             │  │
│  │                                                                       │  │
│  │  Output Tokens: 2,000-8,000                                           │  │
│  │  Processing Time: 2-5 seconds                                         │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: POST-PROCESSING                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Response Processing                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. Extract Content                                                  │  │
│  │     └─── response.choices[0].message.content                          │  │
│  │                                                                       │  │
│  │  2. Clean Response                                                   │  │
│  │     ├─── Remove markdown fences (```bash, ```)                        │  │
│  │     ├─── Remove explanatory text                                      │  │
│  │     └─── Extract code/JSON only                                       │  │
│  │                                                                       │  │
│  │  3. Parse & Validate                                                 │  │
│  │     ├─── JSON.parse() (if structured)                                │  │
│  │     ├─── Schema validation                                           │  │
│  │     └─── Syntax validation (if script)                                │  │
│  │                                                                       │  │
│  │  4. Error Correction                                                  │  │
│  │     ├─── Fix common syntax errors                                    │  │
│  │     ├─── Add missing shebang                                         │  │
│  │     └─── Correct Azure CLI parameters                                │  │
│  │                                                                       │  │
│  │  5. Return Processed Data                                             │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Final Output                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  - Update State                                                       │  │
│  │  - Display in UI                                                      │  │
│  │  - Enable user actions                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Execution Service Architecture

### Script Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTION SERVICE ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Execution Request                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

User Action: Click "Execute Now"
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: AIAgent.js                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  handleExecuteCLI()                                                  │  │
│  │  POST /api/ai-agent/execute-cli                                     │  │
│  │  {                                                                   │  │
│  │    script: "#!/bin/bash\n...",                                      │  │
│  │    options: { description: "..." }                                  │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend: routes/aiAgent.js                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  router.post('/execute-cli')                                         │  │
│  │  ├─── Generate session ID (UUID)                                     │  │
│  │  ├─── Call executionService.executeAzureCLI()                        │  │
│  │  └─── Return: { sessionId, message: "Execution started" }            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: executionService.js                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  executeAzureCLI(sessionId, script, options)                         │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                                                               │   │  │
│  │  │  1. Create Execution Session                                 │   │  │
│  │  │     ├─── Store in Map: executions.set(sessionId, {...})      │   │  │
│  │  │     └─── Initial state: { status: 'running', steps: [] }      │   │  │
│  │  │                                                               │   │  │
│  │  │  2. Parse Script                                              │   │  │
│  │  │     ├─── Split by newlines                                    │   │  │
│  │  │     ├─── Filter comments and empty lines                      │   │  │
│  │  │     └─── Extract commands                                      │   │  │
│  │  │                                                               │   │  │
│  │  │  3. Execute Commands Sequentially                             │   │  │
│  │  │     For each command:                                         │   │  │
│  │  │     ├─── Spawn child process (bash -c "command")              │   │  │
│  │  │     ├─── Set timeout (5 minutes per command)                 │   │  │
│  │  │     ├─── Stream stdout/stderr in real-time                    │   │  │
│  │  │     ├─── Update execution state                                │   │  │
│  │  │     └─── Handle errors                                         │   │  │
│  │  │                                                               │   │  │
│  │  │  4. Interactive Prompt Detection                              │   │  │
│  │  │     ├─── Detect prompts in output                              │   │  │
│  │  │     ├─── Pause execution                                       │   │  │
│  │  │     ├─── Store prompt in interactivePrompts Map               │   │  │
│  │  │     └─── Wait for user response                                │   │  │
│  │  │                                                               │   │  │
│  │  │  5. Error Handling                                             │   │  │
│  │  │     ├─── Detect Azure errors                                   │   │  │
│  │  │     ├─── Classify error type                                   │   │  │
│  │  │     ├─── Generate interactive prompt (if applicable)           │   │  │
│  │  │     └─── Update status to 'failed' or 'waiting'                │   │  │
│  │  │                                                               │   │  │
│  │  │  6. Completion                                                 │   │  │
│  │  │     ├─── Update status to 'completed' or 'failed'              │   │  │
│  │  │     ├─── Store final output                                    │   │  │
│  │  │     └─── Schedule cleanup (1 hour)                            │   │  │
│  │  │                                                               │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │
         │ Real-Time Status Updates
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Polling                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  startExecutionPolling(sessionId)                                    │  │
│  │  ├─── setInterval(() => {                                             │  │
│  │  │      GET /api/ai-agent/execution-status/:sessionId                │  │
│  │  │    }, 2000) // Poll every 2 seconds                               │  │
│  │  └─── Update UI with real-time status                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Execution State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTION STATE MACHINE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │
                           │ executeAzureCLI()
                           ▼
                    ┌─────────────┐
                    │  RUNNING    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  WAITING    │    │  COMPLETED  │    │   FAILED    │
│ (Interactive│    │             │    │             │
│  Prompt)    │    └─────────────┘    └─────────────┘
└──────┬──────┘
       │
       │ handlePromptResponse()
       ▼
┌─────────────┐
│  RUNNING    │
│  (Resumed)  │
└─────────────┘
```

---

## 📊 Summary Statistics

### Architecture Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE METRICS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend:
├─── Components: 15+
├─── State Variables: 20+
├─── API Endpoints Used: 12+
└─── Lines of Code: ~3,500

Backend:
├─── Routes: 7 files
├─── Services: 5 files
├─── API Endpoints: 25+
└─── Lines of Code: ~15,000

GenAI Integration:
├─── System Prompts: 5 (1,500-3,000 lines each)
├─── Model Calls: 6 different operations
├─── Token Usage: 30K-80K per operation
└─── Response Time: 2-5 seconds

External Services:
├─── Azure OpenAI GPT-4o
├─── Azure Resource Manager API
├─── Azure CLI
└─── Terraform
```

---

## 🎯 Key Technical Highlights

1. **Multi-Layer Architecture**: Clear separation between frontend, API, services, and external services
2. **GenAI Integration**: Sophisticated prompt engineering with 1,500-3,000 line system prompts
3. **Real-Time Execution**: Streaming execution with polling for status updates
4. **Error Handling**: Multi-layer error detection and interactive prompt resolution
5. **Validation Pipeline**: Pre-execution validation using both Azure APIs and GenAI
6. **Token Optimization**: 50-70% token reduction through compression and selective context
7. **State Management**: Comprehensive state management across frontend and backend
8. **Scalability**: Handles 1 to 1,000+ resources with same efficiency

---

**End of Architecture Diagrams**

