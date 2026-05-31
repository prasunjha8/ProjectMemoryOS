# ProjectMemoryOS

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI Pipeline](https://github.com/prasunjha8/ProjectMemoryOS/actions/workflows/ci.yml/badge.svg)](https://github.com/prasunjha8/ProjectMemoryOS/actions/workflows/ci.yml)
[![FastAPI Backend](https://img.shields.io/badge/Backend-FastAPI-green)](https://fastapi.tiangolo.com/)
[![Next.js Frontend](https://img.shields.io/badge/Frontend-Next.js%2015-black)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-blue)](https://supabase.com)

**ProjectMemoryOS** is an open-source, production-grade engineering memory and project intelligence platform. It transforms fragmented, ephemeral AI conversations (Claude, ChatGPT, Gemini, DeepSeek) and technical docs into a unified, persistent, and semantically searchable cognition layer. 

Built for developers, AI engineers, robotics teams, and researchers, ProjectMemoryOS solves the problem of *context fragmentation* caused by switching between models, strict token windows, and disconnected engineering sessions.

---

## 🌌 The Vision
Modern engineering involves a fragmented stack of intelligence. A developer starts a task in Claude, debugs in ChatGPT, plans architecture on a whiteboard, and tracks tasks in Jira. When token limits are hit or context is cleared, valuable technical decisions, recurring bugs, and design context are lost forever.

ProjectMemoryOS acts as a **Memory Operating System** for your projects. Instead of isolated chat history, it synthesizes every discussion, markdown file, and PDF document into a cohesive, structured graph of project evolution, auto-extracting tasks, linking dependencies, and keeping you oriented from the second you resume work.

---

## 🛠️ Implemented Systems

### 1. Resume Context Engine (Project Continuity)
Instantly re-orient yourself after returning to a project. When you open a project dashboard, the Resume Context Engine queries recent timelines, open tasks, and active blockers to generate:
* **Current Project State Summary**: An LLM-synthesized narrative of where the project stands.
* **Blocker Analysis**: Active obstacles that are halting progress.
* **Next-Step Synthesis**: Dynamically generated actionable recommendations based on past chat logic.
* **Timeline Synthesis**: An chronological audit trail of recent updates and discussion themes.

### 2. Conversation Relationship Intelligence (Pattern Detection)
Automatically identifies conceptual linkages and connections between different chats using pgvector similarity metrics and OpenRouter LLM classifications:
* **Recurring Bug Tracking**: Matches current errors with previous discussions (e.g., *"This Docker OOM issue was discussed in Chat A, and a memory limit was recommended"*).
* **Linked Engineering Discussions**: Flags follow-up architectures, decision evolutions, and conceptual continuities.
* **Confidence Scoring**: Each relationship is mapped with a confidence score and a detailed AI reasoning snippet.

### 3. Project Evolution Engine (Milestone Compression)
Compresses long, complex architectural iterations into milestone summaries. It captures the trajectory of your project over days or weeks, distilling key insights and design pivots to combat information overload.

### 4. Semantic Search & Vector Pipeline
* **Local Embedding Engine**: Generates 384-dimensional dense vectors locally using `all-MiniLM-L6-v2` via `sentence-transformers` (zero API dependencies for vector math).
* **HNSW Indexing**: Uses highly optimized Hierarchical Navigable Small World (HNSW) index structures in PostgreSQL (via pgvector) for rapid cosine similarity queries.
* **Universal Parser**: Integrates extraction engines for plain text, Markdown logs, PDFs, and JSON chat transcripts (ChatGPT and Claude exports).

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% Clients
    User([Developer / Builder]) <-->|Interacts| NextJS[Next.js 15 Frontend / Vercel]
    
    %% API Gateways
    NextJS <-->|HTTPS / JSON / WSS| FastAPI[FastAPI Backend / Railway]
    
    %% Backend Services
    subgraph FastAPI Container [FastAPI Backend Service]
        Auth[Security & JWT Verifier] --> API[FastAPI Routers]
        API --> Parser[Parser Service: PDF, MD, JSON]
        API --> Embedding[Embedding Service: sentence-transformers]
        API --> AIService[AI Service: OpenRouter Adapter]
        API --> DbPool[SQLAlchemy Async Connection Pool]
    end
    
    %% External Infrastructure
    AIService <-->|BYOK / API Calls| OpenRouter[OpenRouter / Gemini 2.5]
    DbPool <-->|SSL / transaction pooler: 6543| Supabase[Supabase PostgreSQL + pgvector]
    NextJS <-->|Direct Auth & Metadata Sync| SupabaseAuth[Supabase Auth Registry]
    
    %% Databases
    subgraph Supabase Instance [Supabase Cloud Database]
        SupabaseAuth -->|Trigger syncs profiles| ProfilesTable[(profiles)]
        Supabase --> ProfilesTable
        Supabase --> ProjectsTable[(projects)]
        Supabase --> ConvTable[(conversations)]
        Supabase --> ChunkTable[(conversation_chunks + HNSW Vector Index)]
        Supabase --> RelationshipTable[(conversation_relationships)]
        Supabase --> SummaryTable[(summaries)]
        Supabase --> TaskTable[(tasks)]
    end
```

---

## 💻 Tech Stack
* **Frontend**: Next.js 15 (App Router, React 19), TypeScript, TailwindCSS v4, Zustand (state stores).
* **Backend**: FastAPI (Python 3.12+), SQLAlchemy 2.0 (async), `asyncpg`, `pgvector`, `sentence-transformers`, `slowapi` (rate limiter), `sentry-sdk` (monitoring).
* **Database**: PostgreSQL with `pgvector` hosted on Supabase (leveraging custom SQL triggers for user registration sync).
* **Deployment & CI**: Vercel (frontend), Railway (backend), GitHub Actions (monorepo linting, Next.js build validation, python import checking).

---

## 📂 Repository Folder Structure

```
projectos/
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions monorepo CI/CD checks
├── backend/
│   ├── app/
│   │   ├── api/                  # API routing endpoints
│   │   │   ├── middleware.py     # SlowAPI, Payload Limiters & Upload checks
│   │   │   ├── router.py         # Root router registration
│   │   │   └── v1/               # Versioned endpoint controllers
│   │   ├── core/                 # Core configs, database pools, logging
│   │   │   ├── config.py         # Pydantic Settings config loader
│   │   │   ├── database.py       # SQLAlchemy engine & pooling settings
│   │   │   ├── env_validator.py  # Boot-time environment diagnostics
│   │   │   ├── logging_config.py # Structured JSON logger & request tracing
│   │   │   └── security.py       # Supabase JWT token verification
│   │   ├── models/               # SQLAlchemy 2.0 ORM schemas
│   │   ├── schemas/              # Pydantic request/response validators
│   │   ├── services/             # Parser, Embedding & OpenRouter AI services
│   │   └── main.py               # FastAPI entry point
│   ├── Dockerfile                # Hardened non-root production Docker image
│   ├── railway.json              # Railway custom build/healthcheck settings
│   └── requirements.txt          # Python package list
├── database/
│   └── schema.sql                # Complete database schemas (DDL, Indexes, Triggers)
├── frontend/
│   ├── app/                      # Next.js App Router (Dashboard, Kanban, Chat UI)
│   ├── components/               # React UI modules (Resume cards, related chats)
│   ├── lib/                      # Supabase Client & api-client.ts HTTP wrapper
│   ├── store/                    # Zustand client state stores
│   ├── vercel.json               # Vercel security headers configuration
│   └── eslint.config.mjs         # Flat-format ESLint config
├── .gitignore                    # Root monorepo Git ignore file
└── README.md                     # Flagship documentation
```

---

## 🔑 Environment Configuration

### Backend Environment Variables (`backend/.env`)
Create a `backend/.env` file with the following variables:

```ini
ENVIRONMENT=development
PORT=8000
HOST=0.0.0.0

# Database Configuration (Supabase Connection string with pooler port 6543)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_RECYCLE=1800

# Supabase Auth Configuration
SUPABASE_URL=https://[YOUR_REF].supabase.co
# Found in Settings -> API -> JWT Settings -> JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# OpenRouter Settings (Bring Your Own Key)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemini-2.5-flash

# Embeddings Configuration
# Set to true to disable loading PyTorch/sentence-transformers locally.
# This reduces container RAM requirements from ~500MB+ to <100MB, preventing OOMs.
# Uses Hugging Face Inference API as a fallback when disabled.
DISABLE_LOCAL_EMBEDDINGS=false
# Optional: Hugging Face API Token for higher rate limits (if using API fallback)
HF_API_TOKEN=your-huggingface-token

# Optional Observability
SENTRY_DSN=your-sentry-dsn
RATE_LIMIT_PER_MINUTE=60
ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
```

### Frontend Environment Variables (`frontend/.env.local`)
Create a `frontend/.env.local` file:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 🚀 Setup & Installation (Self-Hosting / Local)

### Prerequisites
* Python 3.12+
* Node.js 20+
* Supabase Account (Free tier is sufficient)

### 1. Database Provisioning
1. Create a project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in the Supabase Dashboard, create a new query, paste the contents of **[schema.sql](file:///Users/prasunjha/Desktop/projectos/database/schema.sql)**, and click **Run**.
3. This creates all tables, optimized HNSW pgvector indexes, and the database trigger that automatically syncs newly registered users from Supabase Auth to your user profiles schema.

### 2. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `backend/.env.example` to `backend/.env` and fill in your variables.
5. Run the server in development mode:
   ```bash
   python app/main.py
   ```
   Interactive Swagger documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Frontend Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Copy `frontend/.env.example` to `frontend/.env.local` and enter your Supabase keys.
4. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Production Deployment

### Backend (Railway)
This project is configured with a custom `railway.json` and Docker container settings.

> [!TIP]
> **RAM Allocation & OOM Prevention**: By default, the backend runs embedding models locally on CPU, which requires **500MB - 1GB RAM**. If you are deploying on a free tier (such as the default 500MB Railway free container), set `DISABLE_LOCAL_EMBEDDINGS=true` in your environment variables. This skips loading the heavy PyTorch runtime locally, keeping memory usage **under 100MB** while falling back to the Hugging Face Inference API for vector math.

1. Deploy the `backend/` subdirectory from your repository on Railway.
2. In your Railway service variables panel, set the variables listed in the backend env checklist above. Ensure `ENVIRONMENT` is set to `production` (this automatically disables Swagger docs and file reloading).

### Frontend (Vercel)
1. Deploy the `frontend/` subdirectory on Vercel.
2. Add your `NEXT_PUBLIC_` environment variables under Vercel configuration settings. Ensure `NEXT_PUBLIC_API_URL` points to your deployed Railway endpoint (e.g. `https://your-backend.up.railway.app/api/v1`).

---

## 🔒 Security Hardening
ProjectMemoryOS implements strict security practices to run safely in production:
* **Strict CORS**: Origins are bound directly to your Vercel domains via the `ALLOWED_ORIGINS` settings array.
* **Upload Gatekeeper**: The `ContentLengthLimitMiddleware` blocks uploads larger than 15MB at the TCP network layer before the server allocates memory for streaming.
* **Payload Verification**: Upstream files are validated by magic byte checking (e.g., verifying `%PDF` signatures for PDFs) to block malicious executables disguised with fake extensions.
* **Token Hardening**: Integrates standard verification of Supabase JWT bearer signatures using `PyJWT` (HS256) for all service requests.
* **Rate Limiting**: Integrated `SlowAPI` to prevent brute force API scans and resource abuse.

---

## 📈 Future Roadmap
1. **GPU Acceleration**: Add automatic CUDA/MPS hardware detection to accelerate local embedding generation.
2. **Hybrid Search (RRF)**: Implement Reciprocal Rank Fusion (RRF) combining vector similarity scores and fuzzy text indices (BM25) for optimal context retrieval.
3. **WebSockets Support**: Switch from polling to WebSockets for real-time analysis status updates during ingestion pipelines.
4. **Offline Local LLMs**: Add support for local Ollama/Llama.cpp model orchestration to remove third-party LLM API dependencies entirely.

---

## 🤝 Contributing
Contributions are welcome! Please follow these guidelines:
1. Fork the repository and create a feature branch.
2. Ensure linting passes locally (`npm run lint` in frontend).
3. Open a detailed Pull Request detailing the changes and verification steps.

---

## 📄 License
ProjectMemoryOS is licensed under the MIT License. See [LICENSE](LICENSE) for more information.
