// Constants
const API_BASE_URL = window.location.origin;

// State management
let state = {
    sessionId: "",
    apiKey: "",
    chatModel: "google/gemini-2.5-flash",
    filesIndexedCount: 0,
    chunksCount: 0
};

// DOM Elements
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const fileListContainer = document.getElementById("file-list-container");
const questionInput = document.getElementById("question-input");
const sendBtn = document.getElementById("send-btn");
const chatMessages = document.getElementById("chat-messages");
const chatEmptyState = document.getElementById("chat-empty-state");
const activeModelDisplay = document.getElementById("active-model-display");
const clearSessionBtn = document.getElementById("clear-session-btn");

// Status stats
const statDocsCount = document.getElementById("stat-docs-count");
const statChunksCount = document.getElementById("stat-chunks-count");
const apiStatusDot = document.getElementById("api-status-dot");
const apiStatusText = document.getElementById("api-status-text");

// Settings Modal
const settingsToggleBtn = document.getElementById("settings-toggle-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsForm = document.getElementById("settings-form");
const settingsApiKey = document.getElementById("settings-api-key");
const settingsChatModel = document.getElementById("settings-chat-model");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const toggleKeyVisibility = document.getElementById("toggle-key-visibility");

// Initialize application
window.addEventListener("DOMContentLoaded", () => {
    initSession();
    loadSettings();
    updateUIState();
    fetchSessionStatus();
    setupEventListeners();
});

// Initialize session ID
function initSession() {
    let savedSessionId = localStorage.getItem("pdf_qa_session_id");
    if (!savedSessionId) {
        savedSessionId = "session_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("pdf_qa_session_id", savedSessionId);
    }
    state.sessionId = savedSessionId;
    console.log("Active Session ID:", state.sessionId);
}

// Load configurations from LocalStorage
function loadSettings() {
    state.apiKey = localStorage.getItem("pdf_qa_api_key") || "";
    state.chatModel = localStorage.getItem("pdf_qa_chat_model") || "google/gemini-2.5-flash";

    // Update settings form fields
    settingsApiKey.value = state.apiKey;
    settingsChatModel.value = state.chatModel;
}

// Update UI elements based on state (API configuration, upload index)
function updateUIState() {
    // API badge update
    if (state.apiKey) {
        apiStatusDot.className = "badge-dot connected";
        apiStatusText.textContent = "API Key Active";
    } else {
        apiStatusDot.className = "badge-dot";
        apiStatusText.textContent = "API Key Not Configured";
    }

    // Active model display
    activeModelDisplay.textContent = `Model: ${state.chatModel}`;

    // Q&A input enablement
    const hasIndexedDocs = state.filesIndexedCount > 0;
    const hasApiKey = !!state.apiKey;

    if (hasIndexedDocs && hasApiKey) {
        questionInput.removeAttribute("disabled");
        questionInput.placeholder = "Ask a question about the processed PDFs... (Press Enter to send)";
        sendBtn.removeAttribute("disabled");
    } else {
        questionInput.setAttribute("disabled", "true");
        sendBtn.setAttribute("disabled", "true");

        if (!hasIndexedDocs && !hasApiKey) {
            questionInput.placeholder = "Upload PDFs and configure your API key to begin.";
        } else if (!hasApiKey) {
            questionInput.placeholder = "Configure your OpenRouter API Key in settings to ask questions.";
        } else if (!hasIndexedDocs) {
            questionInput.placeholder = "Upload PDF documents to begin asking questions.";
        }
    }
}

// Fetch session index status from server
async function fetchSessionStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/session/status`, {
            headers: { "X-Session-ID": state.sessionId }
        });
        if (response.ok) {
            const data = await response.json();
            state.filesIndexedCount = data.uploaded_files.length;
            state.chunksCount = data.total_chunks;
            
            // Update UI elements
            statDocsCount.textContent = state.filesIndexedCount;
            statChunksCount.textContent = state.chunksCount;
            
            // Show file list container if files exist
            if (state.filesIndexedCount > 0) {
                fileListContainer.classList.remove("hide");
                fileList.innerHTML = "";
                data.uploaded_files.forEach(filename => {
                    renderFileListItem(filename, "success");
                });
            } else {
                fileListContainer.classList.add("hide");
                fileList.innerHTML = "";
            }
            
            updateUIState();
        }
    } catch (e) {
        console.error("Error fetching session status:", e);
    }
}

// Event Listeners setup
function setupEventListeners() {
    // Settings toggles
    settingsToggleBtn.addEventListener("click", () => settingsModal.classList.remove("hide"));
    modalCloseBtn.addEventListener("click", () => settingsModal.classList.add("hide"));
    modalCancelBtn.addEventListener("click", () => settingsModal.classList.add("hide"));
    
    // Toggle API Key visibility
    toggleKeyVisibility.addEventListener("click", () => {
        const type = settingsApiKey.getAttribute("type") === "password" ? "text" : "password";
        settingsApiKey.setAttribute("type", type);
        const icon = toggleKeyVisibility.querySelector("i");
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
    });

    // Save Settings Form
    settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        state.apiKey = settingsApiKey.value.trim();
        state.chatModel = settingsChatModel.value;

        localStorage.setItem("pdf_qa_api_key", state.apiKey);
        localStorage.setItem("pdf_qa_chat_model", state.chatModel);

        showToast("Settings saved successfully!", "success");
        settingsModal.classList.add("hide");
        updateUIState();
    });

    // Drag and Drop Upload
    uploadZone.addEventListener("click", () => fileInput.click());
    
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragover");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files);
        }
    });

    // Send Q&A question
    sendBtn.addEventListener("click", submitQuestion);
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitQuestion();
        }
    });

    // Reset Session
    clearSessionBtn.addEventListener("click", resetSession);

    // Suggested queries click handlers
    document.querySelectorAll(".suggested-query-card").forEach(card => {
        card.addEventListener("click", () => {
            const queryText = card.querySelector("span").textContent.replace(/"/g, "");
            if (!questionInput.disabled) {
                questionInput.value = queryText;
                questionInput.focus();
            } else {
                showToast("Please configure Settings and upload PDFs first.", "info");
            }
        });
    });
}

// Handle multiple file upload to FastAPI backend
async function handleFileUpload(files) {
    const pdfFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
        showToast("Invalid file selection. Only PDF files are supported.", "error");
        return;
    }

    // Display container and add file item loaders
    fileListContainer.classList.remove("hide");
    pdfFiles.forEach(file => {
        renderFileListItem(file.name, "loading", file.size);
    });

    const formData = new FormData();
    pdfFiles.forEach(file => {
        formData.append("files", file);
    });

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: "POST",
            headers: {
                "X-Session-ID": state.sessionId
            },
            body: formData
        });

        const result = await response.json();
        
        if (response.ok) {
            showToast(`Upload completed: ${pdfFiles.length} file(s) indexed.`, "success");
            
            // Mark all files as successful
            pdfFiles.forEach(file => {
                const fileId = `file-${sanitizeId(file.name)}`;
                const item = document.getElementById(fileId);
                if (item) {
                    const statusDiv = item.querySelector(".file-item-status");
                    statusDiv.innerHTML = "";
                    const successIcon = document.createElement("i");
                    successIcon.className = "fa-solid fa-circle-check status-success";
                    statusDiv.appendChild(successIcon);
                }
            });
            
            // Fetch updated session metrics
            fetchSessionStatus();
        } else {
            const errorText = result.detail || "Upload failed. Please check your credentials and file compatibility.";
            showToast(errorText, "error");
            
            // Mark all files as failed
            pdfFiles.forEach(file => {
                const fileId = `file-${sanitizeId(file.name)}`;
                const item = document.getElementById(fileId);
                if (item) {
                    const statusDiv = item.querySelector(".file-item-status");
                    statusDiv.innerHTML = "";
                    const errorIcon = document.createElement("i");
                    errorIcon.className = "fa-solid fa-circle-exclamation status-error";
                    errorIcon.title = errorText;
                    statusDiv.appendChild(errorIcon);
                }
            });
        }
    } catch (err) {
        console.error("Upload Error:", err);
        showToast("A network error occurred while uploading. Please try again.", "error");
        
        pdfFiles.forEach(file => {
            const fileId = `file-${sanitizeId(file.name)}`;
            const item = document.getElementById(fileId);
            if (item) {
                const statusDiv = item.querySelector(".file-item-status");
                statusDiv.innerHTML = "";
                const errorIcon = document.createElement("i");
                errorIcon.className = "fa-solid fa-circle-exclamation status-error";
                errorIcon.title = "Network error";
                statusDiv.appendChild(errorIcon);
            }
        });
    }
}

// Reset the session
async function resetSession() {
    if (confirm("Are you sure you want to reset the session? This will remove all uploaded documents and clear the vector index.")) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/session/clear`, {
                method: "POST",
                headers: { "X-Session-ID": state.sessionId }
            });
            if (response.ok) {
                showToast("Session reset successfully.", "success");
                
                // Clear UI
                chatMessages.innerHTML = "";
                // Restore empty state
                chatMessages.appendChild(chatEmptyState);
                chatEmptyState.classList.remove("hide");
                
                // Clear list
                fileList.innerHTML = "";
                fileListContainer.classList.add("hide");
                
                // Reset stats
                state.filesIndexedCount = 0;
                state.chunksCount = 0;
                statDocsCount.textContent = "0";
                statChunksCount.textContent = "0";
                
                updateUIState();
            } else {
                showToast("Failed to reset session on server.", "error");
            }
        } catch (e) {
            console.error("Reset error:", e);
            showToast("Network error resetting session.", "error");
        }
    }
}

