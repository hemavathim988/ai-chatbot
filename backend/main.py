"""
AI Document Search (RAG Chatbot) - Backend
Chat with PDFs using LLM + semantic search

Stack: FastAPI, LangChain, Groq (free LLM API), HuggingFace (free local embeddings), FAISS

This version runs at $0 cost:
- Embeddings run locally on your machine via sentence-transformers (no API call)
- The LLM call uses Groq's free API tier (no credit card required)
"""

import os
import uuid
import shutil
from typing import Dict

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from pypdf import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA

load_dotenv()

if not os.getenv("GROQ_API_KEY"):
    print("WARNING: GROQ_API_KEY not set. Set it in a .env file before using /chat.")

app = FastAPI(title="AI PDF Chatbot API (Free Stack)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store of vectorstores keyed by session_id.
# Fine for a student/demo project. For production, persist to disk or a DB.
SESSIONS: Dict[str, FAISS] = {}

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load the embedding model once at startup, not per-request.
# "all-MiniLM-L6-v2" is small, fast, free, and runs fine on a laptop CPU.
print("Loading local embedding model (first run downloads it, ~90MB)...")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
print("Embedding model ready.")


class ChatRequest(BaseModel):
    session_id: str
    query: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


@app.get("/")
def root():
    return {"status": "ok", "message": "AI PDF Chatbot API is running (free stack: Groq + HuggingFace)"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    session_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{session_id}.pdf")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    text = extract_text_from_pdf(file_path)

    if not text.strip():
        os.remove(file_path)
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from this PDF. It may be a scanned/image-only PDF.",
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)

    # Embeddings run locally here - no API call, no cost.
    vectorstore = FAISS.from_texts(chunks, embeddings)

    SESSIONS[session_id] = vectorstore

    # clean up the raw PDF file, we only need the vector index now
    os.remove(file_path)

    return {
        "session_id": session_id,
        "filename": file.filename,
        "num_chunks": len(chunks),
        "message": "PDF processed successfully. You can now chat with it.",
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    vectorstore = SESSIONS.get(request.session_id)
    if vectorstore is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Upload a PDF first to get a session_id.",
        )

    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Groq's free tier - fast inference on open models like Llama 3.
    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        return_source_documents=True,
    )

    result = qa_chain.invoke({"query": request.query})

    sources = [
        doc.page_content[:200] + "..." for doc in result.get("source_documents", [])
    ]

    return ChatResponse(answer=result["result"], sources=sources)


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in SESSIONS:
        del SESSIONS[session_id]
        return {"message": "Session cleared"}
    raise HTTPException(status_code=404, detail="Session not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
