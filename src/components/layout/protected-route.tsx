import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import type { UserRole } from "@/types/db";

export function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: UserRole[];
}) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-[color:var(--color-muted-foreground)]">جارٍ التحميل...</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allow && profile && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