// Submit a Q&A question
async function submitQuestion() {
    const question = questionInput.value.trim();
    if (!question) return;

    // Reset input field
    questionInput.value = "";
    
    // Hide empty state if present
    chatEmptyState.classList.add("hide");

    // 1. Render user message
    renderMessage(question, "user");
    
    // 2. Render assistant message with loading skeleton
    const assistantMsgId = "msg-" + Date.now();
    renderMessage("", "assistant", assistantMsgId, true);
    
    // Scroll chat window to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/api/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-ID": state.sessionId,
                "X-OpenRouter-Key": state.apiKey
            },
            body: JSON.stringify({
                query: question,
                chat_model: state.chatModel
            })
        });

        const result = await response.json();
        const msgBubble = document.getElementById(assistantMsgId);
        if (!msgBubble) return;
        
        if (response.ok) {
            // Replace loading skeleton with answer text and citations
            const formattedAnswer = renderMarkdown(result.answer);
            msgBubble.innerHTML = ""; // Clear loader
            
            // 1. Create answer bubble
            const bubbleDiv = document.createElement("div");
            bubbleDiv.className = "message-bubble";
            bubbleDiv.innerHTML = formattedAnswer;
            msgBubble.appendChild(bubbleDiv);
            
            // 2. Build the sources panel if citations exist
            if (result.sources && result.sources.length > 0) {
                const sourcesPanel = document.createElement("div");
                sourcesPanel.className = "sources-panel";
                
                const toggle = document.createElement("div");
                toggle.className = "sources-toggle";
                
                const toggleTitle = document.createElement("span");
                
                const listIcon = document.createElement("i");
                listIcon.className = "fa-solid fa-list-ol";
                listIcon.style.marginRight = "6px";
                toggleTitle.appendChild(listIcon);
                
                const labelText = document.createTextNode("View Source Citations (");
                toggleTitle.appendChild(labelText);
                
                const countText = document.createTextNode(String(result.sources.length));
                toggleTitle.appendChild(countText);
                
                const closingText = document.createTextNode(")");
                toggleTitle.appendChild(closingText);
                
                const chevronIcon = document.createElement("i");
                chevronIcon.className = "fa-solid fa-chevron-down";
                
                toggle.appendChild(toggleTitle);
                toggle.appendChild(chevronIcon);
                
                const content = document.createElement("div");
                content.className = "sources-content";
                
                toggle.addEventListener("click", () => {
                    toggle.classList.toggle("active");
                    if (content.style.display === "flex") {
                        content.style.display = "none";
                    } else {
                        content.style.display = "flex";
                    }
                });

                result.sources.forEach((src, index) => {
                    const item = document.createElement("div");
                    item.className = "source-item";
                    
                    const meta = document.createElement("div");
                    meta.className = "source-item-meta";
                    
                    const refSpan = document.createElement("span");
                    refSpan.textContent = `Reference #${index + 1} (${Math.round(src.score * 100)}% match)`;
                    
                    const pageSpan = document.createElement("span");
                    pageSpan.textContent = `Page ${src.metadata.page} in ${src.metadata.source}`;
                    
                    meta.appendChild(refSpan);
                    meta.appendChild(pageSpan);
                    
                    const textDiv = document.createElement("div");
                    textDiv.className = "source-item-text";
                    textDiv.textContent = `"${src.text}"`;
                    
                    item.appendChild(meta);
                    item.appendChild(textDiv);
                    content.appendChild(item);
                });
                
                sourcesPanel.appendChild(toggle);
                sourcesPanel.appendChild(content);
                msgBubble.appendChild(sourcesPanel);
            }
        } else {
            msgBubble.innerHTML = "";
            const bubbleDiv = document.createElement("div");
            bubbleDiv.className = "message-bubble";
            bubbleDiv.style.borderColor = "#ef4444";
            bubbleDiv.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
            
            const errIcon = document.createElement("i");
            errIcon.className = "fa-solid fa-circle-exclamation";
            errIcon.style.color = "#ef4444";
            errIcon.style.marginRight = "8px";
            
            const errSpan = document.createElement("span");
            errSpan.className = "status-error";
            errSpan.style.fontWeight = "600";
            errSpan.textContent = "Error: ";
            
            const errText = document.createTextNode(result.detail || "Unable to retrieve answer.");
            
            bubbleDiv.appendChild(errIcon);
            bubbleDiv.appendChild(errSpan);
            bubbleDiv.appendChild(errText);
            msgBubble.appendChild(bubbleDiv);
            
            showToast(result.detail || "Query failed. Please check credentials or index state.", "error");
        }
    } catch (err) {
        console.error("Query API Error:", err);
        const msgBubble = document.getElementById(assistantMsgId);
        if (msgBubble) {
            msgBubble.innerHTML = "";
            const bubbleDiv = document.createElement("div");
            bubbleDiv.className = "message-bubble";
            bubbleDiv.style.borderColor = "#ef4444";
            bubbleDiv.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
            
            const errIcon = document.createElement("i");
            errIcon.className = "fa-solid fa-circle-exclamation";
            errIcon.style.color = "#ef4444";
            errIcon.style.marginRight = "8px";
            
            const errSpan = document.createElement("span");
            errSpan.className = "status-error";
            errSpan.style.fontWeight = "600";
            errSpan.textContent = "Connection Error: ";
            
            const errText = document.createTextNode("A network error occurred while generating the answer.");
            
            bubbleDiv.appendChild(errIcon);
            bubbleDiv.appendChild(errSpan);
            bubbleDiv.appendChild(errText);
            msgBubble.appendChild(bubbleDiv);
        }
        showToast("Network error occurred. Please verify your connection.", "error");
    }
    
    // Scroll to bottom again
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render message bubble in chat window
function renderMessage(text, sender, id = "", isLoading = false) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;
    if (id) msgDiv.id = id;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (isLoading) {
        bubble.innerHTML = `
            <div class="skeleton-loader">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
        `;
    } else {
        const p = document.createElement("p");
        p.textContent = text;
        bubble.appendChild(p);
    }

    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
}

