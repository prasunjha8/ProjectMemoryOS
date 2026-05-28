"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useConversationStore } from "@/store/conversationStore";
import { 
  Network, 
  GitCommit, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Search,
  BookOpen
} from "lucide-react";

interface Relationship {
  id: string;
  source_conversation_id: string;
  target_conversation_id: string;
  target_conversation_title: string;
  relationship_type: string;
  confidence_score: number;
  reasoning: string;
  created_at: string;
}

interface RelatedDiscussionsCardProps {
  conversationId: string;
}

export default function RelatedDiscussionsCard({ conversationId }: RelatedDiscussionsCardProps) {
  const { session, isMock } = useAuthStore();
  const { fetchConversationDetail } = useConversationStore();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  useEffect(() => {
    let active = true;

    async function fetchRelationships() {
      setLoading(true);
      setError(null);

      if (isMock) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (!active) return;

        // Mock data matching the relationship types
        const mockRelations: Relationship[] = [
          {
            id: "rel-mock-1",
            source_conversation_id: conversationId,
            target_conversation_id: "mock-target-1",
            target_conversation_title: "PID Derivative Gain Overshooting adjustments",
            relationship_type: "follow_up",
            confidence_score: 0.94,
            reasoning: "Continues PID gain tuning discussions and builds directly upon the Kd parameter tweaks.",
            created_at: new Date().toISOString()
          },
          {
            id: "rel-mock-2",
            source_conversation_id: conversationId,
            target_conversation_id: "mock-target-2",
            target_conversation_title: "ESP32 high current lockups & power failures",
            relationship_type: "blocker_related",
            confidence_score: 0.82,
            reasoning: "Addresses ESP32 lockups occurring during maximum PWM spikes by limiting PWM duty to 180.",
            created_at: new Date().toISOString()
          }
        ];

        setRelationships(mockRelations);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/conversations/${conversationId}/relationships`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load conversation relationships");
        }

        const json = await res.json();
        if (active) {
          setRelationships(json);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load relationships");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (conversationId) {
      fetchRelationships();
    }

    return () => {
      active = false;
    };
  }, [conversationId, session, isMock, API_URL]);

  const handleNavigate = (targetId: string) => {
    // If mock mode, simulate navigation since targets don't exist
    if (isMock) {
      alert(`Simulating navigation to historical conversation: ${targetId}`);
      return;
    }
    fetchConversationDetail(targetId);
  };

  const getBadgeStyles = (type: string) => {
    switch (type) {
      case "same_bug":
        return "bg-red-500/10 text-red-400 border border-red-500/25";
      case "blocker_related":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/25";
      case "follow_up":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
      case "decision_update":
        return "bg-violet-500/10 text-violet-400 border border-violet-500/25";
      case "architecture_change":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/25";
      case "implementation_progress":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25";
      default:
        return "bg-zinc-800/80 text-zinc-300 border border-zinc-700/50";
    }
  };

  const formatRelType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse border-t border-zinc-900 pt-4 mt-2 text-left">
        <div className="h-3.5 w-32 bg-zinc-800 rounded" />
        <div className="space-y-3">
          <div className="h-16 w-full bg-zinc-800/50 rounded-xl" />
          <div className="h-16 w-full bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently hide or display a minor warning
  }

  if (relationships.length === 0) return null;

  return (
    <div className="border-t border-zinc-900 pt-4 mt-2 text-left flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          Relationship Intelligence ({relationships.length})
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {relationships.map((rel) => {
          const matchPercentage = Math.round(rel.confidence_score * 100);
          return (
            <div 
              key={rel.id} 
              className="bg-zinc-950/40 hover:bg-zinc-900/25 border border-zinc-900/60 p-3.5 rounded-xl transition flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-bold text-white leading-tight truncate">
                    {rel.target_conversation_title}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${getBadgeStyles(rel.relationship_type)}`}>
                      {formatRelType(rel.relationship_type)}
                    </span>
                    <span className="h-1 w-1 bg-zinc-800 rounded-full" />
                    <span className="text-[9px] text-zinc-500 font-semibold uppercase">
                      {matchPercentage}% Confidence
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleNavigate(rel.target_conversation_id)}
                  className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
                  title="View this related conversation"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              
              <p className="text-[10px] text-zinc-400 leading-normal bg-zinc-900/10 border border-zinc-900/30 p-2 rounded-lg font-medium">
                {rel.reasoning}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
