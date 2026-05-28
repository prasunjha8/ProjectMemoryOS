"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore, Project } from "@/store/projectStore";
import {
  Brain,
  FolderPlus,
  LogOut,
  Plus,
  Settings,
  Folder,
  History,
  CheckSquare,
  Search,
  BookOpen,
  User,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { user, logout, initialize, initialized } = useAuthStore();
  const { projects, selectedProject, fetchProjects, createProject, selectProject } = useProjectStore();

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      router.push("/");
    }
  }, [user, initialized, router]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsSubmitting(true);
    try {
      const proj = await createProject(newProjectName, newProjectDesc);
      setNewProjectName("");
      setNewProjectDesc("");
      setIsNewProjectModalOpen(false);
      // Auto select the new project and navigate
      selectProject(proj);
      router.push(`/dashboard/project/${proj.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!initialized || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-violet-500" />
          <span className="text-xs text-zinc-500">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-950/80 border-r border-zinc-900/60 p-4 shrink-0 justify-between backdrop-blur-xl">
        <div className="flex flex-col gap-6 overflow-y-auto">
          {/* Logo Branding */}
          <Link
            href="/dashboard"
            onClick={() => selectProject(null)}
            className="flex items-center gap-2 px-2 py-1 text-white font-bold text-lg"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-violet-500/20">
              <Brain className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">Memory OS</span>
          </Link>

          {/* Quick Links */}
          <div className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              onClick={() => selectProject(null)}
              className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition ${
                pathname === "/dashboard"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5" />
                <span>Overview Hub</span>
              </div>
            </Link>
          </div>

          {/* Projects Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Workspaces</span>
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                className="hover:text-white transition cursor-pointer"
                title="Create project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
              {projects.length === 0 ? (
                <div className="text-[11px] text-zinc-600 p-2 italic">No workspaces active</div>
              ) : (
                projects.map((proj) => {
                  const isActive = selectedProject?.id === proj.id;
                  return (
                    <Link
                      key={proj.id}
                      href={`/dashboard/project/${proj.id}`}
                      onClick={() => selectProject(proj)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                        isActive
                          ? "bg-violet-950/20 border border-violet-900/50 text-white"
                          : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white border border-transparent"
                      }`}
                    >
                      <Folder className={`h-3.5 w-3.5 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                      <span className="truncate">{proj.name}</span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Contextual navigation based on active project */}
          {selectedProject && (
            <div className="flex flex-col gap-1 border-t border-zinc-900/60 pt-4">
              <div className="px-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                <span>{selectedProject.name}</span>
              </div>
              <Link
                href={`/dashboard/project/${selectedProject.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  pathname === `/dashboard/project/${selectedProject.id}`
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
                <span>Uploads & Overview</span>
              </Link>
              <Link
                href={`/dashboard/project/${selectedProject.id}/chat`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  pathname === `/dashboard/project/${selectedProject.id}/chat`
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white"
                }`}
              >
                <Search className="h-3.5 w-3.5 text-zinc-500" />
                <span>Semantic search</span>
              </Link>
              <Link
                href={`/dashboard/project/${selectedProject.id}/tasks`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  pathname === `/dashboard/project/${selectedProject.id}/tasks`
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white"
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 text-zinc-500" />
                <span>Task Board</span>
              </Link>
            </div>
          )}
        </div>

        {/* User profile bottom details */}
        <div className="flex flex-col gap-2 border-t border-zinc-900/60 pt-4">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold uppercase">
              {user.email[0]}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-white truncate">
                {user.full_name || "Developer"}
              </span>
              <span className="text-[9px] text-zinc-500 truncate">{user.email}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/40 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-zinc-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Board */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Top Header navbar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-900/60 bg-zinc-950/20 px-4 md:px-6 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
              {selectedProject && (
                <>
                  <ChevronRight className="h-3 w-3 text-zinc-600" />
                  <span className="font-semibold text-zinc-200 truncate max-w-40">{selectedProject.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-zinc-500">Local Time: 2026-05-27</span>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-[#09090b] p-4 md:p-6 relative">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Modal */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="relative flex flex-col w-64 bg-zinc-950 p-4 border-r border-zinc-900">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col gap-6 mt-4">
              <span className="font-bold text-white text-lg flex items-center gap-2">
                <Brain className="h-4.5 w-4.5 text-violet-500" /> Memory OS
              </span>

              <div className="flex flex-col gap-1">
                <Link
                  href="/dashboard"
                  onClick={() => {
                    selectProject(null);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-zinc-900 hover:text-white"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Overview</span>
                </Link>
              </div>

              {/* Projects List Mobile */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  <span>Workspaces</span>
                </div>
                <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                  {projects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/dashboard/project/${proj.id}`}
                      onClick={() => {
                        selectProject(proj);
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    >
                      <Folder className="h-3.5 w-3.5" />
                      <span className="truncate">{proj.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create New Workspace</h3>
            <p className="text-xs text-zinc-400 mt-1">Initialize a context tracking workspace for your project ideas or code repositories.</p>

            <form onSubmit={handleCreateProjectSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400">Workspace Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Memory OS Mobile App"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full mt-2 bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400">Description</label>
                <textarea
                  placeholder="Summarize the core technical challenges, models, and repositories for this project."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  className="w-full mt-2 bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2.5 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProjectName}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