// Render file items in file upload history list
function renderFileListItem(name, status, size = 0) {
    const fileId = `file-${sanitizeId(name)}`;
    let existingItem = document.getElementById(fileId);
    
    if (existingItem) {
        const statusDiv = existingItem.querySelector(".file-item-status");
        statusDiv.innerHTML = "";
        if (status === "loading") {
            const spinner = document.createElement("i");
            spinner.className = "fa-solid fa-circle-notch status-spinner";
            statusDiv.appendChild(spinner);
        } else if (status === "success") {
            const success = document.createElement("i");
            success.className = "fa-solid fa-circle-check status-success";
            statusDiv.appendChild(success);
        } else {
            const error = document.createElement("i");
            error.className = "fa-solid fa-circle-exclamation status-error";
            statusDiv.appendChild(error);
        }
        return;
    }

    const item = document.createElement("li");
    item.className = "file-item";
    item.id = fileId;

    const infoDiv = document.createElement("div");
    infoDiv.className = "file-item-info";

    const pdfIcon = document.createElement("i");
    pdfIcon.className = "fa-solid fa-file-pdf file-item-icon";
    infoDiv.appendChild(pdfIcon);

    const nameContainer = document.createElement("div");
    nameContainer.style.overflow = "hidden";
    nameContainer.style.textOverflow = "ellipsis";

    const nameDiv = document.createElement("div");
    nameDiv.className = "file-item-name";
    nameDiv.title = name;
    nameDiv.textContent = name;
    nameContainer.appendChild(nameDiv);

    if (size > 0) {
        const sizeDiv = document.createElement("div");
        sizeDiv.className = "file-item-size";
        sizeDiv.textContent = formatBytes(size);
        nameContainer.appendChild(sizeDiv);
    }
    infoDiv.appendChild(nameContainer);
    item.appendChild(infoDiv);

    const statusDiv = document.createElement("div");
    statusDiv.className = "file-item-status";
    
    if (status === "loading") {
        const spinner = document.createElement("i");
        spinner.className = "fa-solid fa-circle-notch status-spinner";
        statusDiv.appendChild(spinner);
    } else if (status === "success") {
        const success = document.createElement("i");
        success.className = "fa-solid fa-circle-check status-success";
        statusDiv.appendChild(success);
    } else {
        const error = document.createElement("i");
        error.className = "fa-solid fa-circle-exclamation status-error";
        statusDiv.appendChild(error);
    }
    item.appendChild(statusDiv);

    fileList.appendChild(item);
}

