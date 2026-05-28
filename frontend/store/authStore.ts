import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
  isMock: boolean;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  mockLogin: (email: string) => void;
}

const isKeysMissing =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  isMock: isKeysMissing,

  initialize: async () => {
    set({ loading: true });
    
    if (isKeysMissing) {
      // Simulate/Retrieve Mock Session from localStorage
      const cachedUser = localStorage.getItem("projectos_mock_user");
      if (cachedUser) {
        set({
          user: JSON.parse(cachedUser),
          session: { access_token: "mock-jwt-token" },
          isMock: true,
          initialized: true,
          loading: false,
        });
      } else {
        set({
          user: null,
          session: null,
          isMock: true,
          initialized: true,
          loading: false,
        });
      }
      return;
    }

    try {
      // Check active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({
          session,
          user: {
            id: session.user.id,
            email: session.user.email || "",
            full_name: session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url,
          },
        });
      }

      // Set up listener for auth state changes
      supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (session) {
          set({
            session,
            user: {
              id: session.user.id,
              email: session.user.email || "",
              full_name: session.user.user_metadata?.full_name,
              avatar_url: session.user.user_metadata?.avatar_url,
            },
            loading: false,
          });
        } else {
          set({ user: null, session: null, loading: false });
        }
      });

      set({ initialized: true, loading: false });
    } catch (error) {
      console.error("Supabase Auth Initialization failed:", error);
      set({ initialized: true, loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    if (isKeysMissing) {
      localStorage.removeItem("projectos_mock_user");
      set({ user: null, session: null, loading: false });
      return;
    }

    await supabase.auth.signOut();
    set({ user: null, session: null, loading: false });
  },

  mockLogin: (email: string) => {
    const mockUser: UserProfile = {
      id: "00000000-0000-0000-0000-000000000000",
      email: email || "dev@projectos.local",
      full_name: "Local Developer",
      avatar_url: "",
    };
    localStorage.setItem("projectos_mock_user", JSON.stringify(mockUser));
    set({
      user: mockUser,
      session: { access_token: "mock-jwt-token" },
      isMock: true,
      loading: false,
    });
  },
}));
