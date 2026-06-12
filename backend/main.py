import os
import logging
from typing import List
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Body, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from backend.pdf_processor import extract_pdf_chunks
from backend.llm_service import generate_embeddings, generate_answer
from backend.indexer import get_session_index, clear_session, retrieve_relevant_chunks

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Q&A Tool API",
    description="Backend API for PDF parsing, indexing, and LLM question-answering."
)

# CORS configuration to allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/upload")
async def upload_pdfs(
    files: List[UploadFile] = File(...),
    session_id: str = Header(default="default_session", alias="X-Session-ID"),
    api_key: str = Header(default=None, alias="X-OpenRouter-Key"),
):
    """
    Uploads one or more PDF files, chunks them, generates local embeddings,
    and adds them to the session vector index.

    Note: Embeddings are generated locally — no API key is required for upload.
    The api_key header is accepted but not used during this step; it is only
    required for the /api/query endpoint.
    """
    session_index = get_session_index(session_id)
    all_chunks = []

    # 1. Parse and chunk each PDF
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: '{file.filename}'. Only PDF files are supported."
            )

        try:
            content = await file.read()
            logger.info(f"Parsing PDF '{file.filename}' (size: {len(content)} bytes) for session '{session_id}'")
            chunks = extract_pdf_chunks(content, file.filename)
            all_chunks.extend(chunks)
        except ValueError as ve:
            logger.error(f"Validation error parsing PDF {file.filename}: {ve}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except Exception as e:
            logger.error(f"Unexpected error parsing PDF {file.filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An error occurred while processing '{file.filename}': {str(e)}"
            )

    if not all_chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text could be extracted from the uploaded PDF documents. They might be scanned images or empty."
        )

    # 2. Generate local embeddings for the chunks (no API key needed)
    try:
        texts_to_embed = [chunk["text"] for chunk in all_chunks]
        logger.info(f"Generating local embeddings for {len(texts_to_embed)} chunks...")
        embeddings = generate_embeddings(texts_to_embed)

        # 3. Add to the session index
        session_index.add_chunks(all_chunks, embeddings)

    except ValueError as ve:
        logger.error(f"Error generating embeddings: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error in embedding generation/indexing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}"
        )

    return {
        "status": "success",
        "message": f"Successfully processed {len(files)} files into {len(all_chunks)} chunks.",
        "session_status": session_index.get_status()
    }


@app.post("/api/query")
async def query_documents(
    query: str = Body(..., embed=True),
    chat_model: str = Body("google/gemini-2.5-flash", embed=True),
    session_id: str = Header(default="default_session", alias="X-Session-ID"),
    api_key: str = Header(default=None, alias="X-OpenRouter-Key")
):
    """
    Accepts a natural language question, retrieves relevant context from the session
    index using local embeddings, and calls OpenRouter to generate a grounded answer.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OpenRouter API key is missing. Please configure it in Settings."
        )

    session_index = get_session_index(session_id)
    if not session_index.chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents have been uploaded for this session. Please upload one or more PDFs first."
        )

    try:
        # 1. Generate local embedding for the query
        logger.info("Generating local query embedding...")
        query_vector = generate_embeddings([query])[0]

        # 2. Retrieve relevant chunks via cosine similarity
        logger.info(f"Retrieving relevant chunks for query: '{query[:50]}...'")
        relevant_chunks = retrieve_relevant_chunks(query_vector, session_id, top_k=5, min_score=0.1)

        if not relevant_chunks:
            return {
                "answer": "No relevant content was found in the uploaded documents to answer your question.",
                "sources": []
            }

        # 3. Generate answer using OpenRouter chat completions
        logger.info(f"Generating answer using chat model '{chat_model}'")
        answer = generate_answer(query, relevant_chunks, api_key, model=chat_model)

        return {
            "answer": answer,
            "sources": [
                {
                    "text": chunk["text"],
                    "score": chunk["score"],
                    "metadata": chunk["metadata"]
                }
                for chunk in relevant_chunks
            ]
        }

    except ValueError as ve:
        logger.error(f"Error during query processing: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error in query processing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while answering your question: {str(e)}"
        )


@app.get("/api/session/status")
async def get_status(session_id: str = Header(default="default_session", alias="X-Session-ID")):
    """
    Returns the current status of the session's vector index.
    """
    session_index = get_session_index(session_id)
    return session_index.get_status()


@app.post("/api/session/clear")
async def clear_session_endpoint(session_id: str = Header(default="default_session", alias="X-Session-ID")):
    """
    Clears the processed content and index for the current session.
    """
    clear_session(session_id)
    return {"status": "success", "message": f"Session '{session_id}' index successfully cleared."}


# Mount frontend directory for static serving
os.makedirs("frontend", exist_ok=True)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
