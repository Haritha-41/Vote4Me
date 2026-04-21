import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, loginUser, logoutUser } from "../services/api";
import { clearStoredToken, getStoredToken, setStoredToken } from "../utils/session";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      if (!token) {
        setIsInitializing(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (cancelled) return;
        setUser(currentUser.user);
      } catch (error) {
        if (cancelled) return;
        clearStoredToken();
        setToken(null);
        setUser(null);
        setAuthError("Session expired. Please sign in again.");
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login(credentials) {
    const response = await loginUser(credentials);
    setStoredToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setAuthError("");
    navigate(response.user?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }

  async function logout() {
    if (token) {
      try {
        await logoutUser(token);
      } catch {
        // Ignore logout failures and clear local state anyway.
      }
    }

    clearStoredToken();
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isInitializing,
      authError,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      setUser,
    }),
    [token, user, isInitializing, authError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}
