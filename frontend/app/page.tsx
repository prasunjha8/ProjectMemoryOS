"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Lock, Mail, Terminal, Shield, Brain, Layers, RefreshCw } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, loading, isMock, mockLogin, initialize } = useAuthStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleMockLogin = () => {
    mockLogin(email || "dev@projectos.local");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsSubmitting(true);

    if (isMock) {
      handleMockLogin();
      setIsSubmitting(false);
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      // Attempt Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Attempt Sign Up if user not found (convenience for testing)
        if (error.message.includes("Invalid login credentials")) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: email.split("@")[0],
              },
            },
          });

          if (signUpError) {
            throw new Error(signUpError.message);
          } else {
            setAuthError("Account created! Please check your email for confirmation or try logging in.");
          }
        } else {
          throw new Error(error.message);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500">Initializing Memory OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#09090b] px-4 py-12 md:flex-row md:px-0 md:py-0 overflow-hidden">
      {/* Decorative gradient glow spheres */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Content wrapper */}
      <div className="z-10 flex w-full max-w-6xl flex-col md:flex-row md:h-[600px] items-center justify-between gap-12 lg:gap-24">
        {/* Left Side: Product Description */}
        <div className="flex flex-1 flex-col justify-center text-left max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 text-xs w-fit mb-6">
            <Terminal className="h-3.5 w-3.5 text-violet-400" />
            <span>AI Workspace Operating System</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:leading-[1.15]">
            Project <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">Memory OS</span>
          </h1>
          <p className="mt-4 text-base text-zinc-400 leading-relaxed">
            The intelligent project workspace that preserves, indexes, and organizes your development work across multiple LLM chats, files, and research notes.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
                <Brain className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Context Fragmentation Solved</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Upload, parse, and store chat logs from Claude, GPT-4, Gemini, and DeepSeek.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Auto Task Extraction</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Let AI automatically summarize meetings, extract decisions, and build Kanban boards.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 items-center justify-center rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">pgvector Semantic Search</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Instantly search past design decisions and code snippets with vector embedding indexes.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="w-full max-w-md shrink-0">
          <div className="glass-panel rounded-2xl border border-zinc-800/80 p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white tracking-tight">Access Workspace</h2>
            <p className="text-xs text-zinc-400 mt-1">Sign in or create your development profile.</p>

            {isMock && (
              <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs flex flex-col gap-1">
                <span className="font-semibold">Developer Mock Mode Active</span>
                <span>Supabase configurations not found. Using local simulated session state.</span>
              </div>
            )}

            {authError && (
              <div className="mt-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email Address</label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@domain.com"
                    className="w-full bg-[#121217]/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition"
                  />
                </div>
              </div>

              {!isMock && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#121217]/50 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg py-3 text-sm transition mt-6 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
              >
                {isSubmitting ? "Authenticating..." : isMock ? "Simulate Developer Login" : "Log In / Register"}
              </button>
            </form>

            {isMock && (
              <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
                <button
                  onClick={() => mockLogin("admin@memoryos.dev")}
                  className="text-xs text-zinc-400 hover:text-white transition underline cursor-pointer"
                >
                  Quick launch default admin workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
