# BrandGuard

> **"A coach, not a filter."**  
> Enterprise-grade brand governance platform powered by multimodal AI and Retrieval-Augmented Generation (RAG).

BrandGuard evaluates marketing copy and creative drafts strictly against official brand guidelines stored in ChromaDB, flagging voice, tone, positioning, and terminology violations with direct citations, clear explanations, and 1-click remediation.

---

## Architecture & Tech Stack

```text
BrandGuard/
├── venv/                              # Python Virtual Environment (uv)
├── backend/                           # FastAPI Application
│   ├── app/
│   │   ├── api/                       # API routers (audit.py, guidelines.py, health.py)
│   │   ├── core/                      # Config (pydantic-settings), Lifespan context manager
│   │   ├── models/                    # Pydantic v2 schemas
│   │   ├── services/                  # RAG auditor, ChromaDB vector store, document parser
│   │   └── main.py                    # Application entrypoint & CORS middleware
│   ├── tests/                         # Pytest test suite (unit & integration)
│   └── requirements.txt               # Backend dependencies for production deployment
├── frontend/                          # Next.js 16 App Router UI
│   ├── src/
│   │   ├── app/                       # App Router (page.tsx RSC shell, layout.tsx)
│   │   ├── components/                # AuditWorkspace, EditorPanel, FeedbackPanel
│   │   └── lib/                       # apiFetch client utility, Tailwind utils
│   ├── tailwind.config.ts             # Dark-themed enterprise design system
│   └── package.json                   # Frontend dependencies
├── .env.example                       # Backend environment template
├── skills-lock.json
└── README.md
```

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/), [ChromaDB](https://www.trychroma.com/), [Google Gemini](https://ai.google.dev/) via `google-generativeai`.
- **Frontend:** [Next.js](https://nextjs.org/) (App Router & React Server Components), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/).
- **Package Managers:** [`uv`](https://docs.astral.sh/uv/) for Python backend, `npm` for Next.js frontend.

---

## Security & Pre-Deployment Audit

BrandGuard adheres to strict production security standards:
- **Zero Secret Leaks:** No API keys, credentials, or private keys are tracked in git history or committed in source code.
- **Git Hygiene:** Local vector store files (`chroma_data/`, `data/`), `.env` files, and virtual environments (`venv/`, `node_modules/`) are strictly ignored via `.gitignore`.
- **CORS Hardening:** FastAPI CORS middleware is restricted to local dev origins (`http://localhost:3000`), Vercel preview/production domains (`https://*.vercel.app`), and any custom domains specified in `ALLOWED_ORIGINS`.

---

## Local Development Setup

### 1. Backend (FastAPI + uv)

```bash
# 1. Activate the Python virtual environment
source venv/bin/activate

# 2. Install dependencies using uv
uv pip install -r backend/requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY

# 4. Run tests
pytest

# 5. Start the FastAPI development server
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`. Swagger documentation is accessible at `http://localhost:8000/docs`.

### 2. Frontend (Next.js)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional for local dev; defaults to localhost)
cp .env.example .env.local

# 4. Start Next.js development server
npm run dev
```

The frontend dashboard will be available at `http://localhost:3000`.

---

## Deployment Guide

### A. Deploy FastAPI Backend on Render

Render hosts the FastAPI service as a Python Web Service.

#### 1. Exporting Dependencies (if using `uv`)
To export or refresh locked dependencies into a standard `requirements.txt` for Render:
```bash
uv pip freeze > backend/requirements.txt
```
*(The repository already includes a validated, complete `backend/requirements.txt` ready for production).*

#### 2. Render Web Service Configuration
- **Environment:** `Python 3` (Render supports Python 3.12+ via `PYTHON_VERSION=3.12.3`)
- **Root Directory:** *(leave blank / repository root `.`)*
- **Build Command:**
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Start Command:**
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
  ```

#### 3. Render Environment Variables
Add the following key-value pairs in the **Environment** tab on Render:

| Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-pro` |
| `ENVIRONMENT` | Deployment environment | `production` |
| `DEBUG` | FastAPI debug mode | `false` |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB persistence path | `./data/chroma` |
| `CHROMA_COLLECTION_NAME` | ChromaDB collection name | `brand_guidelines` |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000,https://your-brandguard.vercel.app` |
| `PYTHON_VERSION` | Python runtime version on Render | `3.12.3` |

> **Note on ChromaDB Persistence:** On Render free instances, local storage is ephemeral. For production persistence of uploaded guidelines across container restarts, attach a **Render Disk** mounted to `/var/data` and set `CHROMA_PERSIST_DIRECTORY=/var/data/chroma`.

---

### B. Deploy Next.js Frontend on Vercel

Vercel provides native zero-configuration deployments for Next.js App Router.

#### 1. Vercel Project Settings
- **Framework Preset:** `Next.js`
- **Root Directory:** `frontend`
- **Build Command:** `npm run build` *(or leave default `next build`)*
- **Output Directory:** `.next` *(automatically configured)*
- **Install Command:** `npm install`

#### 2. Vercel Environment Variables
Add the following in the **Environment Variables** tab on Vercel (Production, Preview, and Development):

| Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of your deployed Render backend | `https://brandguard-backend.onrender.com` |

> **Self-Healing URL Resolution:** `frontend/src/lib/api.ts` automatically cleans trailing slashes and ensures the `/api` prefix is attached, whether you input `https://your-service.onrender.com` or `https://your-service.onrender.com/api`.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/health` | Service health status and ChromaDB connectivity check |
| `POST` | `/api/audit/scan` | Audit draft copy against RAG guideline chunks with Gemini |
| `POST` | `/api/guidelines/upload` | Ingest and chunk brand guideline PDF/TXT/MD into ChromaDB |
| `GET` | `/api/guidelines/stats` | Retrieve total guideline chunks and vector index status |

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

> **"A coach, not a filter."**  
> Enterprise-grade brand governance platform powered by multimodal AI and Retrieval-Augmented Generation (RAG).

BrandGuard evaluates marketing copy and creative drafts strictly against official brand guidelines stored in ChromaDB, flagging voice, tone, positioning, and terminology violations with direct citations, clear explanations, and 1-click remediation.

---

## Architecture & Tech Stack

```text
BrandGuard/
├── venv/                              # Python Virtual Environment (uv)
├── backend/                           # FastAPI Application
│   ├── app/
│   │   ├── api/                       # API routers (audit.py, guidelines.py, health.py)
│   │   ├── core/                      # Config (pydantic-settings), Lifespan context manager
│   │   ├── models/                    # Pydantic v2 schemas
│   │   ├── services/                  # RAG auditor, ChromaDB vector store, document parser
│   │   └── main.py                    # Application entrypoint & CORS middleware
│   ├── tests/                         # Pytest test suite (unit & integration)
│   └── requirements.txt               # Backend dependencies for production deployment
├── frontend/                          # Next.js 16 App Router UI
│   ├── src/
│   │   ├── app/                       # App Router (page.tsx RSC shell, layout.tsx)
│   │   ├── components/                # AuditWorkspace, EditorPanel, FeedbackPanel
│   │   └── lib/                       # apiFetch client utility, Tailwind utils
│   ├── tailwind.config.ts             # Dark-themed enterprise design system
│   └── package.json                   # Frontend dependencies
├── .env.example                       # Backend environment template
├── skills-lock.json
└── README.md
```

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/), [ChromaDB](https://www.trychroma.com/), [Google Gemini](https://ai.google.dev/) via `google-generativeai`.
- **Frontend:** [Next.js](https://nextjs.org/) (App Router & React Server Components), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/).
- **Package Managers:** [`uv`](https://docs.astral.sh/uv/) for Python backend, `npm` for Next.js frontend.

---

## Security & Pre-Deployment Audit

BrandGuard adheres to strict production security standards:
- **Zero Secret Leaks:** No API keys, credentials, or private keys are tracked in git history or committed in source code.
- **Git Hygiene:** Local vector store files (`chroma_data/`, `data/`), `.env` files, and virtual environments (`venv/`, `node_modules/`) are strictly ignored via `.gitignore`.
- **CORS Hardening:** FastAPI CORS middleware is restricted to local dev origins (`http://localhost:3000`), Vercel preview/production domains (`https://*.vercel.app`), and any custom domains specified in `ALLOWED_ORIGINS`.

---

## Local Development Setup

### 1. Backend (FastAPI + uv)

```bash
# 1. Activate the Python virtual environment
source venv/bin/activate

# 2. Install dependencies using uv
uv pip install -r backend/requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY

# 4. Run tests
pytest

# 5. Start the FastAPI development server
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`. Swagger documentation is accessible at `http://localhost:8000/docs`.

### 2. Frontend (Next.js)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional for local dev; defaults to localhost)
cp .env.example .env.local

# 4. Start Next.js development server
npm run dev
```

The frontend dashboard will be available at `http://localhost:3000`.

---

## Deployment Guide

### A. Deploy FastAPI Backend on Render

Render hosts the FastAPI service as a Python Web Service.

#### 1. Exporting Dependencies (if using `uv`)
To export or refresh locked dependencies into a standard `requirements.txt` for Render:
```bash
uv pip freeze > backend/requirements.txt
```
*(The repository already includes a validated, complete `backend/requirements.txt` ready for production).*

#### 2. Render Web Service Configuration
- **Environment:** `Python 3` (Render supports Python 3.12+ via `PYTHON_VERSION=3.12.3`)
- **Root Directory:** *(leave blank / repository root `.`)*
- **Build Command:**
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Start Command:**
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
  ```

#### 3. Render Environment Variables
Add the following key-value pairs in the **Environment** tab on Render:

| Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-pro` |
| `ENVIRONMENT` | Deployment environment | `production` |
| `DEBUG` | FastAPI debug mode | `false` |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB persistence path | `./data/chroma` |
| `CHROMA_COLLECTION_NAME` | ChromaDB collection name | `brand_guidelines` |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000,https://your-brandguard.vercel.app` |
| `PYTHON_VERSION` | Python runtime version on Render | `3.12.3` |

> **Note on ChromaDB Persistence:** On Render free instances, local storage is ephemeral. For production persistence of uploaded guidelines across container restarts, attach a **Render Disk** mounted to `/var/data` and set `CHROMA_PERSIST_DIRECTORY=/var/data/chroma`.

---

### B. Deploy Next.js Frontend on Vercel

Vercel provides native zero-configuration deployments for Next.js App Router.

#### 1. Vercel Project Settings
- **Framework Preset:** `Next.js`
- **Root Directory:** `frontend`
- **Build Command:** `npm run build` *(or leave default `next build`)*
- **Output Directory:** `.next` *(automatically configured)*
- **Install Command:** `npm install`

#### 2. Vercel Environment Variables
Add the following in the **Environment Variables** tab on Vercel (Production, Preview, and Development):

| Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of your deployed Render backend | `https://brandguard-backend.onrender.com` |

> **Self-Healing URL Resolution:** `frontend/src/lib/api.ts` automatically cleans trailing slashes and ensures the `/api` prefix is attached, whether you input `https://your-service.onrender.com` or `https://your-service.onrender.com/api`.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/health` | Service health status and ChromaDB connectivity check |
| `POST` | `/api/audit/scan` | Audit draft copy against RAG guideline chunks with Gemini |
| `POST` | `/api/guidelines/upload` | Ingest and chunk brand guideline PDF/TXT/MD into ChromaDB |
| `GET` | `/api/guidelines/stats` | Retrieve total guideline chunks and vector index status |

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

