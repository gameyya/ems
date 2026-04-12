import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/context/auth";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { Teacher } from "@/types/db";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  specialty: z.string().optional().or(z.literal("")),
  payment_type: z.string().optional().or(z.literal("")),
  salary: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

export function TeachersPage() {
  const { t } = useTranslation();
  const can = useCan();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [open, setOpen] = useState(false);

  const { data: teachers, refetch } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("teachers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  });

  const filtered = useMemo(() => {
    if (!teachers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (x) => x.full_name.toLowerCase().includes(q) || (x.specialty ?? "").toLowerCase().includes(q),
    );
  }, [teachers, search]);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const openAdd = () => {
    form.reset({
      full_name: "",
      phone: "",
      specialty: "",
      payment_type: "",
      salary: "",
      notes: "",
    });
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (x: Teacher) => {
    form.reset({
      full_name: x.full_name,
      phone: x.phone ?? "",
      specialty: x.specialty ?? "",
      payment_type: x.payment_type ?? "",
      salary: x.salary != null ? String(x.salary) : "",
      notes: x.notes ?? "",
    });
    setEditing(x);
    setOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      full_name: data.full_name,
      phone: data.phone || null,
      specialty: data.specialty || null,
      payment_type: data.payment_type || null,
      salary: data.salary ? Number(data.salary) : null,
      notes: data.notes || null,
    };
    const { error } = editing
      ? await supabase.from("teachers").update(payload).eq("id", editing.id)
      : await supabase.from("teachers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setOpen(false);
    await refetch();
  };

  const onDelete = async (x: Teacher) => {
    if (!confirm(t("common.confirmDelete"))) return;
    const { error } = await supabase
      .from("teachers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", x.id);
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    await refetch();
  };

  return (
    <div>
      <PageHeader
        title={t("teachers.title")}
        actions={
          can.canManageTeachers && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t("teachers.add")}
            </Button>
          )
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-[color:var(--color-muted-foreground)] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("teachers.searchPlaceholder")}
          className="ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty message={search ? t("common.noResults") : t("teachers.empty")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("teachers.fullName")}</TH>
              <TH>{t("teachers.specialty")}</TH>
              <TH>{t("common.phone")}</TH>
              <TH>{t("teachers.paymentType")}</TH>
              <TH>{t("teachers.salary")}</TH>
              <TH className="text-end">{t("common.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((x) => (
              <TR key={x.id}>
                <TD className="font-medium">{x.full_name}</TD>
                <TD>{x.specialty ?? "—"}</TD>
                <TD dir="ltr" className="text-start">
                  {x.phone ?? "—"}
                </TD>
                <TD>{x.payment_type ?? "—"}</TD>
                <TD>{x.salary != null ? formatCurrency(Number(x.salary)) : "—"}</TD>
                <TD>
                  <div className="flex gap-1 justify-end">
                    {can.canManageTeachers && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(x)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can.isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(x)}>
                        <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
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
          <DialogTitle>{editing ? t("teachers.edit") : t("teachers.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t("teachers.fullName")}</Label>
            <Input {...form.register("full_name")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("teachers.specialty")}</Label>
              <Input {...form.register("specialty")} />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input dir="ltr" className="text-start" {...form.register("phone")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("teachers.paymentType")}</Label>
              <Input {...form.register("payment_type")} />
            </div>
            <div>
              <Label>{t("teachers.salary")}</Label>
              <Input
                type="number"
                step="0.01"
                dir="ltr"
                className="text-start"
                {...form.register("salary")}
              />
            </div>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea rows={3} {...form.register("notes")} />
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
    </div>
  );
}
