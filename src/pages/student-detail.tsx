import { ArrowRight, Mail, MapPin, Phone, Printer, User, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Student } from "@/types/db";

interface PaymentRow {
  id: string;
  receipt_code: string;
  amount: number;
  method: string;
  payment_date: string;
  cancelled_at: string | null;
}

interface EnrollmentRow {
  class_id: string;
  class: {
    id: string;
    name: string;
    code: string;
    schedule_time: string | null;
    teacher: { full_name: string } | null;
  } | null;
}

interface AttendanceRow {
  status: "present" | "absent" | "late" | "excused";
}

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: student, loading } = useSupabaseQuery(async () => {
    if (!studentId) return { data: null, error: { message: "no id" } };
    const res = await supabase.from("students").select("*").eq("id", studentId).single();
    return { data: res.data as Student | null, error: res.error };
  }, [studentId]);

  const { data: payments } = useSupabaseQuery(async () => {
    if (!studentId) return { data: [], error: null };
    const res = await supabase
      .from("payments")
      .select("id, receipt_code, amount, method, payment_date, cancelled_at")
      .eq("student_id", studentId)
      .order("payment_date", { ascending: false });
    return { data: (res.data ?? []) as PaymentRow[], error: res.error };
  }, [studentId]);

  const { data: enrollments } = useSupabaseQuery(async () => {
    if (!studentId) return { data: [], error: null };
    const res = await supabase
      .from("enrollments")
      .select("class_id, class:classes(id, name, code, schedule_time, teacher:teachers(full_name))")
      .eq("student_id", studentId);
    return { data: (res.data ?? []) as unknown as EnrollmentRow[], error: res.error };
  }, [studentId]);

  const { data: attendance } = useSupabaseQuery(async () => {
    if (!studentId) return { data: [], error: null };
    const res = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", studentId);
    return { data: (res.data ?? []) as AttendanceRow[], error: res.error };
  }, [studentId]);

  const filteredPayments = useMemo(() => {
    return (payments ?? []).filter((p) => {
      if (fromDate && p.payment_date < fromDate) return false;
      if (toDate && p.payment_date > toDate) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const filteredTotals = useMemo(() => {
    const active = filteredPayments.filter((p) => !p.cancelled_at);
    return {
      paid: active.reduce((s, p) => s + Number(p.amount), 0),
      count: active.length,
      cancelled: filteredPayments.length - active.length,
    };
  }, [filteredPayments]);

  const attendanceStats = useMemo(() => {
    const rows = attendance ?? [];
    const total = rows.length;
    const present = rows.filter((a) => a.status === "present").length;
    const absent = rows.filter((a) => a.status === "absent").length;
    const late = rows.filter((a) => a.status === "late").length;
    return { total, present, absent, late };
  }, [attendance]);

  if (loading) return <div className="p-8">{t("common.loading")}</div>;
  if (!student) return <div className="p-8">{t("common.noResults")}</div>;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/students")}>
          <ArrowRight className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </div>

      <PageHeader
        title={student.full_name}
        description={
          <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
            {student.code}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("students.detail.info")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={User} label={t("students.parentName")} value={student.parent_name} />
              <InfoRow
                icon={Phone}
                label={t("common.phone")}
                value={student.phone}
                dir="ltr"
              />
              <InfoRow
                icon={Phone}
                label={t("students.parentPhone")}
                value={student.parent_phone}
                dir="ltr"
              />
              <InfoRow icon={MapPin} label={t("common.address")} value={student.address} />
              <InfoRow
                icon={Mail}
                label={t("students.enrollmentDate")}
                value={formatDate(student.enrollment_date)}
              />
              {(enrollments ?? []).length === 0 ? (
                <InfoRow
                  icon={Users}
                  label={t("students.detail.classes")}
                  value={t("students.detail.noClasses")}
                />
              ) : (
                (enrollments ?? []).map((e) => (
                  <div key={e.class_id} className="space-y-3">
                    <InfoRow
                      icon={Users}
                      label={t("classes.name")}
                      value={
                        e.class
                          ? `${e.class.name}${e.class.code ? ` (${e.class.code})` : ""}${e.class.schedule_time ? ` · ${e.class.schedule_time}` : ""}`
                          : "—"
                      }
                    />
                    <InfoRow
                      icon={User}
                      label={t("classes.teacher")}
                      value={e.class?.teacher?.full_name ?? "—"}
                    />
                  </div>
                ))
              )}
              {student.notes && (
                <div className="pt-3 border-t">
                  <div className="text-xs text-[color:var(--color-muted-foreground)] mb-1">
                    {t("common.notes")}
                  </div>
                  <div className="whitespace-pre-wrap">{student.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("students.detail.attendance")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {(() => {
                const total = attendanceStats.total;
                const attended = attendanceStats.present + attendanceStats.late;
                const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
                const ratePct = pct(attended);
                return (
                  <>
                    <div className="flex items-baseline justify-between">
                      <div className="text-xs text-[color:var(--color-muted-foreground)]">
                        {t("students.detail.attendanceRate")}
                      </div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {total === 0 ? "—" : `${ratePct}%`}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="h-2 rounded-full bg-[color:var(--color-accent)] overflow-hidden">
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${ratePct}%` }}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <StatTile
                        label={t("attendance.present")}
                        value={attendanceStats.present}
                        pct={pct(attendanceStats.present)}
                        showPct={total > 0}
                        color="text-emerald-600"
                      />
                      <StatTile
                        label={t("attendance.absent")}
                        value={attendanceStats.absent}
                        pct={pct(attendanceStats.absent)}
                        showPct={total > 0}
                        color="text-[color:var(--color-destructive)]"
                      />
                      <StatTile
                        label={t("attendance.late")}
                        value={attendanceStats.late}
                        pct={pct(attendanceStats.late)}
                        showPct={total > 0}
                        color="text-amber-600"
                      />
                      <StatTile
                        label={t("students.detail.totalSessions")}
                        value={total}
                      />
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("students.detail.payments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                <span className="text-xs text-[color:var(--color-muted-foreground)]">
                  {t("reports.from")}
                </span>
                <div className="w-40">
                  <DatePicker value={fromDate} onChange={setFromDate} />
                </div>
                <span className="text-xs text-[color:var(--color-muted-foreground)]">
                  {t("reports.to")}
                </span>
                <div className="w-40">
                  <DatePicker value={toDate} onChange={setToDate} />
                </div>
                {(fromDate || toDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    ×
                  </Button>
                )}
                <div className="ms-auto flex items-center gap-4 px-2">
                  <span>
                    <span className="text-xs text-[color:var(--color-muted-foreground)] me-1">
                      {t("students.detail.totalPaid")}:
                    </span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(filteredTotals.paid)}
                    </span>
                  </span>
                  <span>
                    <span className="text-xs text-[color:var(--color-muted-foreground)] me-1">
                      {t("reports.countPayments")}:
                    </span>
                    <span className="font-bold">{filteredTotals.count}</span>
                  </span>
                  {filteredTotals.cancelled > 0 && (
                    <span>
                      <span className="text-xs text-[color:var(--color-muted-foreground)] me-1">
                        {t("payments.cancelled")}:
                      </span>
                      <span className="font-bold text-[color:var(--color-destructive)]">
                        {filteredTotals.cancelled}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {filteredPayments.length === 0 ? (
                <Empty message={t("payments.empty")} />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>{t("payments.receiptCode")}</TH>
                      <TH>{t("payments.amount")}</TH>
                      <TH>{t("payments.paymentDate")}</TH>
                      <TH>{t("common.status")}</TH>
                      <TH className="text-end">{t("common.actions")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filteredPayments.map((p) => (
                      <TR key={p.id} className={p.cancelled_at ? "opacity-60" : undefined}>
                        <TD className="font-mono text-xs">{p.receipt_code}</TD>
                        <TD className="font-bold">{formatCurrency(Number(p.amount))}</TD>
                        <TD>{formatDate(p.payment_date)}</TD>
                        <TD>
                          {p.cancelled_at ? (
                            <Badge variant="destructive">{t("payments.cancelled")}</Badge>
                          ) : (
                            <Badge variant="success">✓</Badge>
                          )}
                        </TD>
                        <TD>
                          <div className="flex justify-end">
                            <Link to={`/receipts/${p.id}`} target="_blank">
                              <Button variant="ghost" size="icon">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
  pct,
  showPct,
}: {
  label: string;
  value: number;
  color?: string;
  pct?: number;
  showPct?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-[color:var(--color-muted-foreground)]">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-lg font-bold ${color ?? ""}`}>{value}</span>
        {showPct && pct !== undefined && (
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-[color:var(--color-muted-foreground)] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[color:var(--color-muted-foreground)]">{label}</div>
        <div dir={dir} className="break-words whitespace-normal">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}
