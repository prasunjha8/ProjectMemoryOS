import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { useTaskStore } from "./taskStore";
import { useProjectStore } from "./projectStore";

export interface Summary {
  id: string;
  conversation_id: string;
  summary_text: string;
  key_takeaways: string[];
  technical_insights: string[];
  conversation_type: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  title: string;
  source_type: string;
  processed_status: string;
  created_at: string;
  raw_content?: string;
  summary?: Summary;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  loading: boolean;
  fetchConversations: (projectId: string) => Promise<void>;
  fetchConversationDetail: (id: string) => Promise<void>;
  pasteConversation: (projectId: string, title: string, sourceType: string, rawContent: string) => Promise<void>;
  uploadFile: (projectId: string, file: File) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  pollConversationStatus: (projectId: string, id: string) => void;
}

const getApiHeaders = () => {
  const session = useAuthStore.getState().session;
  return {
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

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  loading: false,

  fetchConversations: async (projectId: string) => {
    const isMock = useAuthStore.getState().isMock;
    set({ loading: true });

    if (isMock) {
      const cached = localStorage.getItem(`projectos_mock_convs_${projectId}`);
      const list = cached ? JSON.parse(cached) : [
        {
          id: "mock-conv-1",
          project_id: projectId,
          title: "Micro-ROS and trajectory node bug",
          source_type: "pasted_text",
          processed_status: "completed",
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: "mock-conv-2",
          project_id: projectId,
          title: "Database Indexing & pgvector migration discussion",
          source_type: "markdown",
          processed_status: "completed",
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        }
      ];
      if (!cached) {
        localStorage.setItem(`projectos_mock_convs_${projectId}`, JSON.stringify(list));
      }
      set({ conversations: list, loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/conversations`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data });
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      set({ loading: false });
    }
  },

  fetchConversationDetail: async (id: string) => {
    const isMock = useAuthStore.getState().isMock;
    set({ loading: true });

    if (isMock) {
      const allConvs = get().conversations;
      const conv = allConvs.find((c) => c.id === id);
      if (conv) {
        const detail: Conversation = {
          ...conv,
          raw_content: conv.id === "mock-conv-1" 
            ? "[User]: I am seeing a latency issue with our trajectory planning node on micro-ROS. It seems to lag by 200ms when calculating Spline paths.\n\n[Assistant]: The 200ms delay in trajectory calculations on micro-ROS is typically caused by memory allocation overhead in RTOS or theExecutor thread pool queue size. Let's analyze your executor configuration.\n\n[User]: We use a SingleThreadedExecutor on FreeRTOS.\n\n[Assistant]: Try switching to a StaticSingleThreadedExecutor to eliminate dynamic allocations during path computations."
            : "# Database Indexing Migration\n\nDiscussing the migration of our SQL tables to support vector embedding storage for project files.\n\nWe need to install pgvector extension and create an HNSW index using cosine similarity matching for all-MiniLM-L6-v2 which has 384 dimensions.",
          summary: {
            id: `mock-sum-${id}`,
            conversation_id: id,
            summary_text: conv.id === "mock-conv-1"
              ? "Debugging session resolving a 200ms trajectory computation latency issue on a micro-ROS robot platform running FreeRTOS."
              : "Technical planning note defining PostgreSQL migration steps to support pgvector storage and HNSW indexing for local embeddings.",
            key_takeaways: conv.id === "mock-conv-1"
              ? [
                  "Latency is exactly 200ms during Spline path calculations.",
                  "SingleThreadedExecutor on FreeRTOS introduces thread queues.",
                  "Static allocation is required to remove dynamic runtime allocations."
                ]
              : [
                  "Need pgvector extension active in PostgreSQL.",
                  "HNSW index provides faster scaling than IVFFlat.",
                  "Vector length set to 384 (all-MiniLM-L6-v2 model size)."
                ],
            technical_insights: conv.id === "mock-conv-1"
              ? [
                  "Switch from SingleThreadedExecutor to StaticSingleThreadedExecutor.",
                  "RTOS dynamic allocator is a primary source of path planner latency."
                ]
              : [
                  "Execute DDL adding hnsw index: CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops).",
                  "Use asyncpg driver for FastAPI connection pools."
                ],
            conversation_type: conv.id === "mock-conv-1" ? "debugging" : "architecture",
          }
        };
        set({ activeConversation: detail, loading: false });
      }
      return;
    }

    try {
      const res = await fetch(`${API_URL}/conversations/${id}`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        set({ activeConversation: data });
      }
    } catch (e) {
      console.error("Error fetching conversation detail:", e);
    } finally {
      set({ loading: false });
    }
  },

  pollConversationStatus: (projectId: string, id: string) => {
    const isMock = useAuthStore.getState().isMock;
    if (isMock) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/conversations/${id}`, {
          headers: getApiHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          
          // Update item in conversation list
          set((state) => {
            const list = state.conversations.map((c) =>
              c.id === id ? { ...c, processed_status: data.processed_status } : c
            );
            return {
              conversations: list,
              activeConversation: state.activeConversation?.id === id ? data : state.activeConversation,
            };
          });

          if (data.processed_status === "processing") {
            setTimeout(poll, 2500); // Poll again
          } else {
            // Finished! Re-fetch tasks to populate Kanban
            useTaskStore.getState().fetchTasks(projectId);
          }
        }
      } catch (err) {
        console.error("Failed to poll conversation status:", err);
      }
    };

    setTimeout(poll, 2000);
  },

  pasteConversation: async (projectId: string, title: string, sourceType: string, rawContent: string) => {
    const isMock = useAuthStore.getState().isMock;

    if (isMock) {
      const newId = `mock-conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        project_id: projectId,
        title,
        source_type: sourceType,
        processed_status: "processing",
        created_at: new Date().toISOString(),
      };
      
      const updatedList = [newConv, ...get().conversations];
      localStorage.setItem(`projectos_mock_convs_${projectId}`, JSON.stringify(updatedList));
      set({ conversations: updatedList });

      // Simulate async processing (2 seconds timer)
      setTimeout(() => {
        const currentList = get().conversations;
        const processedList = currentList.map((c) =>
          c.id === newId ? { ...c, processed_status: "completed" } : c
        );
        localStorage.setItem(`projectos_mock_convs_${projectId}`, JSON.stringify(processedList));
        set({ conversations: processedList });

        // Add a mock task to the mock tasks list
        const taskCacheKey = `projectos_mock_tasks_${projectId}`;
        const existingTasks = JSON.parse(localStorage.getItem(taskCacheKey) || "[]");
        const newTask = {
          id: `mock-task-${Date.now()}`,
          project_id: projectId,
          conversation_id: newId,
          title: `Analyze: ${title}`,
          description: `Extracted task from conversation log. Review context of ${title}.`,
          status: "todo",
          priority: "medium",
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(taskCacheKey, JSON.stringify([newTask, ...existingTasks]));
        useTaskStore.getState().fetchTasks(projectId);
      }, 2000);

      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/conversations`, {
        method: "POST",
        headers: {
          ...getApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, source_type: sourceType, raw_content: rawContent }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ conversations: [data, ...get().conversations] });
        get().pollConversationStatus(projectId, data.id);
      }
    } catch (e) {
      console.error("Error creating conversation paste:", e);
    }
  },

  uploadFile: async (projectId: string, file: File) => {
    const isMock = useAuthStore.getState().isMock;

    if (isMock) {
      await get().pasteConversation(
        projectId, 
        file.name.replace(/\.[^/.]+$/, ""),
        file.name.endsWith(".pdf") ? "pdf" : "uploaded_chat", 
        `Mock content parsed from uploaded file: ${file.name}`
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Omit Content-Type from headers to let fetch specify correct boundary
      const headers = getApiHeaders();
      const fetchHeaders: any = {};
      if (headers.Authorization) {
        fetchHeaders.Authorization = headers.Authorization;
      }

      const res = await fetch(`${API_URL}/projects/${projectId}/conversations/upload`, {
        method: "POST",
        headers: fetchHeaders,
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        set({ conversations: [data, ...get().conversations] });
        get().pollConversationStatus(projectId, data.id);
      }
    } catch (e) {
      console.error("Error uploading file:", e);
    }
  },

  deleteConversation: async (id: string) => {
    const isMock = useAuthStore.getState().isMock;
    const selectedProj = useProjectStore.getState().selectedProject;
    if (!selectedProj) return;

    if (isMock) {
      const updatedList = get().conversations.filter((c) => c.id !== id);
      localStorage.setItem(`projectos_mock_convs_${selectedProj.id}`, JSON.stringify(updatedList));
      set({
        conversations: updatedList,
        activeConversation: get().activeConversation?.id === id ? null : get().activeConversation,
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/conversations/${id}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        set({
          conversations: get().conversations.filter((c) => c.id !== id),
          activeConversation: get().activeConversation?.id === id ? null : get().activeConversation,
        });
      }
    } catch (e) {
      console.error("Error deleting conversation:", e);
    }
  },
}));
