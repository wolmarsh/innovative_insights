import numpy as np
from typing import List, Dict, Any, Set

class SessionIndex:
    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: List[List[float]] = []
        self.uploaded_files: Set[str] = set()

    def add_chunks(self, new_chunks: List[Dict[str, Any]], new_embeddings: List[List[float]]):
        """
        Appends new text chunks and their embeddings to the session index.
        """
        if len(new_chunks) != len(new_embeddings):
            raise ValueError("Size mismatch: number of chunks and embeddings must be equal.")
            
        self.chunks.extend(new_chunks)
        self.embeddings.extend(new_embeddings)
        for chunk in new_chunks:
            self.uploaded_files.add(chunk["metadata"]["source"])

    def clear(self):
        """
        Clears the session index.
        """
        self.chunks.clear()
        self.embeddings.clear()
        self.uploaded_files.clear()

    def get_status(self) -> Dict[str, Any]:
        """
        Returns summary info about the session index.
        """
        return {
            "uploaded_files": list(self.uploaded_files),
            "total_chunks": len(self.chunks),
            "index_size_embeddings": len(self.embeddings)
        }

# Global in-memory session storage mapping session_id (str) -> SessionIndex
_session_store: Dict[str, SessionIndex] = {}

def get_session_index(session_id: str) -> SessionIndex:
    """
    Retrieves or creates a SessionIndex for the specified session_id.
    """
    if not session_id:
        session_id = "default_session"
    if session_id not in _session_store:
        _session_store[session_id] = SessionIndex()
    return _session_store[session_id]

def clear_session(session_id: str):
    """
    Resets the session index for the specified session_id.
    """
    if session_id in _session_store:
        _session_store[session_id].clear()

def retrieve_relevant_chunks(query_vector: List[float], session_id: str, top_k: int = 5, min_score: float = 0.0) -> List[Dict[str, Any]]:
    """
    Performs cosine similarity search against indexed chunks for the session.
    """
    session_index = get_session_index(session_id)
    chunks = session_index.chunks
    embeddings = session_index.embeddings
    
    if not chunks or not embeddings:
        return []
        
    # Convert vectors to numpy arrays for fast calculation
    A = np.array(embeddings, dtype=np.float32)   # (N, D)
    B = np.array(query_vector, dtype=np.float32)  # (D,)
    
    # Compute vector norms
    a_norms = np.linalg.norm(A, axis=1)
    b_norm = np.linalg.norm(B)
    
    # Avoid divide by zero
    a_norms[a_norms == 0] = 1e-10
    if b_norm == 0:
        b_norm = 1e-10
        
    # Calculate cosine similarity
    similarities = np.dot(A, B) / (a_norms * b_norm)
    
    # Sort and filter by minimum score
    indices = np.argsort(similarities)[::-1]
    
    results = []
    for idx in indices:
        score = float(similarities[idx])
        if score < min_score:
            continue
        if len(results) >= top_k:
            break
            
        chunk_data = chunks[idx].copy()
        chunk_data["score"] = score
        results.append(chunk_data)
        
    return results
