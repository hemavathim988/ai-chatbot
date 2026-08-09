# AI Document Search (RAG Chatbot) — Free Stack

Chat with PDFs using an LLM + semantic search (RAG — Retrieval-Augmented Generation).
This version runs at **$0 cost** — no credit card required anywhere.

## Stack
- **Frontend:** React, Tailwind CSS, Vite
- **Backend:** FastAPI
- **AI:** Groq (free API, Llama 3.1) for answers, HuggingFace `sentence-transformers` (runs locally) for embeddings
- **Vector DB:** FAISS
- **Deploy:** Vercel (frontend) + Render/Railway or Docker (backend)

## How it works
1. User uploads a PDF.
2. Backend extracts text, splits it into overlapping chunks.
3. Each chunk is embedded into a vector **locally on your machine** (no API call) using a small HuggingFace model, and stored in a FAISS index per upload session.
4. User asks a question → the question is embedded the same way → FAISS finds the most similar chunks.
5. Those chunks + the question are sent to Groq's free LLM API, which generates a grounded answer.

## Getting your free Groq API key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (no credit card needed)
3. Go to **API Keys** in the left sidebar → **Create API Key**
4. Copy the key immediately — it's shown once

## Local Setup

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then paste your GROQ_API_KEY
uvicorn main:app --reload
```
First run will download the small embedding model (~90MB) — this only happens once.
Backend runs at `http://localhost:8000`. Visit `/docs` for interactive API docs.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env            # defaults to localhost:8000, edit if needed
npm run dev
```
Frontend runs at `http://localhost:5173`.

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload a PDF, returns a `session_id` |
| POST | `/chat` | Send `{session_id, query}`, returns `{answer, sources}` |
| DELETE | `/session/{session_id}` | Clear a session from memory |

## Deployment

**Backend (Render/Railway):**
- Push this repo to GitHub
- Create a new Web Service, point it at `backend/`
- Set environment variable `GROQ_API_KEY`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Note: the embedding model download + load adds ~30-60s to first startup on free-tier hosting

**Backend (Docker):**
```bash
cd backend
docker build -t ai-pdf-chatbot-backend .
docker run -p 8000:8000 --env-file .env ai-pdf-chatbot-backend
```

**Frontend (Vercel):**
- Import the repo, set root directory to `frontend/`
- Add environment variable `VITE_API_URL` pointing to your deployed backend URL

## Known Limitations
- Scanned/image-only PDFs won't extract text (would need OCR, e.g. Tesseract, to support)
- Sessions are stored in memory — restarting the backend clears all uploaded documents
- No authentication — fine for a demo, add auth before any real multi-user use
- Groq's free tier has a rate limit (requests per minute) — fine for personal/demo use, not for high traffic

## Possible Extensions
- Swap FAISS for Pinecone/Chroma for persistent, scalable storage
- Add OCR support for scanned PDFs
- Support multiple file formats (docx, txt)
- Add chat history persistence per user
- Stream LLM responses token-by-token
- Swap Groq for OpenAI if you want a paid, more polished-answer option later
