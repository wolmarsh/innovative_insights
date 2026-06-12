import os
import requests
import logging
from typing import List, Dict, Any

# Force transformers to use PyTorch only — prevents TF/Keras import errors
# when TensorFlow is present but tf-keras is not the expected version.
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TRANSFORMERS_NO_FLAX", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Local Embedding Model (singleton – loaded once at startup)
# ---------------------------------------------------------------------------
# all-MiniLM-L6-v2: ~90 MB, 384-dim vectors, excellent speed/quality balance.
# Downloaded automatically on first use and cached locally by sentence-transformers.
_EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
_embedding_model: SentenceTransformer | None = None


def _get_embedding_model() -> SentenceTransformer:
    """Returns the cached local embedding model, loading it on first call."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Loading local embedding model '{_EMBEDDING_MODEL_NAME}' (first-time download may take a moment)...")
        _embedding_model = SentenceTransformer(_EMBEDDING_MODEL_NAME)
        logger.info("Local embedding model loaded successfully.")
    return _embedding_model


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generates dense vector embeddings for a list of texts using the local
    sentence-transformers model. No API key or network call required.

    Args:
        texts: A list of strings to embed.

    Returns:
        A list of embedding vectors (each a list of floats).
    """
    if not texts:
        return []

    model = _get_embedding_model()
    try:
        # encode() returns a numpy array; convert to plain Python lists for JSON serialisation
        vectors = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        return [v.tolist() for v in vectors]
    except Exception as e:
        raise ValueError(f"Local embedding generation failed: {str(e)}")


# ---------------------------------------------------------------------------
# OpenRouter Chat Completions (unchanged – still requires user's API key)
# ---------------------------------------------------------------------------

def generate_answer(query: str, context_chunks: List[Dict[str, Any]], api_key: str, model: str = "google/gemini-2.5-flash") -> str:
    """
    Constructs a context-grounded RAG prompt and calls OpenRouter chat completions.

    Args:
        query:          The user's natural-language question.
        context_chunks: Relevant chunks retrieved from the vector index.
        api_key:        The user's OpenRouter API key.
        model:          The OpenRouter chat model identifier.

    Returns:
        The generated answer string.
    """
    if not api_key:
        raise ValueError("OpenRouter API key is missing. Please configure it in Settings.")

    # Build context string from retrieved chunks
    context_str = ""
    for idx, chunk in enumerate(context_chunks):
        metadata = chunk["metadata"]
        context_str += f"--- CONTEXT CHUNK {idx+1} (Source: {metadata['source']}, Page: {metadata['page']}) ---\n"
        context_str += f"{chunk['text']}\n\n"

    system_prompt = (
        "You are an expert Q&A assistant for Innovate Insights, designed to answer queries based strictly on the provided PDF contexts.\n"
        "Instructions:\n"
        "1. Answer the query clearly, concisely, and accurately using only the provided context.\n"
        "2. Ground all statements in the context. Do not extrapolate, assume, or use external knowledge.\n"
        "3. Provide direct page and file citations in your answer when referencing specific information, "
        "e.g., 'The firm experienced a 12% growth in Q3 [Source: report.pdf, Page: 4]'.\n"
        "4. If the provided context does not contain the answer, state: "
        "'I cannot find the answer to this question in the uploaded documents.' and list what relevant topics were found, if any."
    )

    user_prompt = (
        f"Context:\n{context_str}\n"
        f"Question: {query}\n\n"
        f"Answer:"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "PDF Q&A Tool"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Network error connecting to OpenRouter API: {str(e)}")

    if response.status_code != 200:
        error_detail = response.text
        try:
            error_detail = response.json().get("error", {}).get("message", response.text)
        except Exception:
            pass
        raise ValueError(f"OpenRouter Chat Completion failed (Status {response.status_code}): {error_detail}")

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise ValueError(f"Unexpected response format from OpenRouter: {data}")
