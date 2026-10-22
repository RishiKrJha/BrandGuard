# BrandGuard AI Agent Operational Rulebook (AGENTS.md)

## 1. Prime Directives & Agent Execution Rules

1. **Architectural Confirmation:** You must ask for explicit confirmation from the human developer before executing any significant architectural modifications or deleting major files.

2. **Proactive Consultation:** Suggest the best modern approaches for specific tasks.

3. **No Conversational Filler:** Keep all outputs concise and focused entirely on code, terminal commands, or actionable questions.

## 2. Dependency & Environment Management

**CRITICAL RULE:** You are authorized to install the best packages required for the task, but you MUST strictly route them to the correct environments.

1. **Python Backend (Top-Level Venv with `uv`):**

   * A Python virtual environment is located at the top-level directory: `venv/`.
   * **You MUST use `uv` for package management.** Never use standard `pip`.
   * Before installing, ensure the environment is activated: `source venv/bin/activate`.
   * To install packages, use: `uv pip install <package_name>`.
   * You are authorized to install `fastapi`, `uvicorn`, `pydantic`, `chromadb`, `google-generativeai`, `python-multipart`, `pypdf`, and any necessary supporting libraries. Always update `backend/requirements.txt` after installing.

2. **Next.js Frontend:**

   * The frontend is located in the `frontend/` directory.
   * You MUST `cd frontend` before running any `npm install` commands.
   * You are authorized to install `lucide-react`, `framer-motion`, `clsx`, `tailwind-merge`, and any other modern React ecosystem packages required to build a high-quality UI.

3. **Transparency:** After running package installations, briefly list what was installed so the developer is aware.

## 3. Core Design Philosophy

BrandGuard is a "coach, not a filter."

* **Aesthetic:** Enterprise-grade, dark-themed, high-contrast, minimalist UI. Rely on spatial rhythm and subtle borders (`border-neutral-800`). No generic bubbly UI.

* **Layout Structure:** Dual-Panel Dashboard. Left Panel for drafting (text/images) with an "Audit Draft" trigger. Right Panel for explainable AI feedback.

* **Component Behaviors:** Violation Cards must show the flagged snippet, a direct citation from the brand book, an explanation, and a "1-Click Apply Fix" button.

## 4. Backend Architecture & RAG Grounding Rules

* **Tech Stack:** FastAPI, local ChromaDB, Google Gemini.

* **Strict RAG Enforcement:** The system prompt must explicitly restrict the LLM to evaluating the draft *only* against the retrieved chunks from ChromaDB. Zero hallucination allowed.

* **Lifespan Management:** FastAPI must use modern `lifespan` context managers. Do not use deprecated `@app.on_event`.

* **API Contracts:** All endpoints must return structured, validated Pydantic v2 JSON models.

## 5. Local Skills Enforcement

You MUST abide by the local directives in `skills-lock.json`:

* **`frontend-design`:** Drive the visual aesthetics and Tailwind utility classes.
* **`vercel-react-best-practices`:** Enforce Next.js App Router patterns and strict typing.
* **`improve-codebase-architecture`:** Keep FastAPI routers, services, and models strictly decoupled.
* **`tdd`:** Suggest minimal, focused tests before locking in endpoints.

## 6. Detailed Project Structure

Maintain this structure. Do not create new top-level directories without permission.

```text
BrandGuard/
├── venv/                              # Top-level Python Virtual Environment (uv)
├── backend/                           
│   ├── app/
│   │   ├── api/                       
│   │   │   ├── routers/ (audit.py, ingest.py, health.py)
│   │   │   └── dependencies.py        
│   │   ├── core/ (config.py, lifespan.py)
│   │   ├── models/ (schemas.py)
│   │   ├── services/ (llm_service.py, vector_store.py, document_parser.py)
│   │   └── main.py                    
│   ├── tests/                         
│   └── requirements.txt               
├── frontend/                          
│   ├── src/app/ 
│   ├── src/components/ 
│   ├── src/lib/ 
│   ├── tailwind.config.ts             
│   └── package.json                   
├── skills-lock.json                   
└── AGENTS.md                          
```