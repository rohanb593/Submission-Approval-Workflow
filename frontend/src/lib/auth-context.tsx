"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as api from "@/lib/api";

const STORAGE_KEY = "submission-approval-auth";

interface StoredSession {
  token: string;
  user: api.User;
}

interface AuthContextValue {
  user: api.User | null;
  token: string | null;
  // true until the initial localStorage read completes, so pages can avoid
  // flashing a "logged out" state before hydration catches up.
  isLoading: boolean;
  login: (email: string, password: string) => Promise<api.User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Deliberately deferred to an effect rather than a useState lazy
    // initializer: localStorage doesn't exist during SSR, so reading it
    // during render would either crash on the server or desync the first
    // client render from the server-sent HTML (a hydration mismatch).
    // Running once after mount keeps both initial renders as isLoading=true.
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(JSON.parse(raw));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login(email, password);
    const next = { token, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return user;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token: session?.token ?? null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
