# 🛡️ LLM Guardrails Gateway

An advanced, real-time Input/Output safety layer and monitoring dashboard for LLM applications. It protects against prompt injections, masks or blocks personally identifiable information (PII), filters out toxic text, and ensures topic alignment using interactive policy rules.

---

## 📸 Screenshots

### 1. Recruiter Access Portal (Secure Auth)
![Login Interface](public/images/login.png)

### 2. Interactive Input Playground & Pipeline
![Dashboard Playground](public/images/dashboard.png)

### 3. Analytics & Live Activity Logs
![Metrics & Activity Feed](public/images/activity.png)


## 🤖 Generative AI Security Architecture

Deploying Large Language Models (LLMs) in production exposes enterprise systems to major security threats, including **Prompt Injections (Jailbreaking)**, **Sensitive Data Leaks (PII)**, **Toxicity**, and **Topic Drifting**. 

The **LLM Guardrails Gateway** solves this by acting as an inline proxy between client applications and generative models, evaluating and cleaning payloads on-the-fly.

### Request-Response Lifecycle Flow
The gateway intercepts and audits payloads in three sequential phases:

```mermaid
flowchart TD
    User([User Prompt]) --> Gateway[LLM Guardrails Gateway]
    
    subgraph Phase 1: Input Shield
        Gateway --> PII[PII Scanner]
        Gateway --> Injection[Prompt Injection Audit]
        PII -->|PII Detected| Mask["Mask / Block Prompt"]
        Injection -->|Confidence >= 50%| Block["Block Prompt"]
    end
    
    Mask & Injection -->|Allowed / Modified| LLM[Generative LLM Core]
    
    subgraph Phase 2: Generative LLM Processing
        LLM -->|Generate Response| Output[Raw Output Text]
    end
    
    Output --> Validate{Output Shield}
    
    subgraph Phase 3: Output Shield
        Validate -->|Enabled| Tox[Toxicity Check]
        Validate -->|Enabled| Topic[Topic Relevance Check]
        Tox -->|Violated| BlockOut["Block Response"]
        Topic -->|Off-Topic| BlockOut
    end
    
    Validate -->|All Passed| Return([Safe Response to Client])
    BlockOut --> ReturnError([Blocked Output Response])
    
    style Gateway fill:#111,stroke:#666,stroke-width:2px
    style LLM fill:#1e1b4b,stroke:#818cf8,stroke-width:2px
    style Mask fill:#78350f,stroke:#d97706,stroke-width:1px
    style Block fill:#7f1d1d,stroke:#f87171,stroke-width:1px
    style BlockOut fill:#7f1d1d,stroke:#f87171,stroke-width:1px
    style Return fill:#064e3b,stroke:#34d399,stroke-width:2px
```

---

## ⚡ Features

### 1. Interactive Input Guardrails
* **PII Masking & Blocking**: Automatically scans for 8 types of sensitive data including Social Security Numbers, credit cards, emails, phone numbers, API keys, and addresses. Toggle actions between `MASK` and `BLOCK` dynamically.
* **Prompt Injection Detection**: Identifies DAN (Do Anything Now) instructions, role override templates, delimiter injections, and obfuscated encoding patterns with confidence scoring.

### 2. Output Guardrails
* **Toxicity Filter**: Scans model responses to ensure clean, professional outputs.
* **Topic Alignment**: Restricts LLMs to support-related discussions, preventing discussions on competitor pricing, unreleased roadmaps, or salaries.

### 3. User Experience & Dashboard
* **Dynamic Status Bar & Policy Controls**: Click rules directly on the top status bar or the rules table to toggle them ON/OFF dynamically.
* **Animated Live Pipeline**: Visualizes requests traveling through each safety step.
* **Adversarial Test Bench**: Run a built-in suite of 12 test cases to evaluate safety engine performance.

### 4. Watertight Access Control
* **Secure Session Cookies**: Protected by Edge-compliant middleware, preventing unauthorized access.
* **Dual Auth Modes**: Session-cookie authentication for dashboard users, and API key authentication (`x-api-key` / `Bearer` tokens) for external services.

---

## 🛠️ Technology Stack

* **Frontend/Core**: Next.js 16 (turbopack), React 19, TypeScript
* **Styling**: Tailwind CSS v4, Framer Motion, Shadcn UI
* **Database**: Prisma ORM, SQLite
* **SDK Integration**: z-ai-web-dev-sdk

---

## 🚀 Getting Started

### 1. Clone & Extract
Ensure the codebase is extracted to your workspace.

### 2. Setup Environment Variables
Configure your [.env](file:///.env) file:
```env
DATABASE_URL="file:./db/custom.db"
ADMIN_PASSWORD="admin"
GATEWAY_API_KEY="sk-gateway-demo-key-12345"
```

### 3. Install Dependencies
Install packages:
```bash
npm install
```

### 4. Push Database Schema
Create the SQLite database and generate the Prisma Client:
```bash
npx prisma db push
```

### 5. Run the Server
Launch the local Next.js development server:
```bash
npx next dev -p 3000
```
Open **`http://localhost:3000`** in your browser.

---

## 🔑 Access Credentials

* **Security Code**: `admin`
* **Recruiter Special Access**: Click the purple **"Quick Access for Recruiters"** button on the login screen to automatically fill credentials and log in instantly with animations.

---

## 🔌 API Integration (For External Applications)

External services can query the gateway securely using the `x-api-key` header:

```bash
curl -X POST http://localhost:3000/api/gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-gateway-demo-key-12345" \
  -d '{
    "input": "My API key is sk-proj-abc123DEF456 and email is john@example.com.",
    "dryRun": false
  }'
```
