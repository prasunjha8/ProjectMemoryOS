# Project Memory OS

Project Memory OS is an intelligent, developer-focused workspace application that acts as a long-term "Memory Operating System" for technical projects. It solves the problem of context fragmentation across LLM chat windows (Claude, GPT, Gemini, DeepSeek) by preserving logs, extracting actionable task lists, and enabling vector-based semantic search over historical discussions.

---

## Technical Stack & Architecture

### Frontend
* **Framework**: Next.js 15 (App Router, React 19)
* **Language**: TypeScript
* **Styling**: TailwindCSS v4 (Curated sleek dark theme, glassmorphism UI elements, smooth micro-animations)
* **State Management**: Zustand (Auth, Projects, Conversations, and Tasks stores)

### Backend
* **Framework**: FastAPI (Asynchronous Python 3.14+)
* **Database Connectors**: SQLAlchemy 2.0 (async mappings) + `asyncpg` + `pgvector`
* **NLP & Vector Embeddings**: Sentence-Transformers (local model `all-MiniLM-L6-v2` producing 384d vectors)
* **File Parsers**: `PyPDF2` (for PDF text extractors), standard Markdown parsing, and JSON tree parsers (handling Claude & ChatGPT JSON exports)

### Database
* **Database**: PostgreSQL (via Supabase)
* **Vector Extensions**: `pgvector` (HNSW indexing for high-dimensional cosine similarity searches)
* **User Authentication**: Supabase Auth (Integrated directly with custom SQL triggers populating user profile metadata tables)

---

## Repository Directory Structure

```
projectos/
├── backend/
│   ├── app/
│   │   ├── api/                  # API routing endpoints
│   │   │   ├── v1/
│   │   │   │   ├── projects.py   # Project listings & management
│   │   │   │   ├── conversations.py # Chat ingestion & background tasks
│   │   │   │   ├── tasks.py      # Task updates and deletions
│   │   │   │   └── search.py     # pgvector semantic query search
│   │   │   └── router.py         # Router registration
│   │   ├── core/                 # Configurations, Security, Database
│   │   │   ├── config.py         # Pydantic Settings env loader
│   │   │   ├── database.py       # Async engine & session helper
│   │   │   └── security.py       # Supabase JWT token verification
│   │   ├── models/               # SQLAlchemy 2.0 entities (Database schemas)
│   │   ├── schemas/              # Pydantic schemas (Request/Response validation)
│   │   ├── services/             # Core business logic services
│   │   │   ├── ai_service.py     # OpenRouter connection and JSON schema extraction
│   │   │   ├── embedding_service.py # Chunker and SentenceTransformers embeddings
│   │   │   └── parser_service.py # PDF/Markdown/JSON chat files parsers
│   │   └── main.py               # FastAPI entry point
│   ├── requirements.txt          # Pip package requirements
│   ├── .env.example              # Backend environment template
│   └── venv/                     # Python virtual environment
├── database/
│   └── schema.sql                # Complete database schemas (DDL, Indexes, Triggers)
└── frontend/
    ├── app/                      # Next.js App Router folders
    │   ├── dashboard/            # Authed workspace boards
    │   │   ├── project/
    │   │   │   └── [projectId]/
    │   │   │       ├── page.tsx  # Ingestion logs listing
    │   │   │       ├── chat/     # Perplexity-style semantic search
    │   │   │       └── tasks/    # Kanban action board
    │   │   ├── layout.tsx        # Workspace sidebar navigation
    │   │   └── page.tsx          # Overview stats hub
    │   ├── globals.css           # Tailwind v4 directives and glow styles
    │   ├── layout.tsx            # Main layout wrapper
    │   └── page.tsx              # Landing & Login card
    ├── lib/                      # Supabase client singleton configurations
    ├── store/                    # Zustand auth/project/chat/task stores
    ├── package.json              # npm package dependencies
    └── .env.example              # Frontend environment template
```

---

## Setup & Running Guide

### 1. Database Setup (Supabase)
1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** in the left sidebar.
3. Open a new query tab, copy the entire contents of `database/schema.sql` into the editor, and click **Run**.
4. This script will:
   * Enable the required database extensions (`uuid-ossp` and `vector`).
   * Create the tables (`profiles`, `projects`, `conversations`, `conversation_chunks`, `summaries`, `tasks`, `tags`, `conversation_tags`, `sessions`).
   * Apply optimized database indexes, including the **HNSW index** on the vector column for accelerated cosine similarity lookups.
   * Enable security triggers that automatically map user profiles from Supabase Auth registries upon initial sign-up.

