"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useConversationStore, Conversation } from "@/store/conversationStore";
import ResumeContextCard from "@/components/resume-context-card";
import RelatedDiscussionsCard from "@/components/related-discussions-card";
import {
  Upload,
  FileText,
  FileCode,
  AlertCircle,
  Clock,
  CheckCircle,
  Clipboard,
  Trash2,
  BookOpen,
  ArrowRight,
  Eye,
  Activity,
  Layers,
  Brain
} from "lucide-react";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { selectedProject, selectProject, projects } = useProjectStore();
  const {
    conversations,
    activeConversation,
    loading,
    fetchConversations,
    fetchConversationDetail,
    pasteConversation,
    uploadFile,
    deleteConversation
  } = useConversationStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploader States
  const [isPasting, setIsPasting] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "takeaways" | "insights">("summary");

  useEffect(() => {
    if (projectId) {
      fetchConversations(projectId);
      
      // Auto-restore selected project state if reloaded
      if (!selectedProject && projects.length > 0) {
        const found = projects.find((p) => p.id === projectId);
        if (found) selectProject(found);
      }
    }
  }, [projectId, fetchConversations, projects, selectedProject, selectProject]);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop File
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setIsUploading(true);
      try {
        await uploadFile(projectId, e.dataTransfer.files[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        await uploadFile(projectId, e.target.files[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTitle.trim() || !pasteContent.trim()) return;
    setIsUploading(true);
    try {
      await pasteConversation(projectId, pasteTitle, "pasted_text", pasteContent);
      setPasteTitle("");
      setPasteContent("");
      setIsPasting(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDetails = (convId: string) => {
    fetchConversationDetail(convId);
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto animate-fade-in text-left">
      {/* Upper overview header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white tracking-tight">{selectedProject?.name || "Workspace"}</h2>
          <p className="text-xs text-zinc-400 max-w-xl">{selectedProject?.description || "Injest chats and configure search metrics."}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/dashboard/project/${projectId}/chat`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold rounded-lg border border-zinc-800/80 transition cursor-pointer text-white"
          >
            Semantic Search <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Resume Context snapshoting card */}
      <ResumeContextCard projectId={projectId} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
        {/* Left Side: Upload Zone & Uploaded List (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 h-full overflow-y-auto pr-1">
          {/* Uploader Card */}
          {!isPasting ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-panel border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-44 ${
                dragActive
                  ? "border-violet-500 bg-violet-950/10"
                  : "border-zinc-800 hover:border-zinc-700/80 bg-zinc-950/20"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.md,.pdf,.json"
                className="hidden"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 mb-3 border border-zinc-800">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-200">
                Drag & drop files or <span className="text-violet-400">browse</span>
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">Supports Markdown (.md), PDF, Text (.txt) or Chat Exports (.json)</p>
              
              <div className="mt-4 border-t border-zinc-900/60 pt-3 w-full max-w-xs flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPasting(true);
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 cursor-pointer"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Paste Conversation Log
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel border border-zinc-800 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Paste Conversation Logs</span>
                <button
                  onClick={() => setIsPasting(false)}
                  className="text-xs text-zinc-500 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handlePasteSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Conversation title (e.g., Trajectory node review)"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none"
                />
                
                <textarea
                  required
                  placeholder="Paste Markdown notes, PDF dumps, or raw ChatGPT / Claude / Gemini conversation transcripts here..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={6}
                  className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none resize-none font-mono"
                />

                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="submit"
                    disabled={isUploading || !pasteTitle || !pasteContent}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Injest Logs
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of uploads */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ingested conversations</h3>

            {loading && conversations.length === 0 ? (
              <div className="flex h-32 items-center justify-center glass-panel rounded-xl border border-zinc-800">
                <div className="h-5 w-5 animate-spin rounded-full border border-t-transparent border-zinc-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-8 glass-panel border border-zinc-800 rounded-xl border-dashed">
                No logs uploaded yet. Upload or paste a log above to start AI analysis.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {conversations.map((conv) => {
                  const isSelected = activeConversation?.id === conv.id;
                  const isProcessing = conv.processed_status === "processing";
                  const isCompleted = conv.processed_status === "completed";
                  const isFailed = conv.processed_status === "failed";

                  return (
                    <div
                      key={conv.id}
                      onClick={() => !isProcessing && handleViewDetails(conv.id)}
                      className={`glass-panel border rounded-xl p-4 transition flex items-center justify-between group ${
                        isProcessing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      } ${
                        isSelected 
                          ? "border-violet-950 bg-violet-950/10" 
                          : "border-zinc-800/80 hover:border-zinc-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-lg border ${
                          isSelected ? "bg-violet-950/30 border-violet-900" : "bg-zinc-900 border-zinc-800"
                        }`}>
                          <FileText className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate max-w-xs sm:max-w-sm">
                            {conv.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-500">
                              {new Date(conv.created_at).toLocaleDateString()}
                            </span>
                            <span className="h-1 w-1 bg-zinc-800 rounded-full" />
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">
                              {conv.source_type.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Label */}
                        <div className="flex items-center gap-1">
                          {isProcessing && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] text-amber-400 font-semibold uppercase animate-pulse">
                              <Clock className="h-2.5 w-2.5 animate-spin" /> Processing
                            </span>
                          )}
                          {isCompleted && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-[9px] text-emerald-400 font-semibold uppercase">
                              <CheckCircle className="h-2.5 w-2.5" /> Ready
                            </span>
                          )}
                          {isFailed && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/25 bg-red-500/5 text-[9px] text-red-400 font-semibold uppercase">
                              <AlertCircle className="h-2.5 w-2.5" /> Failed
                            </span>
                          )}
                        </div>

                        {/* Delete trigger */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this conversation and all associated summaries/embeddings?")) {
                              deleteConversation(conv.id);
                            }
                          }}
                          className="text-zinc-500 hover:text-red-400 transition p-1 cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Conversation AI Summary Panel (5 cols) */}
        <div className="lg:col-span-5 h-full overflow-y-auto">
          {activeConversation ? (
            <div className="glass-panel border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-start border-b border-zinc-900/60 pb-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{activeConversation.title}</h3>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-violet-400" />
                    Categorized: <span className="font-semibold text-zinc-300 uppercase tracking-wider">{activeConversation.summary?.conversation_type || "general"}</span>
                  </span>
                </div>
              </div>

              {activeConversation.summary ? (
                <div className="flex flex-col gap-4">
                  {/* Tabs */}
                  <div className="flex border-b border-zinc-900/60 text-xs">
                    <button
                      onClick={() => setActiveTab("summary")}
                      className={`pb-2 px-1 border-b-2 font-medium transition cursor-pointer ${
                        activeTab === "summary"
                          ? "border-violet-500 text-white"
                          : "border-transparent text-zinc-400 hover:text-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setActiveTab("takeaways")}
                      className={`pb-2 px-4 border-b-2 font-medium transition cursor-pointer ${
                        activeTab === "takeaways"
                          ? "border-violet-500 text-white"
                          : "border-transparent text-zinc-400 hover:text-white"
                      }`}
                    >
                      Takeaways
                    </button>
                    <button
                      onClick={() => setActiveTab("insights")}
                      className={`pb-2 px-1 border-b-2 font-medium transition cursor-pointer ${
                        activeTab === "insights"
                          ? "border-violet-500 text-white"
                          : "border-transparent text-zinc-400 hover:text-white"
                      }`}
                    >
                      Technical Insights
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="min-h-48 text-xs leading-relaxed text-zinc-300">
                    {activeTab === "summary" && (
                      <div className="space-y-3">
                        <p>{activeConversation.summary.summary_text}</p>
                        <div className="mt-4 p-3 bg-zinc-950/40 rounded-lg border border-zinc-900 flex items-start gap-2.5">
                          <Brain className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                          <div className="text-[10px] text-zinc-400">
                            <span className="font-bold text-zinc-300 block mb-0.5">Resume Context</span>
                            This file has been embedded into your vector database. Go to Semantic Search to query code blocks and explanations from it.
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "takeaways" && (
                      <ul className="list-disc pl-4 space-y-2">
                        {activeConversation.summary.key_takeaways.map((takeaway, i) => (
                          <li key={i}>{takeaway}</li>
                        ))}
                      </ul>
                    )}

                    {activeTab === "insights" && (
                      <ul className="list-disc pl-4 space-y-2">
                        {activeConversation.summary.technical_insights.length === 0 ? (
                          <li className="italic text-zinc-500">No specific architectural or technical insights extracted.</li>
                        ) : (
                          activeConversation.summary.technical_insights.map((insight, i) => (
                            <li key={i} className="text-zinc-300 font-mono text-[11px]">{insight}</li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Relationship Intelligence linked discussions card */}
                  <RelatedDiscussionsCard conversationId={activeConversation.id} />
                </div>
              ) : (
                <div className="text-xs text-zinc-500 italic py-12 text-center">
                  This conversation is parsed but has no summary generated yet.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-8 text-center h-full min-h-64">
              <Eye className="h-6 w-6 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500">Select an ingested log from the list to view its AI summary and takeaways.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
