import { create } from "zustand";
import { useAuthStore } from "./authStore";

export interface Task {
  id: string;
  project_id: string;
  conversation_id?: string;
  title: string;
  description?: string;
  status: string; // 'todo', 'in_progress', 'completed', 'blocked'
  priority: string; // 'low', 'medium', 'high', 'critical'
  deadline?: string;
  created_at: string;
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (projectId: string, title: string, description?: string, priority?: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: string) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
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

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (projectId: string) => {
    const isMock = useAuthStore.getState().isMock;
    set({ loading: true });

    if (isMock) {
      const cacheKey = `projectos_mock_tasks_${projectId}`;
      const cached = localStorage.getItem(cacheKey);
      const list = cached ? JSON.parse(cached) : [
        {
          id: "mock-task-1",
          project_id: projectId,
          title: "Refactor RTOS executor for Trajectory path node",
          description: "Switch the path computation task executor from SingleThreaded to StaticSingleThreaded to avoid dynamic heap usage during trajectory calculations.",
          status: "todo",
          priority: "high",
          created_at: new Date().toISOString(),
        },
        {
          id: "mock-task-2",
          project_id: projectId,
          title: "Apply pgvector migrations on Supabase",
          description: "Initialize the database schemas and construct the HNSW vector search index in the SQL editor.",
          status: "in_progress",
          priority: "medium",
          created_at: new Date().toISOString(),
        },
        {
          id: "mock-task-3",
          project_id: projectId,
          title: "Setup Next.js dashboard frame",
          description: "Setup folder architectures, layouts, and theme files.",
          status: "completed",
          priority: "critical",
          created_at: new Date().toISOString(),
        }
      ];
      if (!cached) {
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }
      set({ tasks: list, loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        set({ tasks: data });
      }
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (projectId: string, title: string, description?: string, priority: string = "medium") => {
    const isMock = useAuthStore.getState().isMock;

    if (isMock) {
      const newTask: Task = {
        id: `mock-task-${Date.now()}`,
        project_id: projectId,
        title,
        description,
        status: "todo",
        priority,
        created_at: new Date().toISOString(),
      };
      const updatedList = [newTask, ...get().tasks];
      localStorage.setItem(`projectos_mock_tasks_${projectId}`, JSON.stringify(updatedList));
      set({ tasks: updatedList });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ title, description, priority }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ tasks: [data, ...get().tasks] });
      }
    } catch (e) {
      console.error("Error creating task:", e);
    }
  },

  updateTaskStatus: async (taskId: string, status: string) => {
    const isMock = useAuthStore.getState().isMock;
    
    if (isMock) {
      const updatedList = get().tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t
      );
      // Find the project id of the task
      const task = get().tasks.find((t) => t.id === taskId);
      if (task) {
        localStorage.setItem(`projectos_mock_tasks_${task.project_id}`, JSON.stringify(updatedList));
      }
      set({ tasks: updatedList });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: getApiHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        set({
          tasks: get().tasks.map((t) => (t.id === taskId ? data : t)),
        });
      }
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  },

  updateTask: async (taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => {
    const isMock = useAuthStore.getState().isMock;
    
    if (isMock) {
      const updatedList = get().tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      );
      const task = get().tasks.find((t) => t.id === taskId);
      if (task) {
        localStorage.setItem(`projectos_mock_tasks_${task.project_id}`, JSON.stringify(updatedList));
      }
      set({ tasks: updatedList });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: getApiHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        set({
          tasks: get().tasks.map((t) => (t.id === taskId ? data : t)),
        });
      }
    } catch (e) {
      console.error("Error updating task:", e);
    }
  },

  deleteTask: async (taskId: string) => {
    const isMock = useAuthStore.getState().isMock;
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (isMock) {
      const updatedList = get().tasks.filter((t) => t.id !== taskId);
      localStorage.setItem(`projectos_mock_tasks_${task.project_id}`, JSON.stringify(updatedList));
      set({ tasks: updatedList });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        set({ tasks: get().tasks.filter((t) => t.id !== taskId) });
      }
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  },
}));
