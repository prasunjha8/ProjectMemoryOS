"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api-client";
import { 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  Compass, 
  Layers, 
  Brain, 
  HelpCircle,
  TrendingUp,
  Info,
  Plus,
  CheckSquare,
  Calendar,
  CheckCircle
} from "lucide-react";

interface RecentActivityItem {
  description: string;
  category: string;
}

interface NextStepItem {
  action: string;
  priority: string;
}

interface BlockerItem {
  problem: string;
  impact: string;
}

interface ConversationFlowItem {
  id: string;
  title: string;
  created_at: string;
  source_type: string;
  processed_status: string;
  summary_text?: string;
}

interface ResumeContextData {
  project_summary: string;
  recent_activity: RecentActivityItem[];
  open_tasks: string[];
  blockers: BlockerItem[];
  recent_decisions: string[];
  next_steps: NextStepItem[];
  important_context: string[];
  completed_tasks_count: number;
  total_tasks_count: number;
  completion_percentage: number;
  completed_tasks: string[];
  incomplete_tasks: string[];
  conversation_flow: ConversationFlowItem[];
}

interface ResumeContextCardProps {
  projectId: string;
}

export default function ResumeContextCard({ projectId }: ResumeContextCardProps) {
  const { session, isMock } = useAuthStore();
  const [data, setData] = useState<ResumeContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [addingTaskIndex, setAddingTaskIndex] = useState<number | null>(null);
  const [addedTaskIndices, setAddedTaskIndices] = useState<Set<number>>(new Set());
  const [activeTaskTab, setActiveTaskTab] = useState<"left" | "done">("left");

  const handleAddRecommendedTask = async (actionText: string, priority: string, index: number) => {
    setAddingTaskIndex(index);
    try {
      if (isMock) {
        // Mock success delay
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        await apiClient.post(`/projects/${projectId}/tasks`, {
          title: actionText,
          description: "Extracted from recommended workspace actions.",
          priority: priority,
          status: "todo"
        });
      }
      setAddedTaskIndices((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    } catch (err) {
      console.error("Failed to add recommended task:", err);
    } finally {
      setAddingTaskIndex(null);
    }
  };

  useEffect(() => {
    let active = true;

    async function fetchResumeContext() {
      setLoading(true);
      setError(null);

      if (isMock) {
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!active) return;

        // Provide beautiful mock project continuity state
        const mockData: ResumeContextData = {
          project_summary: "Self-balancing robot tuning project using MPU6050 sensor readings, Kalman filter integration, and an ESP32 microcontroller.",
          recent_activity: [
            { description: "Discussed derivative overshooting during rapid corrections", category: "debugging" },
            { description: "Adjusted PWM capping logic to limit motor saturation spikes", category: "code" },
            { description: "Experimented with Kalman filter covariance tuning parameters", category: "planning" }
          ],
          open_tasks: [
            "Reduce motor saturation spikes at extreme angles",
            "Fine tune derivative gains (Kd) in balancing loops",
            "Implement digital low-pass filtering on encoder ticks"
          ],
          blockers: [
            { problem: "High-frequency encoder noise causing motor control instability", impact: "high" }
          ],
          recent_decisions: [
            "Keep the Kalman filter enabled for pitch angle calculation",
            "Limit maximum motor control PWM duty cycle to 180"
          ],
          next_steps: [
            { action: "Test balancing loop with lower Proportional gains (Kp)", priority: "high" },
            { action: "Collect and plot fresh IMU telemetry over serial plotter", priority: "medium" },
            { action: "Run outdoor balancing test session on smooth concrete surface", priority: "low" }
          ],
          important_context: [
            "PID controller output must stay close to zero during equilibrium states.",
            "ESP32 control loop freezes when motor current peaks exceed 2.2 Amps."
          ],
          completed_tasks_count: 2,
          total_tasks_count: 5,
          completion_percentage: 40.0,
          completed_tasks: [
            "Hardware assembly of balance robot frame",
            "Install ESP32 toolchain and compile basic blink sketch"
          ],
          incomplete_tasks: [
            "Reduce motor saturation spikes at extreme angles",
            "Fine tune derivative gains (Kd) in balancing loops",
            "Implement digital low-pass filtering on encoder ticks"
          ],
          conversation_flow: [
            {
              id: "mock-flow-1",
              title: "Initial balance robot architecture design",
              created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
              source_type: "pasted_text",
              processed_status: "completed",
              summary_text: "System specification and architectural design for an ESP32 self-balancing robot utilizing an MPU6050 IMU sensor and complementary Kalman filtering."
            },
            {
              id: "mock-flow-2",
              title: "Debugging PID loop saturation issues",
              created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
              source_type: "uploaded_chat",
              processed_status: "completed",
              summary_text: "Debugging session focusing on PWM duty cycle limits, motor current spikes, and tuning derivative gains (Kd) to eliminate oscillation."
            }
          ]
        };

        setData(mockData);
        setLoading(false);
        return;
      }

      try {
        const json = await apiClient.get<ResumeContextData>(`/projects/${projectId}/resume`, {
          token: session?.access_token || undefined,
        });

        if (active) {
          setData(json);
        }
      } catch (err: any) {
        if (active) {
          setError(err.detail || err.message || "Something went wrong");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (projectId) {
      fetchResumeContext();
    }

    return () => {
      active = false;
    };
  }, [projectId, session, isMock]);

  if (loading) {
    return (
      <div className="glass-panel border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6 animate-pulse w-full bg-zinc-950/20">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-zinc-800" />
          <div className="h-5 w-48 rounded bg-zinc-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-zinc-800" />
            <div className="h-16 w-full rounded bg-zinc-800" />
            <div className="h-3 w-32 rounded bg-zinc-800" />
          </div>
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-zinc-800" />
            <div className="h-3 w-full rounded bg-zinc-800" />
            <div className="h-3 w-5/6 rounded bg-zinc-800" />
            <div className="h-3.5 w-full rounded bg-zinc-800" />
          </div>
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-zinc-800" />
            <div className="h-10 w-full rounded bg-zinc-800/60" />
            <div className="h-3 w-full rounded bg-zinc-800" />
            <div className="h-3 w-2/3 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel border border-red-900/50 bg-red-950/5 rounded-2xl p-5 text-left flex items-start gap-3 w-full">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Cognitive Resume Load Failed</h4>
          <p className="text-xs text-zinc-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="glass-panel border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6 w-full bg-zinc-950/20 text-left relative overflow-hidden">
      {/* Absolute faint top ambient light */}
      <div className="absolute top-0 right-0 h-[120px] w-[250px] rounded-full bg-violet-500/5 blur-[50px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400 shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Resume Workspace</h3>
            <p className="text-[10px] text-zinc-500 font-medium">AI-generated project continuity snapshot to reduce cognitive reload</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Overview, Decisions & Progress */}
        <div className="md:col-span-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-zinc-400" /> Focus Overview
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 border border-zinc-900/50 p-3.5 rounded-xl font-medium">
              {data.project_summary}
            </p>
          </div>

          {/* Work Progress Section */}
          <div className="flex flex-col gap-2 bg-zinc-900/10 border border-zinc-900/50 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="h-3 w-3 text-violet-400" /> Work Progress
              </span>
              <span className="text-[10px] font-bold text-zinc-400">
                {data.completion_percentage}% Done
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
              <div 
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500 animate-pulse" 
                style={{ width: `${data.completion_percentage}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-[9px] text-zinc-500 font-semibold mt-1">
              <span>{data.completed_tasks_count} Completed</span>
              <span>{data.total_tasks_count - data.completed_tasks_count} Left</span>
            </div>

            {/* Completed vs Incomplete Toggles */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-900/40">
              <button
                type="button"
                onClick={() => setActiveTaskTab("left")}
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition cursor-pointer ${
                  activeTaskTab === "left"
                    ? "bg-zinc-800 text-white border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                }`}
              >
                To Do / In Progress ({data.incomplete_tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTaskTab("done")}
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition cursor-pointer ${
                  activeTaskTab === "done"
                    ? "bg-zinc-800 text-white border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                }`}
              >
                Completed ({data.completed_tasks.length})
              </button>
            </div>

            {/* Tasks List */}
            <div className="max-h-28 overflow-y-auto mt-2 space-y-1.5 pr-1">
              {activeTaskTab === "left" ? (
                data.incomplete_tasks.length === 0 ? (
                  <span className="text-[10px] text-zinc-500 italic block py-2">No pending tasks! All main work is done.</span>
                ) : (
                  data.incomplete_tasks.map((task, i) => (
                    <div key={i} className="text-[10px] text-zinc-300 bg-zinc-950/30 border border-zinc-900/60 p-2 rounded flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate">{task}</span>
                    </div>
                  ))
                )
              ) : (
                data.completed_tasks.length === 0 ? (
                  <span className="text-[10px] text-zinc-500 italic block py-2">No tasks completed yet.</span>
                ) : (
                  data.completed_tasks.map((task, i) => (
                    <div key={i} className="text-[10px] text-zinc-400 bg-zinc-950/20 border border-zinc-900/40 p-2 rounded flex items-center gap-2 line-through opacity-70">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{task}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-zinc-400" /> Key Decisions Made
            </span>
            <ul className="space-y-2">
              {data.recent_decisions.length === 0 ? (
                <li className="text-xs text-zinc-500 italic">No recent decisions documented.</li>
              ) : (
                data.recent_decisions.map((decision, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 bg-zinc-900/10 border border-zinc-900/30 p-2 rounded-lg font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <span>{decision}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Center Column (4 cols): Recent Activity Timeline */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-zinc-400" /> Recent Activity Timeline
          </span>
          <div className="relative border-l border-zinc-900 pl-4 ml-2.5 py-1 space-y-4">
            {data.recent_activity.length === 0 ? (
              <span className="text-xs text-zinc-500 italic block">No recent activity detected.</span>
            ) : (
              data.recent_activity.map((activity, i) => (
                <div key={i} className="relative">
                  {/* Point bullet */}
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-zinc-950 bg-violet-500 shadow-md shadow-violet-500/25" />
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-300 leading-tight font-medium">{activity.description}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">
                      {activity.category}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (3 cols): Next Steps & Blockers */}
        <div className="md:col-span-3 flex flex-col gap-5">
          {/* Blockers */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-zinc-400" /> Active Blockers
            </span>
            <div className="space-y-2">
              {data.blockers.length === 0 || (data.blockers.length === 1 && data.blockers[0].problem.includes("No immediate blockers")) ? (
                <div className="text-xs text-zinc-500 italic p-3 border border-zinc-900 rounded-xl bg-zinc-900/10">
                  Clear flight. No active blockers.
                </div>
              ) : (
                data.blockers.map((blocker, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-xl border flex flex-col gap-1 text-xs font-semibold ${
                      blocker.impact === "high" 
                        ? "border-red-950 bg-red-950/10 text-red-300"
                        : blocker.impact === "medium"
                        ? "border-amber-950 bg-amber-950/10 text-amber-300"
                        : "border-zinc-800 bg-zinc-900/20 text-zinc-300"
                    }`}
                  >
                    <span className="font-bold text-[9px] uppercase tracking-wider opacity-90">
                      {blocker.impact} Impact Blocker
                    </span>
                    <span className="leading-tight">{blocker.problem}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="h-3 w-3 text-zinc-400" /> Recommended Actions
            </span>
            <ul className="space-y-2 text-xs">
              {data.next_steps.map((step, i) => {
                const isAdded = addedTaskIndices.has(i);
                const isAdding = addingTaskIndex === i;

                return (
                  <li 
                    key={i} 
                    className="flex flex-col gap-2.5 bg-zinc-900/30 border border-zinc-900/50 p-3 rounded-xl text-left"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-zinc-300 leading-normal font-medium break-words flex-1">
                        {step.action}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                        step.priority === "high" || step.priority === "critical"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : step.priority === "medium"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {step.priority}
                      </span>
                    </div>

                    <div className="flex justify-end border-t border-zinc-900/30 pt-2">
                      <button
                        type="button"
                        onClick={() => !isAdded && !isAdding && handleAddRecommendedTask(step.action, step.priority, i)}
                        disabled={isAdded || isAdding}
                        className={`flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded border transition ${
                          isAdded
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default"
                            : "bg-violet-600/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20 cursor-pointer"
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <span className="h-2 w-2 animate-spin rounded-full border border-t-transparent border-violet-400 mr-1" />
                            <span>Adding...</span>
                          </>
                        ) : isAdded ? (
                          <span>✓ Added to Board</span>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            <span>Add to Board</span>
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Chronological Ingestion Flow Timeline Section */}
      <div className="border-t border-zinc-900 pt-5 mt-2 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-zinc-400" /> Project Evolution & Ingestion Flow
          </span>
          <p className="text-[10px] text-zinc-500 font-medium">Chronological flow of your engineering sessions and knowledge logs</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.conversation_flow && data.conversation_flow.length > 0 ? (
            data.conversation_flow.map((flowItem, index) => {
              const isFirst = index === 0;
              return (
                <div 
                  key={flowItem.id} 
                  className="glass-panel border border-zinc-800/60 bg-zinc-950/10 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden"
                >
                  {/* Step indicator tag */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      isFirst 
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      Step {index + 1}: {isFirst ? "Project Spec / Plan" : "Implementation Session"}
                    </span>
                    <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(flowItem.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold text-white truncate">
                      {flowItem.title}
                    </span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">
                      Source: {flowItem.source_type.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-relaxed italic border-l border-zinc-800 pl-2.5">
                    {flowItem.summary_text || "No summary text generated. Conversation processed successfully."}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="sm:col-span-2 text-xs text-zinc-500 italic p-4 text-center border border-dashed border-zinc-800 rounded-xl">
              No conversation flow recorded. Please upload or paste logs to track the project's evolution.
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Box: Important Context Notes */}
      {data.important_context && data.important_context.length > 0 && (
        <div className="border-t border-zinc-900 pt-4 mt-1 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="h-3 w-3 text-zinc-400" /> Important Technical Context & Alerts
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.important_context.map((context, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-900 bg-zinc-900/10">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 mt-2 shrink-0 animate-pulse" />
                <span className="text-xs text-zinc-400 leading-normal font-medium">{context}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
