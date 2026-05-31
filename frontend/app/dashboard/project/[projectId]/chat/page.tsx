"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { Search, Brain, HelpCircle, Activity, Sparkles, AlertCircle } from "lucide-react";

interface SearchResult {
  conversation_id: string;
  conversation_title: string;
  chunk_index: number;
  content_chunk: string;
  score: number;
}

const API_URL = (() => {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  if (url && !url.endsWith("/api/v1")) {
    url = url.replace(/\/$/, "") + "/api/v1";
  }
  return url;
})();

export default function ChatSearchPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { selectedProject, selectProject, projects } = useProjectStore();
  const isMock = useAuthStore().isMock;

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"hybrid" | "semantic" | "lexical">("hybrid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Restore selected project if reloaded
    if (!selectedProject && projects.length > 0) {
      const found = projects.find((p) => p.id === projectId);
      if (found) selectProject(found);
    }
  }, [projectId, projects, selectedProject, selectProject]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(true);

    if (isMock) {
      // Simulate semantic search on local mock chunks
      setTimeout(() => {
        const text = query.toLowerCase();
        let mockMatches: SearchResult[] = [];
        
        if (text.includes("rtos") || text.includes("trajectory") || text.includes("latency") || text.includes("path")) {
          mockMatches = [
            {
              conversation_id: "mock-conv-1",
              conversation_title: "Micro-ROS and trajectory node bug",
              chunk_index: 0,
              content_chunk: "[Assistant]: Try switching to a StaticSingleThreadedExecutor to eliminate dynamic allocations during path computations. The RTOS dynamic allocator is a primary source of path planner latency.",
              score: 0.915
            },
            {
              conversation_id: "mock-conv-1",
              conversation_title: "Micro-ROS and trajectory node bug",
              chunk_index: 1,
              content_chunk: "[User]: I am seeing a latency issue with our trajectory planning node on micro-ROS. It seems to lag by 200ms when calculating Spline paths.",
              score: 0.842
            }
          ];
        } else if (text.includes("vector") || text.includes("pgvector") || text.includes("migration") || text.includes("database")) {
          mockMatches = [
            {
              conversation_id: "mock-conv-2",
              conversation_title: "Database Indexing & pgvector migration discussion",
              chunk_index: 0,
              content_chunk: "We need to install pgvector extension and create an HNSW index using cosine similarity matching for all-MiniLM-L6-v2 which has 384 dimensions.",
              score: 0.887
            },
            {
              conversation_id: "mock-conv-2",
              conversation_title: "Database Indexing & pgvector migration discussion",
              chunk_index: 1,
              content_chunk: "Discussing the migration of our SQL tables to support vector embedding storage for project files. Executing DDL adding hnsw index: CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops).",
              score: 0.811
            }
          ];
        } else {
          // Default mock returns
          mockMatches = [
            {
              conversation_id: "mock-conv-1",
              conversation_title: "Micro-ROS and trajectory node bug",
              chunk_index: 0,
              content_chunk: "[Assistant]: Switch from SingleThreadedExecutor to StaticSingleThreadedExecutor. RTOS dynamic allocator is a primary source of path planner latency.",
              score: 0.621
            },
            {
              conversation_id: "mock-conv-2",
              conversation_title: "Database Indexing & pgvector migration discussion",
              chunk_index: 0,
              content_chunk: "HNSW index provides faster scaling than IVFFlat. Vector length set to 384 (all-MiniLM-L6-v2 model size).",
              score: 0.598
            }
          ];
        }
        
        setResults(mockMatches);
        setSearching(false);
      }, 800);
      return;
    }

    try {
      const session = useAuthStore.getState().session;
      const res = await fetch(`${API_URL}/projects/${projectId}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          query,
          limit: 10,
          type: searchMode
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch (e) {
      console.error("Failed to perform semantic query search:", e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-4xl mx-auto animate-fade-in text-left">
      {/* Search page header */}
      <div className="flex flex-col gap-1 border-b border-zinc-900 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Semantic Knowledge Search</h2>
        <p className="text-xs text-zinc-400">Search over the ingested project memory utilizing local vector embeddings.</p>
      </div>

      {/* Floating style Search Bar (Perplexity style) */}
      <form onSubmit={handleSearchSubmit} className="glass-panel border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col gap-3 relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-3.5 h-4.5 w-4.5 text-zinc-500" />
          <input
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about this project... (e.g. How did we resolve the RTOS latency issue?)"
            className="w-full bg-zinc-950/20 border border-zinc-850 focus:border-violet-500 rounded-lg py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-500 outline-none transition"
          />
        </div>

        <div className="flex justify-between items-center text-xs">
          <div className="flex gap-1.5 bg-[#121217] p-1 rounded-lg border border-zinc-850">
            <button
              type="button"
              onClick={() => setSearchMode("hybrid")}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                searchMode === "hybrid"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Hybrid
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("semantic")}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                searchMode === "semantic"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Vector
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("lexical")}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                searchMode === "lexical"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Keyword
            </button>
          </div>

          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 cursor-pointer text-xs"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Results Section */}
      <div className="flex flex-col gap-4">
        {searching ? (
          <div className="flex flex-col h-40 items-center justify-center gap-3 glass-panel border border-zinc-800 rounded-xl">
            <Brain className="h-6 w-6 animate-pulse text-violet-400" />
            <span className="text-xs text-zinc-500 font-semibold animate-pulse">Running semantic analysis...</span>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 border border-dashed border-zinc-800 rounded-xl p-6 text-center text-xs text-zinc-500">
            <AlertCircle className="h-6 w-6 text-zinc-600 mb-2" />
            <span>No matching knowledge blocks found in database. Try another query.</span>
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center h-44 border border-dashed border-zinc-800 rounded-xl p-6 text-center text-zinc-500">
            <HelpCircle className="h-6 w-6 text-zinc-600 mb-2" />
            <span className="text-xs font-semibold text-zinc-400">Memory Explorer Prompt Ideas</span>
            <div className="flex flex-wrap gap-2 justify-center mt-3 max-w-lg">
              <button
                onClick={() => setQuery("trajectory delay RTOS")}
                className="text-[10px] text-zinc-400 hover:text-white transition px-2.5 py-1 rounded-full border border-zinc-850 bg-zinc-950/40 cursor-pointer"
              >
                "trajectory delay RTOS"
              </button>
              <button
                onClick={() => setQuery("database migrations vector hnsw")}
                className="text-[10px] text-zinc-400 hover:text-white transition px-2.5 py-1 rounded-full border border-zinc-850 bg-zinc-950/40 cursor-pointer"
              >
                "database migrations vector hnsw"
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Search Matches</h3>
            
            <div className="space-y-4">
              {results.map((item, i) => {
                const percentage = Math.round(item.score * 100);
                return (
                  <div
                    key={i}
                    onClick={() => router.push(`/dashboard/project/${projectId}`)}
                    className="glass-panel border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/50 transition cursor-pointer flex flex-col gap-3 group relative bg-zinc-950/15"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Source Document</span>
                        <span className="text-xs font-bold text-white group-hover:text-violet-400 transition truncate max-w-sm">
                          {item.conversation_title}
                        </span>
                      </div>
                      
                      {/* Score Badge */}
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-[9px] font-semibold text-violet-400 uppercase">
                        <Sparkles className="h-2.5 w-2.5" />
                        Match: {percentage}%
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap pl-3 border-l-2 border-zinc-800 py-0.5">
                      {item.content_chunk}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
