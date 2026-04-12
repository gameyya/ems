import { BookOpen, GraduationCap, Plus, Receipt, School, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`h-12 w-12 rounded-lg grid place-items-center ${tint}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-[color:var(--color-muted-foreground)]">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: stats } = useSupabaseQuery(async () => {
    const firstDay = new Date();
    firstDay.setDate(1);
    firstDay.setHours(0, 0, 0, 0);

    const [students, teachers, classes, paymentsMonth, recent] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("teachers").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("classes").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase
        .from("payments")
        .select("amount")
        .is("cancelled_at", null)
        .gte("payment_date", firstDay.toISOString().slice(0, 10)),
      supabase
        .from("payments")
        .select("id, receipt_code, amount, payment_date, student:students(full_name)")
        .is("cancelled_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const totalMonth = (paymentsMonth.data ?? []).reduce((s, p) => s + Number(p.amount), 0) ?? 0;

    return {
      data: {
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        paymentsMonth: totalMonth,
        recentPayments: (recent.data ?? []) as unknown as Array<{
          id: string;
          receipt_code: string;
          amount: number;
          payment_date: string;
          student: { full_name: string } | null;
        }>,
      },
      error: null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} description={t("app.name")} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.stats.students")}
          value={stats?.students ?? "—"}
          icon={GraduationCap}
          tint="bg-blue-100 text-blue-700"
        />
        <StatCard
          label={t("dashboard.stats.teachers")}
          value={stats?.teachers ?? "—"}
          icon={BookOpen}
          tint="bg-purple-100 text-purple-700"
        />
        <StatCard
          label={t("dashboard.stats.classes")}
          value={stats?.classes ?? "—"}
          icon={School}
          tint="bg-amber-100 text-amber-700"
        />
        <StatCard
          label={t("dashboard.stats.paymentsThisMonth")}
          value={stats ? formatCurrency(stats.paymentsMonth) : "—"}
          icon={Wallet}
          tint="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.recentPayments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentPayments.length ? (
              <div className="divide-y">
                {stats.recentPayments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.student?.full_name ?? "—"}</div>
                      <div className="text-xs text-[color:var(--color-muted-foreground)] font-mono">
                        {p.receipt_code} · {formatDate(p.payment_date)}
                      </div>
                    </div>
                    <div className="font-bold text-emerald-600">
                      {formatCurrency(Number(p.amount))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--color-muted-foreground)] text-center py-6">
                {t("common.noResults")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/students">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4" />
                {t("dashboard.newStudent")}
              </Button>
            </Link>
            <Link to="/payments">
              <Button variant="outline" className="w-full justify-start">
                <Receipt className="h-4 w-4" />
                {t("dashboard.newPayment")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
