# 🎨 Azure AI Agent - Visual Architecture Diagrams (Mermaid)

## 📊 System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer - React Frontend"
        A[App.js] --> B[Router]
        B --> C[Layout]
        C --> D[AIAgent Page]
        D --> E[Clone Section]
        D --> F[Chat Tab]
        D --> G[Operations Tab]
        D --> H[Context Providers]
    end
    
    subgraph "API Layer - Express Routes"
        I[aiAgent.js Routes] --> J[discover]
        I --> K[validate-clone]
        I --> L[analyze]
        I --> M[generate-cli]
        I --> N[execute-cli]
        I --> O[chat]
    end
    
    subgraph "Service Layer"
        P[AIAgentService] --> Q[GenAI Integration]
        R[ExecutionService] --> S[Script Execution]
        T[AzureValidationService] --> U[Azure API Validation]
        V[AzureService] --> W[Resource Management]
    end
    
    subgraph "External Services"
        X[Azure OpenAI GPT-4o]
        Y[Azure Resource Manager API]
        Z[Azure CLI]
        AA[Terraform]
    end
    
    D -->|HTTP POST| I
    I -->|Service Call| P
    I -->|Service Call| R
    I -->|Service Call| T
    I -->|Service Call| V
    
    P -->|API Call| X
    T -->|API Call| Y
    V -->|API Call| Y
    R -->|Execute| Z
    R -->|Execute| AA
    
    style D fill:#3b82f6,color:#fff
    style P fill:#10b981,color:#fff
    style X fill:#f59e0b,color:#fff
    style Y fill:#8b5cf6,color:#fff
```

---

## 🔄 Complete Cloning Workflow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as AIAgent.js
    participant API as routes/aiAgent.js
    participant Service as aiAgentService.js
    participant AzureAPI as Azure Resource Manager
    participant OpenAI as Azure OpenAI GPT-4o
    participant Validation as azureValidationService.js
    participant Execution as executionService.js
    
    User->>Frontend: Select Resource Group
    User->>Frontend: Click "Discover Resources"
    Frontend->>API: POST /discover
    API->>Service: discoverResourceGroup()
    Service->>AzureAPI: GET Resource Group
    Service->>AzureAPI: GET Resources List
    Service->>AzureAPI: GET Resource Details
    AzureAPI-->>Service: Resource Data
    Service-->>API: Discovered Resources
    API-->>Frontend: Response
    Frontend-->>User: Display Resources
    
    User->>Frontend: Enter Target RG & Click "Analyze"
    Frontend->>API: POST /validate-clone
    API->>Validation: validateResourceGroupForCloning()
    Validation->>AzureAPI: Check Quota/Region/SKU
    AzureAPI-->>Validation: Validation Results
    API->>Service: chat() [GenAI Validation]
    Service->>OpenAI: Chat Completions API
    OpenAI-->>Service: Validation Result
    Service-->>API: Validated Config
    API-->>Frontend: Validation Result
    Frontend-->>User: Show Confirmation Modal
    
    User->>Frontend: Confirm & Proceed
    Frontend->>API: POST /analyze
    API->>Service: analyzeAndGenerateStrategy()
    Service->>OpenAI: Chat Completions API
    OpenAI-->>Service: Strategy JSON
    Service-->>API: Analysis Result
    API-->>Frontend: Strategy
    
    User->>Frontend: Click "Generate Azure CLI"
    Frontend->>API: POST /generate-cli
    API->>Service: generateAzureCLIScripts()
    Service->>OpenAI: Chat Completions API
    OpenAI-->>Service: Generated Script
    Service-->>API: Script
    API-->>Frontend: Script
    Frontend-->>User: Display Script
    
    User->>Frontend: Click "Execute Now"
    Frontend->>API: POST /execute-cli
    API->>Execution: executeAzureCLI()
    Execution->>Z: Execute Script (Azure CLI)
    Execution-->>API: Real-time Status
    API-->>Frontend: Status Updates (Polling)
    Frontend-->>User: Show Progress
```

---

## 🤖 GenAI Processing Pipeline

