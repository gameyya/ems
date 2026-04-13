import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { utils as xlsxUtils, writeFile as xlsxWrite } from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

type Tab = "students" | "classes" | "payments" | "balances";

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("payments");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: students } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("students")
      .select("code, full_name, phone, parent_name, parent_phone, enrollment_date")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  });

  const { data: classes } = useSupabaseQuery(async () => {
    const res = await supabase.from("v_class_enrollment_counts").select("name, capacity, enrolled");
    return { data: res.data ?? [], error: res.error };
  });

  const { data: payments } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("payments")
      .select(
        "receipt_code, amount, method, payment_date, cancelled_at, student:students(full_name, code)",
      )
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false });
    return {
      data: (res.data ?? []) as unknown as Array<{
        receipt_code: string;
        amount: number;
        method: string;
        payment_date: string;
        cancelled_at: string | null;
        student: { full_name: string; code: string } | null;
      }>,
      error: res.error,
    };
  }, [from, to]);

  const { data: balances } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("v_student_balance")
      .select("*")
      .order("total_paid", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  });

  const paymentsTotal = useMemo(
    () => (payments ?? []).filter((p) => !p.cancelled_at).reduce((s, p) => s + Number(p.amount), 0),
    [payments],
  );

  const exportExcel = () => {
    let sheet: Record<string, string | number>[] = [];
    let filename = "report";
    let sheetName = "Sheet1";
    if (tab === "students") {
      sheet = (students ?? []).map((s) => ({
        الكود: s.code,
        الاسم: s.full_name,
        الهاتف: s.phone ?? "",
        "اسم ولي الأمر": s.parent_name ?? "",
        "هاتف ولي الأمر": s.parent_phone ?? "",
        "تاريخ التسجيل": s.enrollment_date,
      }));
      filename = "students";
      sheetName = "students";
    } else if (tab === "classes") {
      sheet = (classes ?? []).map((c) => ({
        "اسم الفصل": c.name,
        السعة: c.capacity ?? "",
        المسجلون: c.enrolled,
      }));
      filename = "classes";
      sheetName = "classes";
    } else if (tab === "payments") {
      sheet = (payments ?? []).map((p) => ({
        "رقم الإيصال": p.receipt_code,
        الطالب: p.student?.full_name ?? "",
        المبلغ: Number(p.amount),
        "طريقة الدفع": p.method,
        التاريخ: p.payment_date,
        الحالة: p.cancelled_at ? "ملغاة" : "فعّالة",
      }));
      filename = `payments-${from}-to-${to}`;
      sheetName = "payments";
    } else if (tab === "balances") {
      sheet = (balances ?? []).map((b) => ({
        الطالب: b.full_name,
        "الإجمالي المدفوع": Number(b.total_paid),
        "عدد المدفوعات": b.payment_count,
      }));
      filename = "balances";
      sheetName = "balances";
    }
    const ws = xlsxUtils.json_to_sheet(sheet);
    const wb = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(wb, ws, sheetName);
    xlsxWrite(wb, `${filename}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        actions={
          <Button onClick={exportExcel}>
            <Download className="h-4 w-4" />
            {t("common.exportExcel")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["payments", t("reports.paymentsReport")],
            ["students", t("reports.studentList")],
            ["classes", t("reports.classList")],
            ["balances", t("reports.outstandingBalances")],
          ] as [Tab, string][]
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === v
                ? "bg-[color:var(--color-primary)] text-white"
                : "border hover:bg-[color:var(--color-accent)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "payments" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <Label>{t("reports.from")}</Label>
              <DatePicker value={from} onChange={setFrom} />
            </div>
            <div>
              <Label>{t("reports.to")}</Label>
              <DatePicker value={to} onChange={setTo} />
            </div>
            <div>
              <Label>{t("reports.totalPayments")}</Label>
              <div className="h-10 rounded-md border bg-emerald-50 flex items-center px-3 font-bold text-emerald-800">
                {formatCurrency(paymentsTotal)}
              </div>
            </div>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>{t("payments.receiptCode")}</TH>
                <TH>{t("payments.student")}</TH>
                <TH>{t("payments.amount")}</TH>
                <TH>{t("payments.paymentDate")}</TH>
                <TH>{t("common.status")}</TH>
              </TR>
            </THead>
            <TBody>
              {(payments ?? []).map((p) => (
                <TR key={p.receipt_code}>
                  <TD className="font-mono text-xs">{p.receipt_code}</TD>
                  <TD>{p.student?.full_name ?? "—"}</TD>
                  <TD className="font-bold">{formatCurrency(Number(p.amount))}</TD>
                  <TD>{formatDate(p.payment_date)}</TD>
                  <TD>
                    {p.cancelled_at ? (
                      <Badge variant="destructive">{t("payments.cancelled")}</Badge>
                    ) : (
                      <Badge variant="success">✓</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {tab === "students" && (
        <Table>
          <THead>
            <TR>
              <TH>{t("students.code")}</TH>
              <TH>{t("common.name")}</TH>
              <TH>{t("common.phone")}</TH>
              <TH>{t("students.parentName")}</TH>
              <TH>{t("students.enrollmentDate")}</TH>
            </TR>
          </THead>
          <TBody>
            {(students ?? []).map((s) => (
              <TR key={s.code}>
                <TD className="font-mono text-xs">{s.code}</TD>
                <TD className="font-medium">{s.full_name}</TD>
                <TD dir="ltr" className="text-start">
                  {s.phone ?? "—"}
                </TD>
                <TD>{s.parent_name ?? "—"}</TD>
                <TD>{formatDate(s.enrollment_date)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {tab === "classes" && (
        <Table>
          <THead>
            <TR>
              <TH>{t("classes.name")}</TH>
              <TH>{t("classes.capacity")}</TH>
              <TH>{t("classes.enrolled")}</TH>
            </TR>
          </THead>
          <TBody>
            {(classes ?? []).map((c) => (
              <TR key={c.name}>
                <TD className="font-medium">{c.name}</TD>
                <TD>{c.capacity ?? "—"}</TD>
                <TD>
                  <Badge variant="secondary">{c.enrolled}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {tab === "balances" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.outstandingBalances")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>{t("common.name")}</TH>
                  <TH>إجمالي المدفوع</TH>
                  <TH>عدد المدفوعات</TH>
                </TR>
              </THead>
              <TBody>
                {(balances ?? []).map((b) => (
                  <TR key={b.student_id}>
                    <TD className="font-medium">{b.full_name}</TD>
                    <TD className="font-bold text-emerald-600">
                      {formatCurrency(Number(b.total_paid))}
                    </TD>
                    <TD>{b.payment_count}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
