import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

function ProtectedRoute({ children, requireRole }) {
  const { isAuthenticated, isInitializing, user } = useSession();

  if (isInitializing) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <p className="text-base text-slate-200" role="status" aria-live="polite">
          Loading secure session...
        </p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

export default ProtectedRoute;