```mermaid
graph LR
    subgraph "Input Collection"
        A[User Input] --> B[Resource Group Data]
        A --> C[Target Configuration]
        A --> D[Validation Results]
    end
    
    subgraph "Context Building"
        B --> E[Context Builder]
        C --> E
        D --> E
        E --> F[Structured Context<br/>28K-68K tokens]
    end
    
    subgraph "Prompt Engineering"
        F --> G[System Prompt<br/>1,500-3,000 lines<br/>2K-3K tokens]
        F --> H[User Prompt<br/>28K-68K tokens]
    end
    
    subgraph "Azure OpenAI GPT-4o"
        G --> I[Model Processing]
        H --> I
        I --> J[Tokenization]
        J --> K[Context Understanding]
        K --> L[Pattern Recognition]
        L --> M[Reasoning & Analysis]
        M --> N[Code Generation]
        N --> O[Output Generation<br/>2K-8K tokens]
    end
    
    subgraph "Post-Processing"
        O --> P[Parse Response]
        P --> Q[Validate Schema]
        Q --> R[Clean & Format]
        R --> S[Error Correction]
    end
    
    subgraph "Output"
        S --> T[Final Result]
        T --> U[Frontend Display]
    end
    
    style I fill:#f59e0b,color:#fff
    style O fill:#10b981,color:#fff
    style T fill:#3b82f6,color:#fff
```

---

## 🧠 GenAI Model Parameters by Use Case

```mermaid
graph TB
    subgraph "Resource Analysis"
        A1[Temperature: 0.3<br/>Max Tokens: 4,000<br/>Top-P: 0.95<br/>Penalties: 0, 0]
    end
    
    subgraph "Script Generation"
        B1[Temperature: 0.2<br/>Max Tokens: 8,000<br/>Top-P: 0.9<br/>Penalties: 0, 0]
    end
    
    subgraph "Conversational Chat"
        C1[Temperature: 0.7<br/>Max Tokens: 2,000<br/>Top-P: 0.95<br/>Penalties: 0, 0]
    end
    
    subgraph "Cost Estimation"
        D1[Temperature: 0.2<br/>Max Tokens: 3,000<br/>Top-P: 0.9<br/>Penalties: 0, 0]
    end
    
    subgraph "Error Analysis"
        E1[Temperature: 0.7<br/>Max Tokens: 2,000<br/>Top-P: 0.95<br/>Penalties: 0.3, 0.3]
    end
    
    style A1 fill:#3b82f6,color:#fff
    style B1 fill:#10b981,color:#fff
    style C1 fill:#f59e0b,color:#fff
    style D1 fill:#8b5cf6,color:#fff
    style E1 fill:#ef4444,color:#fff
```

---

## 🔍 Validation & Analysis Flow

```mermaid
flowchart TD
    A[User Clicks Analyze] --> B[POST /validate-clone]
    B --> C[Azure API Validation]
    C --> D{Quota Available?}
    D -->|No| E[Check Alternative Regions]
    D -->|Yes| F[Check SKU Availability]
    E --> F
    F --> G[Check Provider Registration]
    G --> H[GenAI Validation]
    H --> I[Generate Unique Names]
    I --> J[Correct Runtime Formats]
    J --> K[Validate Dependencies]
    K --> L[Estimate Costs]
    L --> M[Return Validation Result]
    M --> N[Show Confirmation Modal]
    N --> O{User Confirms?}
    O -->|Yes| P[POST /analyze]
    O -->|No| Q[Cancel]
    P --> R[GenAI Strategy Generation]
    R --> S[Return Strategy]
    
    style H fill:#f59e0b,color:#fff
    style R fill:#f59e0b,color:#fff
    style M fill:#10b981,color:#fff
    style S fill:#10b981,color:#fff
```

---

## 💻 Script Generation Flow

```mermaid
flowchart TD
    A[User Clicks Generate Script] --> B[POST /generate-cli]
    B --> C[Build System Prompt<br/>3,000+ lines]
    C --> D[Build User Prompt<br/>with Validated Config]
    D --> E[Configure Model Parameters<br/>Temp: 0.2, Tokens: 8K]
    E --> F[Call Azure OpenAI GPT-4o]
    F --> G[AI Generates Script]
    G --> H[Post-Processing]
    H --> I[Remove Markdown]
    I --> J[Validate Syntax]
    J --> K[Fix Common Errors]
    K --> L[Add Shebang if Missing]
    L --> M[Return Script]
    M --> N[Display in Frontend]
    
    style F fill:#f59e0b,color:#fff
    style G fill:#10b981,color:#fff
    style M fill:#3b82f6,color:#fff
```

---

## ⚙️ Execution Service Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running: executeAzureCLI()
    Running --> Waiting: Interactive Prompt Detected
    Waiting --> Running: User Responds
    Running --> Completed: All Commands Succeed
    Running --> Failed: Error Detected
    Waiting --> Failed: User Cancels
    Completed --> [*]
    Failed --> [*]
    
    note right of Running
        Real-time output streaming
        Step-by-step progress
        Error detection
    end note
    
    note right of Waiting
        Interactive prompt modal
        User input required
        Resume execution
    end note
