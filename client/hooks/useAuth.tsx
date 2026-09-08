import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthResponse, User } from "@shared/api";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  authReady: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "comicLibraryAuth";

function getStoredAuth(): { user: User | null; token: string | null } {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return {
      user: parsed.user ?? null,
      token: typeof parsed.token === "string" ? parsed.token : null,
    };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = getStoredAuth();
  const [user, setUser] = useState<User | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [authReady, setAuthReady] = useState(!initial.token);
  const userRef = useRef<User | null>(initial.user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const logout = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setToken(null);
    setAuthReady(true);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback((data: AuthResponse) => {
    userRef.current = data.user;
    setUser(data.user);
    setToken(data.token);
    setAuthReady(true);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setAuthReady(true);
      return null;
    }

    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logout();
          return null;
        }
        return userRef.current;
      }

      const data = await response.json();
      if (!data?.user) {
        logout();
        return null;
      }

      userRef.current = data.user;
      setUser(data.user);
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, user: data.user }),
      );
      return data.user as User;
    } catch {
      return userRef.current;
    } finally {
      setAuthReady(true);
    }
  }, [logout, token]);

  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      return;
    }

    void refreshUser();

    const interval = window.setInterval(() => {
      void refreshUser();
    }, 5 * 60_000);

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshUser();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [token, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAdmin: user?.role === "admin",
      authReady,
      login,
      logout,
      refreshUser,
    }),
    [user, token, authReady, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