### 2. Backend Setup
1. Open a terminal, change directory to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Copy the environment template and name it `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in the required credentials:
   * `DATABASE_URL`: Your Supabase connection string.
   * `SUPABASE_JWT_SECRET`: Found in Supabase Dashboard -> Settings -> API -> JWT Secret. Used for secure local token decoding.
   * `OPENROUTER_API_KEY`: Your OpenRouter API Key (to enable live AI summaries and task extraction).
4. Run the FastAPI development server:
   ```bash
   ./venv/bin/uvicorn app.main:app --reload
   ```
   The backend API will run on [http://localhost:8000](http://localhost:8000). You can access interactive documentation (Swagger UI) at [http://localhost:8000/docs](http://localhost:8000/docs).


### 3. Frontend Setup
1. Open a new terminal, change directory to the `frontend/` folder:
   ```bash
   cd ../frontend
   ```
2. Copy the environment template and name it `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Open `.env.local` and enter your Supabase URL and Anon Key.
4. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   The frontend will boot on [http://localhost:3000](http://localhost:3000).

---

## Developer Mock Mode (Offline Testing)

To ensure a seamless local development experience and enable immediate offline previewing:
* If the frontend `.env.local` file is missing or if Supabase keys are left empty, the application **automatically detects this and switches into Developer Mock Mode**.
* When active, you can sign in by typing any email address (no password required).
* The Zustand stores will simulate all backend tasks locally using `localStorage`:
  * You can create and delete projects.
  * You can paste conversation transcripts or upload mock logs. The uploader UI will show a live "Processing" status and transition to "Ready" after 2 seconds.
  * The store will automatically inject simulated AI Summaries, Key Takeaways, Technical Insights, and create matching board Tasks from the uploaded conversation context.
  * You can test the Perplexity-style **Semantic Search** board by typing keywords like "RTOS", "trajectory", or "pgvector" to see vector distance matching results.
  * You can interact with the **Kanban Task Board**, shifting card columns (Todo, In Progress, Blocked, Completed) or manually creating inline tasks.

---

## Scalability & Production Roadmap

1. **Local Embeddings GPU Acceleration**:
   * For self-hosted backend deployments, `sentence-transformers` automatically detects and uses CUDA (Nvidia GPU) or Metal Performance Shaders (Apple Silicon MPS) to accelerate embedding generation.
2. **Hybrid Search Re-ranking (RRF)**:
   * In future versions, we can implement **Reciprocal Rank Fusion (RRF)** on the search router. This merges vector scores and text-matching indexes to produce a single, optimal context-matching sequence.
3. **Chunk Segmentation Optimization**:
   * Currently, the system uses semantic paragraph-based splitting. We can add semantic splitter logic that computes differences between consecutive sentences and chunks only when the thematic coherence drops below a threshold.
4. **WebSocket/SSE status updates**:
   * While polling `/conversations/{id}` is highly reliable and lightweight for V1, we can implement Server-Sent Events (SSE) or WebSockets in FastAPI for real-time notification streams.

---

## Production Deployment

This project is prepared for single-command deployments on public clouds: **Vercel** (frontend), **Railway** (backend), and **Supabase** (database).

### 1. Database (Supabase PostgreSQL)
1. Provision a new project on [Supabase](https://supabase.com).
2. Execute the entire SQL schema in `database/schema.sql` inside the **SQL Editor** on your Supabase dashboard to set up all tables, indexes, and user-registration triggers.
3. Locate your connection details under **Project Settings -> API** and **Project Settings -> Database**.

### 2. Backend API (Railway + Docker)
The backend container is defined by `backend/Dockerfile` and configured via `backend/railway.json`.

> [!IMPORTANT]
> **RAM Provisioning**: The backend downloads and runs `sentence-transformers` locally, which requires a minimum of **1GB to 2GB of RAM**. Select an instance tier that provides at least 1GB - 2GB RAM on Railway (or Render) to avoid Out-Of-Memory (OOM) app crashes during model loading.

1. Log in to [Railway](https://railway.app) and create a **New Project** linked to your GitHub repository.
2. Select the `backend` subdirectory. Railway will detect the `Dockerfile` and build it automatically.
3. Add the following **Environment Variables** in Railway service settings:
   - `ENVIRONMENT`: `production` (disables auto-reloader and swagger docs for security)
   - `DATABASE_URL`: Your Supabase PostgreSQL Connection URL (use port `6543` for connection pooling)
   - `SUPABASE_URL`: Your Supabase API project URL
   - `SUPABASE_JWT_SECRET`: Secret JWT key (found in Supabase API settings)
   - `OPENROUTER_API_KEY`: Your OpenRouter API token
   - `OPENROUTER_MODEL`: LLM model name (defaults to `google/gemini-2.5-flash`)
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://your-app.vercel.app`)

### 3. Frontend UI (Vercel)
The frontend uses Next.js 16 and is configured via `frontend/vercel.json` to enforce strict production security headers.

1. Log in to [Vercel](https://vercel.com) and click **Add New -> Project**.
2. Select your repository and set the root directory to `frontend`.
3. Set the following **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon public key
   - `NEXT_PUBLIC_API_URL`: Deployed URL of your backend (e.g. `https://your-backend-production.up.railway.app/api/v1`)
4. Click **Deploy**. Vercel will optimize and host the App Router build.

### 4. CI/CD Pipeline (GitHub Actions)
The repository includes a GitHub CI workflow (`.github/workflows/ci.yml`) that triggers on every pull request and push to the main branches.
It automatically validates that:
* The Next.js frontend compiles cleanly under TypeScript.
* The FastAPI backend's dependencies and core modules import successfully.