```

---

## 📡 Data Flow Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[User Action] --> B[State Update]
        B --> C[HTTP Request]
    end
    
    subgraph "API Layer"
        C --> D[Route Handler]
        D --> E[Input Validation]
        E --> F[Service Call]
    end
    
    subgraph "Service Layer"
        F --> G[Business Logic]
        G --> H[Azure API Call]
        G --> I[GenAI Call]
    end
    
    subgraph "External Services"
        H --> J[Azure Resource Manager]
        I --> K[Azure OpenAI GPT-4o]
    end
    
    subgraph "Response Flow"
        J --> L[Process Data]
        K --> L
        L --> M[Format Response]
        M --> N[Return to API]
        N --> O[Return to Frontend]
        O --> P[Update UI]
    end
    
    style I fill:#f59e0b,color:#fff
    style K fill:#f59e0b,color:#fff
    style P fill:#10b981,color:#fff
```

---

## 🎯 Component Interaction

```mermaid
graph LR
    subgraph "Frontend Components"
        A[AIAgent.js] --> B[Clone Section]
        A --> C[Chat Tab]
        A --> D[Operations Tab]
        B --> E[Resource Selector]
        B --> F[Discover Button]
        B --> G[Analyze Button]
        B --> H[Generate Buttons]
        C --> I[Chat Messages]
        C --> J[Chat Input]
        D --> K[Operation Query]
        D --> L[Script Display]
    end
    
    subgraph "State Management"
        M[React State] --> N[resourceGroups]
        M --> O[discoveredResources]
        M --> P[analysisStrategy]
        M --> Q[generatedScripts]
        M --> R[executionData]
    end
    
    subgraph "API Calls"
        S[Axios] --> T[/api/ai-agent/discover]
        S --> U[/api/ai-agent/validate-clone]
        S --> V[/api/ai-agent/analyze]
        S --> W[/api/ai-agent/generate-cli]
        S --> X[/api/ai-agent/execute-cli]
        S --> Y[/api/ai-agent/chat]
    end
    
    A --> M
    B --> S
    C --> S
    D --> S
    
    style A fill:#3b82f6,color:#fff
    style M fill:#10b981,color:#fff
    style S fill:#f59e0b,color:#fff
```

---

## 🔐 Security & Authentication Flow

```mermaid
sequenceDiagram
    participant Service as aiAgentService
    participant AzureAD as Azure AD
    participant ARM as Azure Resource Manager
    participant OpenAI as Azure OpenAI
    
    Service->>AzureAD: OAuth 2.0 Client Credentials
    Note over Service,AzureAD: client_id, client_secret, tenant_id
    AzureAD-->>Service: Access Token (expires in 1 hour)
    
    Service->>ARM: API Request with Bearer Token
    ARM-->>Service: Resource Data
    
    Service->>OpenAI: API Request with API Key
    Note over Service,OpenAI: Azure Key Credential
    OpenAI-->>Service: AI Response
    
    Note over Service: Token cached and refreshed before expiry
```

---

## 📊 Token Usage Flow

```mermaid
graph TB
    A[Input Data] --> B[Context Building]
    B --> C[Token Count: 28K-68K]
    C --> D[System Prompt: 2K-3K]
    D --> E[User Prompt: 28K-68K]
    E --> F[Total Input: 30K-71K]
    F --> G[Azure OpenAI Processing]
    G --> H[Output Generation: 2K-8K]
    H --> I[Total Tokens: 32K-79K]
    I --> J[Cost Calculation]
    J --> K[$0.20-$0.60 per operation]
    
    style G fill:#f59e0b,color:#fff
    style I fill:#10b981,color:#fff
    style K fill:#3b82f6,color:#fff
```

---

## 🎨 Use These Diagrams In:

1. **PowerPoint/Keynote**: Copy Mermaid code to [Mermaid Live Editor](https://mermaid.live) → Export as PNG/SVG
2. **Markdown Presentations**: Use with [Marp](https://marp.app) or [Reveal.js](https://revealjs.com)
3. **Documentation**: Embed directly in Markdown (GitHub supports Mermaid)
4. **Online Tools**: 
   - [Mermaid Live Editor](https://mermaid.live)
   - [Draw.io](https://app.diagrams.net) (import Mermaid)
   - [Excalidraw](https://excalidraw.com)

---

**All diagrams are optimized for customer presentations and technical discussions!**

