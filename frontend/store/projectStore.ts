import { create } from "zustand";
import { useAuthStore } from "./authStore";

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (project: Project | null) => void;
}

const getApiHeaders = () => {
  const session = useAuthStore.getState().session;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
};

const API_URL = (() => {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  if (url && !url.endsWith("/api/v1")) {
    url = url.replace(/\/$/, "") + "/api/v1";
  }
  return url;
})();

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProject: null,
  loading: false,

  fetchProjects: async () => {
    const isMock = useAuthStore.getState().isMock;
    set({ loading: true });

    if (isMock) {
      const cached = localStorage.getItem("projectos_mock_projects");
      const list = cached ? JSON.parse(cached) : [
        {
          id: "mock-proj-1",
          name: "Robotics Control Module",
          description: "Micro-ROS nodes, trajectory planning, and computer vision stack conversations.",
          created_at: new Date().toISOString(),
        },
        {
          id: "mock-proj-2",
          name: "SaaS Startup Pitch",
          description: "Pitch deck reviews, tech stack decisions, and target audience feedback logs.",
          created_at: new Date().toISOString(),
        }
      ];
      if (!cached) {
        localStorage.setItem("projectos_mock_projects", JSON.stringify(list));
      }
      set({ projects: list, loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        set({ projects: data });
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (name: string, description?: string) => {
    const isMock = useAuthStore.getState().isMock;
    
    if (isMock) {
      const newProj: Project = {
        id: `mock-proj-${Date.now()}`,
        name,
        description,
        created_at: new Date().toISOString(),
      };
      const updatedList = [...get().projects, newProj];
      localStorage.setItem("projectos_mock_projects", JSON.stringify(updatedList));
      set({ projects: updatedList });
      return newProj;
    }

    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ projects: [...get().projects, data] });
        return data;
      }
      throw new Error("Failed to create project");
    } catch (e) {
      console.error("Error creating project:", e);
      throw e;
    }
  },

  deleteProject: async (id: string) => {
    const isMock = useAuthStore.getState().isMock;
    
    if (isMock) {
      const updatedList = get().projects.filter((p) => p.id !== id);
      localStorage.setItem("projectos_mock_projects", JSON.stringify(updatedList));
      set({
        projects: updatedList,
        selectedProject: get().selectedProject?.id === id ? null : get().selectedProject,
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${id}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        set({
          projects: get().projects.filter((p) => p.id !== id),
          selectedProject: get().selectedProject?.id === id ? null : get().selectedProject,
        });
      }
    } catch (e) {
      console.error("Error deleting project:", e);
    }
  },

  selectProject: (project: Project | null) => {
    set({ selectedProject: project });
  },
}));
