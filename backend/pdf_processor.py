import io
import pypdf
from typing import List, Dict, Any

def split_text_into_chunks(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """
    Splits text into overlapping chunks, attempting to split at sentence boundaries or word boundaries.
    """
    chunks = []
    if not text:
        return chunks
    
    # Normalize whitespaces but keep it clean
    text = " ".join(text.split())
    
    if len(text) <= chunk_size:
        return [text]
        
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            # Try to find a sentence boundary (. , ? , ! followed by space)
            boundary_idx = -1
            for separator in [". ", "? ", "! "]:
                idx = text.rfind(separator, end - 150, end)
                if idx != -1:
                    boundary_idx = max(boundary_idx, idx + len(separator) - 1)
            
            if boundary_idx != -1:
                end = boundary_idx
            else:
                # Fall back to space
                space_idx = text.rfind(" ", end - 80, end)
                if space_idx != -1:
                    end = space_idx
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            
        next_start = end - chunk_overlap
        # Guarantee progress
        if next_start <= start:
            next_start = start + (chunk_size - chunk_overlap)
        start = next_start
        
    return chunks

def extract_pdf_chunks(pdf_content: bytes, filename: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Extracts text page by page from PDF bytes and returns chunk dictionaries with metadata.
    """
    chunks = []
    pdf_file = io.BytesIO(pdf_content)
    
    try:
        reader = pypdf.PdfReader(pdf_file)
        num_pages = len(reader.pages)
        
        for page_idx in range(num_pages):
            page = reader.pages[page_idx]
            page_text = page.extract_text() or ""
            page_num = page_idx + 1
            
            # Split the page text into chunks
            page_chunks = split_text_into_chunks(page_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            
            for chunk_idx, chunk_text in enumerate(page_chunks):
                chunks.append({
                    "id": f"{filename}_p{page_num}_c{chunk_idx}",
                    "text": chunk_text,
                    "metadata": {
                        "source": filename,
                        "page": page_num,
                        "total_pages": num_pages,
                        "chunk_index": chunk_idx
                    }
                })
    except Exception as e:
        raise ValueError(f"Failed to parse PDF file '{filename}': {str(e)}")
        
    return chunks
