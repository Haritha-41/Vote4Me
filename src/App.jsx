import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { SessionProvider } from "./hooks/useSession";
import Landing from "./pages/Landing";
import AdminDashboard from "./pages/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Vote from "./pages/Vote";

function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireRole="voter">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/voting"
          element={
            <ProtectedRoute requireRole="voter">
              <Vote />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}

export default App;
