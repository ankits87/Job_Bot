import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function readTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

export default function AuthGuard() {
  // Primary: Zustand in-memory state
  // Fallback: read localStorage directly (handles fresh page loads before hydration)
  const storeToken = useAuthStore((s) => s.token);
  const token = storeToken ?? readTokenFromStorage();

  if (!token) return <Navigate to="/" replace />;
  return <Outlet />;
}
