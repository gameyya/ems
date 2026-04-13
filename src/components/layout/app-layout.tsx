import {
  BookOpen,
  CalendarCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  School,
  Settings as SettingsIcon,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useCan } from "@/context/auth";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const can = useCan();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("nav.dashboard"), show: true },
    { to: "/students", icon: GraduationCap, label: t("nav.students"), show: true },
    { to: "/teachers", icon: BookOpen, label: t("nav.teachers"), show: true },
    { to: "/classes", icon: School, label: t("nav.classes"), show: true },
    { to: "/payments", icon: Wallet, label: t("nav.payments"), show: can.canManagePayments },
    {
      to: "/attendance",
      icon: CalendarCheck,
      label: t("nav.attendance"),
      show: can.canManageClasses,
    },
    { to: "/reports", icon: FileText, label: t("nav.reports"), show: can.canViewReports },
    { to: "/settings", icon: SettingsIcon, label: t("nav.settings"), show: can.canManageSettings },
  ].filter((i) => i.show);

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <button
          type="button"
          aria-label="close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 w-64 border-e bg-[color:var(--color-card)] flex flex-col transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[color:var(--color-primary)] text-white grid place-items-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">{t("app.name")}</div>
              <div className="text-xs text-[color:var(--color-muted-foreground)]">
                {profile?.full_name}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="close menu"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-[color:var(--color-accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "hover:bg-[color:var(--color-accent)]",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 p-2 rounded-md bg-[color:var(--color-muted)] mb-2 text-xs">
            <Users className="h-3 w-3" />
            <span>{t(`roles.${profile?.role ?? "staff"}`)}</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-[color:var(--color-destructive)] hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-[color:var(--color-card)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-[color:var(--color-primary)] text-white grid place-items-center">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="font-semibold text-sm truncate">{t("app.shortName")}</div>
          </div>
          <button
            type="button"
            aria-label="open menu"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded hover:bg-[color:var(--color-accent)]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
