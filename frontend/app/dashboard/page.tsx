"use client";

import { useEffect, useState } from "react";
import { useProjectStore, Project } from "@/store/projectStore";
import { Folder, Calendar, Plus, ChevronRight, Activity, Database, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api-client";

export default function DashboardPage() {
  const router = useRouter();
  const { projects, loading, selectProject } = useProjectStore();

  const handleProjectClick = (proj: Project) => {
    selectProject(proj);
    router.push(`/dashboard/project/${proj.id}`);
  };

  const [stats, setStats] = useState({ projectsCount: 0, chatsCount: 0, tasksCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      const isMock = useAuthStore.getState().isMock;
      if (isMock) {
        setStats({
          projectsCount: projects.length,
          chatsCount: projects.length === 0 ? 0 : projects.length * 3 + 2,
          tasksCount: projects.length === 0 ? 0 : projects.length * 4 + 1,
        });
        setStatsLoading(false);
        return;
      }

      try {
        const session = useAuthStore.getState().session;
        const res = await apiClient.get<any>("/projects/stats", {
          token: session?.access_token || undefined,
        });
        if (active) {
          setStats({
            projectsCount: res.projectsCount ?? 0,
            chatsCount: res.chatsCount ?? 0,
            tasksCount: res.tasksCount ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
      } finally {
        if (active) {
          setStatsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [projects]);

  // Dynamically generate activity events based on actual project creation history
  const getActivities = () => {
    if (projects.length === 0) {
      return [];
    }

    // Sort projects by creation date desc
    const sorted = [...projects].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const colors = ["bg-violet-500", "bg-indigo-500", "bg-emerald-500", "bg-amber-500"];

    return sorted.map((proj, idx) => {
      const color = colors[idx % colors.length];
      const createdDate = new Date(proj.created_at);
      
      return {
        id: proj.id,
        time: createdDate.toLocaleDateString(undefined, { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }) + " at " + createdDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        }),
        title: "Workspace Initialized",
        description: `Project "${proj.name}" was successfully registered. Ingestion pipelines and semantic search vectors are ready.`,
        color,
      };
    });
  };

  const activities = getActivities();

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-fade-in">
      {/* Welcome banner */}
      <div className="flex flex-col gap-1.5 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Workspace Dashboard</h1>
        <p className="text-xs text-zinc-400">Preserve project memories, extract actions, and resume work context instantly.</p>
      </div>

      {/* Grid of quick statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-4 border border-zinc-800/80 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <Folder className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold text-white">{stats.projectsCount}</span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Active Projects</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800/80 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold text-white">{stats.chatsCount}</span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Chats Extracted</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-zinc-800/80 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xl font-bold text-white">{stats.tasksCount}</span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Action Items</span>
          </div>
        </div>
      </div>

      {/* Grid for Active Workspaces and Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Active Workspaces (left 2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Active Workspaces</h3>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center glass-panel rounded-xl border border-zinc-800">
              <div className="h-5 w-5 animate-spin rounded-full border border-t-transparent border-zinc-500" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
              <Folder className="h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-400">No project workspaces created yet.</p>
              <p className="text-[10px] text-zinc-500 mt-1">Create one using the sidebar "+ Create Workspace" trigger to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => handleProjectClick(proj)}
                  className="glass-panel glass-panel-hover rounded-xl border border-zinc-800/80 p-5 cursor-pointer flex flex-col justify-between h-40 text-left relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500 w-0 group-hover:w-full transition-all duration-300" />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white group-hover:text-violet-400 transition truncate max-w-40">{proj.name}</h4>
                      <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition" />
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                      {proj.description || "No project description provided."}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-4 border-t border-zinc-900/60 pt-3">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(proj.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Activity Timeline (right 1 col) */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 text-left">Activity Feed</h3>
          <div className="glass-panel border border-zinc-800/80 rounded-xl p-5 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-3 mb-1">
              <Activity className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold text-white">Recent Updates</span>
            </div>

            {activities.length === 0 ? (
              <div className="text-zinc-500 text-xs italic py-2">
                No recent activity. Initialize a project to see events.
              </div>
            ) : (
              <div className="relative border-l border-zinc-800 pl-4 space-y-5 text-xs py-1">
                {activities.map((act) => (
                  <div key={act.id} className="relative animate-fade-in">
                    <div className={`absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full ${act.color} ring-4 ring-zinc-950`} />
                    <span className="text-[10px] text-zinc-500">{act.time}</span>
                    <p className="font-semibold text-zinc-300 mt-0.5">{act.title}</p>
                    <p className="text-[11px] text-zinc-500">{act.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