// Show Toast messages
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-circle-info";
    if (type === "success") iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-circle-exclamation";
    
    const typeIcon = document.createElement("i");
    typeIcon.className = `fa-solid ${iconClass}`;
    toast.appendChild(typeIcon);
    
    const content = document.createElement("div");
    content.textContent = message;
    toast.appendChild(content);
    
    const closeBtn = document.createElement("i");
    closeBtn.className = "fa-solid fa-xmark toast-close";
    closeBtn.addEventListener("click", () => {
        toast.remove();
    });
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Helper Utilities
function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, "-");
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Lightweight Regex-based Markdown Parser
function renderMarkdown(text) {
    if (!text) return "";
    
    let escaped = escapeHtml(text);
    
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/`(.*?)`/g, "<code>$1</code>");
    
    const paragraphs = escaped.split(/\n\n+/);
    
    const formattedParagraphs = paragraphs.map(p => {
        p = p.trim();
        if (!p) return "";
        
        if (p.startsWith("- ") || p.startsWith("* ")) {
            const listItems = p.split(/\n[-*]\s+/);
            if (listItems[0].startsWith("- ")) listItems[0] = listItems[0].substring(2);
            if (listItems[0].startsWith("* ")) listItems[0] = listItems[0].substring(2);
            
            const liHtml = listItems.map(item => `<li>${item}</li>`).join("");
            return `<ul>${liHtml}</ul>`;
        }
        
        if (/^\d+\.\s+/.test(p)) {
            const listItems = p.split(/\n\d+\.\s+/);
            listItems[0] = listItems[0].replace(/^\d+\.\s+/, "");
            
            const liHtml = listItems.map(item => `<li>${item}</li>`).join("");
            return `<ol>${liHtml}</ol>`;
        }
        
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    });
    
    return formattedParagraphs.join("");
}
