import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../data/AuthContext";

// Gate a route behind a logged-in customer. While the session is still being
// resolved we render nothing (avoids a flash of the login page); once resolved,
// unauthenticated visitors are sent to /login with the intended path so they
// can be returned there after signing in.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
