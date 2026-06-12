# Innovate Insights - PDF Q&A Navigator

A robust, user-friendly, and secure PDF Q&A Tool designed for efficient information extraction and semantic query answering from PDF documents. The application features a FastAPI backend serving a session-based in-memory vector search engine and a modern glassmorphic single-page web interface.

---

## Key Features

- **Multi-PDF Upload**: Upload and index multiple PDF files in a single session.
- **Page-Aware Citations**: Answers are grounded directly in the text and include precise file and page citations.
- **Interactive Accordion**: Inspect exact matching text passages and similarity scores.
- **Session Isolation**: Each browser session gets its own isolated, in-memory index context.
- **Customizable LLM Configuration**: Easily set your OpenRouter API key and select your preferred chat model from the frontend settings; embeddings are generated locally with sentence-transformers.
- **Premium Aesthetics**: Sleek dark-mode theme with glassmorphic cards, transition animations, and skeleton loaders.
- **High Security**: Fully zero-trust client side with programmatic DOM manipulation to prevent Cross-Site Scripting (DOMXSS).

---

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS (Custom styling), Vanilla JS (No build step required).
- **Backend**: Python 3.12, FastAPI (Web Server), PyPDF (PDF Parsing), sentence-transformers (local embeddings), NumPy (cosine similarity search), Requests (API Communication).
- **LLM Engine**: OpenRouter API.

---

## Installation & Setup

Ensure you have **Python 3.12+** and **git/pip** installed on your Windows machine.

### Option 1: Automatic Launch (Recommended)
Double-click the `run.bat` file in the project root folder.
This script will:
1. Verify package installations.
2. Spin up the FastAPI backend on `http://localhost:8000`.
3. Open your default web browser automatically.

### Option 2: Manual Setup
1. Clone or open the repository folder:
   ```bash
   cd d:\Projects\PDF_Parser
   ```

2. (Optional) Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. Open your browser and navigate to:
   [http://localhost:8000](http://localhost:8000)

---

## Usage Guide

1. **Configure API Key**:
   - Click the **Settings** button in the upper-right corner.
   - Enter your **OpenRouter API Key**.
   - Select your preferred chat model (defaults are recommended). The embedding model runs locally and does not require an API key.
   - Click **Save Settings**.
   
2. **Upload PDF Files**:
   - Drag and drop one or more PDF files into the upload zone, or click to browse.
   - Wait for the files to parse. On success, a green checkmark will appear, and the **Session Index Status** panel will update.

3. **Query Documents**:
   - Type a natural language question (e.g. *"Summarize the Q3 revenue forecasts"*) in the input box at the bottom and press **Enter** (or click the Send arrow).
   - The AI will retrieve the most relevant passages and construct a grounded response with citations.
   - Click **View Source Citations** under the message bubble to view the original text snippets and page locations.

4. **Reset Session**:
   - Click **Reset Session** in the header to wipe all uploaded documents and clear the vector index.
