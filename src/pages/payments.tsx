import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useCan } from "@/context/auth";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payment } from "@/types/db";

const schema = z.object({
  student_id: z.string().uuid(),
  amount: z.string().min(1),
  method: z.enum(["cash", "other"]),
  payment_date: z.string().min(1),
  notes: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

interface PaymentWithStudent extends Payment {
  student: { full_name: string; code: string } | null;
}

export function PaymentsPage() {
  const { t } = useTranslation();
  const can = useCan();
  const toast = useToast();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PaymentWithStudent | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: payments, refetch } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("payments")
      .select("*, student:students(full_name, code)")
      .order("created_at", { ascending: false })
      .limit(200);
    return { data: (res.data ?? []) as unknown as PaymentWithStudent[], error: res.error };
  });

  const { data: students } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("students")
      .select("id, full_name, code")
      .is("deleted_at", null)
      .order("full_name");
    return { data: res.data ?? [], error: res.error };
  });

  const filtered = useMemo(() => {
    if (!payments) return [];
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.receipt_code.toLowerCase().includes(q) ||
        (p.student?.full_name ?? "").toLowerCase().includes(q),
    );
  }, [payments, search]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: "cash",
      payment_date: new Date().toISOString().slice(0, 10),
    },
  });

  const openAdd = () => {
    form.reset({
      student_id: "",
      amount: "",
      method: "cash",
      payment_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const { data: inserted, error } = await supabase
      .from("payments")
      .insert({
        student_id: data.student_id,
        amount: Number(data.amount),
        method: data.method,
        payment_date: data.payment_date,
        notes: data.notes || null,
        created_by: session?.user.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setOpen(false);
    await refetch();
    if (inserted) {
      window.open(`/receipts/${inserted.id}`, "_blank");
    }
  };

  const onCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return toast.error(t("payments.cancelReason"));
    const { error } = await supabase
      .from("payments")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: session?.user.id,
        cancel_reason: cancelReason,
      })
      .eq("id", cancelTarget.id);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setCancelTarget(null);
    setCancelReason("");
    await refetch();
  };

  return (
    <div>
      <PageHeader
        title={t("payments.title")}
        description={t("payments.immutableNotice")}
        actions={
          can.canManagePayments && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t("payments.record")}
            </Button>
          )
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-[color:var(--color-muted-foreground)] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("payments.searchPlaceholder")}
          className="ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty message={t("payments.empty")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("payments.receiptCode")}</TH>
              <TH>{t("payments.student")}</TH>
              <TH>{t("payments.amount")}</TH>
              <TH>{t("payments.method")}</TH>
              <TH>{t("payments.paymentDate")}</TH>
              <TH>{t("common.status")}</TH>
              <TH className="text-end">{t("common.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id} className={p.cancelled_at ? "opacity-60" : undefined}>
                <TD className="font-mono text-xs">{p.receipt_code}</TD>
                <TD className="font-medium">{p.student?.full_name ?? "—"}</TD>
                <TD className="font-bold">{formatCurrency(Number(p.amount))}</TD>
                <TD>{t(`payments.method${p.method === "cash" ? "Cash" : "Other"}`)}</TD>
                <TD>{formatDate(p.payment_date)}</TD>
                <TD>
                  {p.cancelled_at ? (
                    <Badge variant="destructive">{t("payments.cancelled")}</Badge>
                  ) : (
                    <Badge variant="success">✓</Badge>
                  )}
                </TD>
                <TD>
                  <div className="flex gap-1 justify-end">
                    <Link to={`/receipts/${p.id}`} target="_blank">
                      <Button variant="ghost" size="icon">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </Link>
                    {can.canCancelPayments && !p.cancelled_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCancelTarget(p)}
                        title={t("payments.cancel")}
                      >
                        <Ban className="h-4 w-4 text-[color:var(--color-destructive)]" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{t("payments.record")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t("payments.student")}</Label>
            <Select {...form.register("student_id")}>
              <option value="">— {t("payments.selectStudent")} —</option>
              {(students ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("payments.amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                dir="ltr"
                className="text-start"
                autoFocus
                {...form.register("amount")}
              />
            </div>
            <div>
              <Label>{t("payments.method")}</Label>
              <Select {...form.register("method")}>
                <option value="cash">{t("payments.methodCash")}</option>
                <option value="other">{t("payments.methodOther")}</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("payments.paymentDate")}</Label>
            <Input
              type="date"
              dir="ltr"
              className="text-start"
              {...form.register("payment_date")}
            />
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea rows={2} {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {cancelTarget && (
        <Dialog open onOpenChange={() => setCancelTarget(null)}>
          <DialogHeader>
            <DialogTitle>{t("payments.cancel")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("payments.cancelConfirm")}</p>
          <div className="mt-3">
            <Label>{t("payments.cancelReason")}</Label>
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {t("common.back")}
            </Button>
            <Button variant="destructive" onClick={onCancel}>
              {t("payments.cancel")}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
