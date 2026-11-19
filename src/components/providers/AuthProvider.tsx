"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/core/types/domain";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  favoriteIds: Set<string>;
  refreshProfile: () => Promise<void>;
  toggleFavorite: (listingId: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadUserContext = useCallback(async (activeUser: User | null) => {
    if (!activeUser) {
      setProfile(null);
      setFavoriteIds(new Set());
      return;
    }

    try {
      const [profileRes, favRes] = await Promise.all([
        fetch("/api/v1/profile"),
        fetch("/api/v1/favorites"),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile ?? null);
      }
      if (favRes.ok) {
        const favData = await favRes.json();
        setFavoriteIds(new Set<string>(favData.favoriteIds ?? []));
      }
    } catch {
      // Keep graceful state on transient network errors
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      loadUserContext(data.user ?? null).finally(() => {
        if (active) setLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      loadUserContext(nextUser).finally(() => setLoading(false));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadUserContext]);

  const refreshProfile = useCallback(async () => {
    await loadUserContext(user);
  }, [loadUserContext, user]);

  const toggleFavorite = useCallback(
    async (listingId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) {
        return { ok: false, error: "Inicia sesión para guardar prendas." };
      }

      const wasFavorited = favoriteIds.has(listingId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      const res = await fetch("/api/v1/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      if (!res.ok) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
        return { ok: false, error: "No pudimos actualizar favoritos." };
      }

      return { ok: true };
    },
    [favoriteIds, user]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setFavoriteIds(new Set());
  }, [supabase]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      favoriteIds,
      refreshProfile,
      toggleFavorite,
      signOut,
    }),
    [user, profile, loading, favoriteIds, refreshProfile, toggleFavorite, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
