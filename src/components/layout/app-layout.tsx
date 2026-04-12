import {
  BookOpen,
  CalendarCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Receipt,
  School,
  Settings as SettingsIcon,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useCan } from "@/context/auth";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const can = useCan();
  const navigate = useNavigate();

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
      <aside className="w-64 border-e bg-[color:var(--color-card)] flex flex-col">
        <div className="p-6 border-b">
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
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
