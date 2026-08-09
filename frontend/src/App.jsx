import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSessionId(res.data.session_id);
      setFileName(file.name);
      setMessages([
        {
          role: "assistant",
          content: `I've processed "${file.name}" (${res.data.num_chunks} chunks indexed). Ask me anything about it.`,
        },
      ]);
    } catch (err) {
      setUploadError(
        err.response?.data?.detail || "Failed to process PDF. Try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        session_id: sessionId,
        query: userMessage.content,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
          sources: res.data.sources,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.response?.data?.detail ||
            "Something went wrong answering that. Try again.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI Document Search</h1>
          <p className="text-sm text-slate-400">Chat with your PDFs using RAG</p>
        </div>
        {fileName && (
          <span className="text-sm bg-slate-800 px-3 py-1 rounded-full text-slate-300">
            📄 {fileName}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-6">
        {/* Upload section */}
        {!sessionId && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <label className="cursor-pointer border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl px-10 py-14 text-center transition-colors">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <div className="text-4xl mb-3">📤</div>
              <p className="font-medium">
                {uploading ? "Processing PDF..." : "Click to upload a PDF"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Text-based PDFs work best
              </p>
            </label>
            {uploadError && (
              <p className="text-red-400 text-sm mt-4">{uploadError}</p>
            )}
          </div>
        )}

        {/* Chat section */}
        {sessionId && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : msg.error
                        ? "bg-red-900/40 text-red-200"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <details className="mt-2 text-xs text-slate-400">
                        <summary className="cursor-pointer">
                          View sources ({msg.sources.length})
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {msg.sources.map((s, j) => (
                            <li key={j} className="bg-slate-900/60 rounded p-2">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 text-slate-400">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your document..."
                rows={1}
                className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-5 py-3 font-medium transition-colors"
              >
                Send
              </button>
            </div>
            <button
              onClick={() => {
                setSessionId(null);
                setFileName(null);
                setMessages([]);
              }}
              className="text-sm text-slate-400 hover:text-slate-200 mt-3 self-start"
            >
              ← Upload a different PDF
            </button>
          </>
        )}
      </main>
    </div>
  );
}
