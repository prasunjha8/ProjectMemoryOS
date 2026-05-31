"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTaskStore, Task } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import {
  Plus,
  Trash2,
  AlertOctagon,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronDown,
  Calendar,
  Layers,
  X,
  Edit2
} from "lucide-react";

const COLUMNS = [
  { id: "todo", name: "To Do", color: "border-zinc-800 bg-zinc-950/20 text-zinc-400" },
  { id: "in_progress", name: "In Progress", color: "border-blue-950/40 bg-blue-950/5 text-blue-400" },
  { id: "blocked", name: "Blocked", color: "border-rose-950/40 bg-rose-950/5 text-rose-400" },
  { id: "completed", name: "Completed", color: "border-emerald-950/40 bg-emerald-950/5 text-emerald-400" },
];

const PRIORITIES = [
  { id: "low", name: "Low", color: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50" },
  { id: "medium", name: "Medium", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "high", name: "High", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "critical", name: "Critical", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
];

export default function TasksPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { selectedProject, projects, selectProject } = useProjectStore();
  const { tasks, loading, fetchTasks, createTask, updateTaskStatus, updateTask, deleteTask } = useTaskStore();

  const [isAddingTask, setIsAddingTask] = useState<string | null>(null); // holds column ID where task is being added
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("medium");

  const handleEditTaskSubmit = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    try {
      await updateTask(taskId, {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
      });
      setEditingTaskId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
    setEditPriority(task.priority);
  };

  useEffect(() => {
    if (projectId) {
      fetchTasks(projectId);

      // Restore selected project if reloaded
      if (!selectedProject && projects.length > 0) {
        const found = projects.find((p) => p.id === projectId);
        if (found) selectProject(found);
      }
    }
  }, [projectId, fetchTasks, projects, selectedProject, selectProject]);

  const handleAddTaskSubmit = async (e: React.FormEvent, columnId: string) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await createTask(projectId, taskTitle, taskDesc, taskPriority);
      
      // If we are in mock mode, the new task is created and fetched, but if we updated the status from 'todo',
      // we can do that right after. In our store, createTask initializes status to 'todo'.
      const newlyCreatedTask = useTaskStore.getState().tasks[0];
      if (newlyCreatedTask && columnId !== "todo") {
        await updateTaskStatus(newlyCreatedTask.id, columnId);
      }

      setTaskTitle("");
      setTaskDesc("");
      setTaskPriority("medium");
      setIsAddingTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  const moveTask = async (taskId: string, targetStatus: string) => {
    await updateTaskStatus(taskId, targetStatus);
  };

  const getPriorityBadge = (priority: string) => {
    const found = PRIORITIES.find((p) => p.id === priority) || PRIORITIES[1];
    return (
      <span className={`px-2 py-0.5 rounded border text-[9px] font-semibold uppercase ${found.color}`}>
        {found.name}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto animate-fade-in text-left">
      {/* Board title and actions */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white tracking-tight">Project Action Items</h2>
          <p className="text-xs text-zinc-400">Manage tasks extracted from your LLM sessions and notes.</p>
        </div>
      </div>

      {/* Grid of columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start flex-1 min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className={`glass-panel border rounded-xl flex flex-col max-h-[75vh] min-h-[300px] overflow-hidden ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-zinc-900/60 bg-zinc-950/40 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {col.name}
                  </span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-zinc-500">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsAddingTask(col.id)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition cursor-pointer"
                  title="Add task"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Adding Task Form */}
              {isAddingTask === col.id && (
                <div className="p-3 border-b border-zinc-900 bg-zinc-950/20 shrink-0 animate-fade-in">
                  <form onSubmit={(e) => handleAddTaskSubmit(e, col.id)} className="space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Task title..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none"
                    />
                    <textarea
                      placeholder="Details (optional)"
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none resize-none"
                    />

                    <div className="flex items-center justify-between">
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="bg-[#121217] border border-zinc-800 rounded p-1 text-[10px] text-zinc-300 outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>

                      <div className="flex gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setIsAddingTask(null)}
                          className="px-2.5 py-1.5 border border-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition cursor-pointer font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Tasks List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colTasks.length === 0 ? (
                  <div className="text-[10px] text-zinc-600 py-8 text-center italic">
                    No items here
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="glass-panel border border-zinc-850/80 rounded-xl p-3.5 hover:border-zinc-700/50 transition flex flex-col gap-2 group text-left relative bg-zinc-950/10"
                    >
                      {editingTaskId === task.id ? (
                        <form onSubmit={(e) => handleEditTaskSubmit(e, task.id)} className="space-y-3">
                          <input
                            type="text"
                            required
                            placeholder="Task title..."
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none"
                          />
                          <textarea
                            placeholder="Details (optional)"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={2}
                            className="w-full bg-[#121217] border border-zinc-800 focus:border-violet-500 rounded-lg p-2 text-xs text-white outline-none resize-none"
                          />

                          <div className="flex items-center justify-between">
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value)}
                              className="bg-[#121217] border border-zinc-800 rounded p-1 text-[10px] text-zinc-300 outline-none"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>

                            <div className="flex gap-1.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditingTaskId(null)}
                                className="px-2 py-1 border border-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded transition cursor-pointer font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-white leading-snug break-words">
                              {task.title}
                            </span>
                            
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => startEditing(task)}
                                className="text-zinc-500 hover:text-white transition p-0.5 cursor-pointer"
                                title="Edit task"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-zinc-600 hover:text-red-400 transition p-0.5 cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                              {task.description}
                            </p>
                          )}

                          {/* Footer: Priority & Status Mover */}
                          <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-1.5">
                            {getPriorityBadge(task.priority)}

                            {/* Status switcher */}
                            <div className="relative inline-block text-left">
                              <select
                                value={task.status}
                                onChange={(e) => moveTask(task.id, e.target.value)}
                                className="bg-transparent text-zinc-500 hover:text-zinc-300 font-semibold text-[9px] uppercase tracking-wider outline-none cursor-pointer border border-transparent hover:border-zinc-800 rounded px-1 transition"
                              >
                                <option value="todo">Todo</option>
                                <option value="in_progress">Active</option>
                                <option value="blocked">Blocked</option>
                                <option value="completed">Done</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
