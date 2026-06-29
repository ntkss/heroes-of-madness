"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  auth,
  syncUserDoc,
  checkBootstrapExists,
  bootstrapFirstAdmin,
  isFirebaseConfigured,
} from "./firebase";

interface AuthContextType {
  user: User | null;
  role: "admin" | "user" | null;
  loading: boolean;
  isAdmin: boolean;
  isBootstrapPending: boolean;
  bootstrapAdmin: () => Promise<boolean>;
  login: () => Promise<unknown>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [isBootstrapPending, setIsBootstrapPending] = useState(false);

  const login = async () => {
    const { signInWithGoogle } = await import("./firebase");
    return signInWithGoogle();
  };

  const logout = async () => {
    const { signOutUser } = await import("./firebase");
    await signOutUser();
  };

  const checkBootstrap = async () => {
    const exists = await checkBootstrapExists();
    setIsBootstrapPending(!exists);
  };

  const bootstrapAdmin = async () => {
    if (!user) return false;
    const success = await bootstrapFirstAdmin(user);
    if (success) {
      setRole("admin");
      setIsBootstrapPending(false);
    }
    return success;
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return;
    }

    // Check if bootstrap exists once initially
    setTimeout(() => {
      checkBootstrap();
    }, 0);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        try {
          const profile = await syncUserDoc(currentUser);
          setRole(profile.role);
          // Re-evaluate bootstrap status in case we just bootstrapped
          const exists = await checkBootstrapExists();
          setIsBootstrapPending(!exists);
        } catch (e) {
          console.error("Auth sync error:", e);
          setRole("user");
        } finally {
          setLoading(false);
        }
      } else {
        setRole(null);
        setLoading(false);
        // Refresh bootstrap check when logged out
        checkBootstrap();
      }
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        isAdmin,
        isBootstrapPending,
        bootstrapAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
