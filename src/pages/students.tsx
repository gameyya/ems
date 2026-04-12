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
import { formatDate } from "@/lib/utils";
import type { Student } from "@/types/db";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  parent_name: z.string().optional().or(z.literal("")),
  parent_phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

export function StudentsPage() {
  const { t } = useTranslation();
  const can = useCan();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  const { data: students, refetch } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("students")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  });

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [students, search]);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const openAdd = () => {
    form.reset({
      full_name: "",
      phone: "",
      parent_name: "",
      parent_phone: "",
      address: "",
      notes: "",
    });
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (s: Student) => {
    form.reset({
      full_name: s.full_name,
      phone: s.phone ?? "",
      parent_name: s.parent_name ?? "",
      parent_phone: s.parent_phone ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setEditing(s);
    setOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      full_name: data.full_name,
      phone: data.phone || null,
      parent_name: data.parent_name || null,
      parent_phone: data.parent_phone || null,
      address: data.address || null,
      notes: data.notes || null,
    };
    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setOpen(false);
    await refetch();
  };

  const onDelete = async (s: Student) => {
    if (!confirm(t("common.confirmDelete"))) return;
    // Soft delete to preserve financial history
    const { error } = await supabase
      .from("students")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(t("students.deletedSoft"));
    await refetch();
  };

  return (
    <div>
      <PageHeader
        title={t("students.title")}
        description={t("students.count", { count: filtered.length })}
        actions={
          can.canManageStudents && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t("students.add")}
            </Button>
          )
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-[color:var(--color-muted-foreground)] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("students.searchPlaceholder")}
          className="ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty message={search ? t("common.noResults") : t("students.empty")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("students.code")}</TH>
              <TH>{t("students.fullName")}</TH>
              <TH>{t("common.phone")}</TH>
              <TH>{t("students.parentName")}</TH>
              <TH>{t("students.enrollmentDate")}</TH>
              <TH className="text-end">{t("common.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((s) => (
              <TR key={s.id}>
                <TD className="font-mono text-xs">{s.code}</TD>
                <TD className="font-medium">{s.full_name}</TD>
                <TD dir="ltr" className="text-start">
                  {s.phone ?? "—"}
                </TD>
                <TD>{s.parent_name ?? "—"}</TD>
                <TD>{formatDate(s.enrollment_date)}</TD>
                <TD>
                  <div className="flex gap-1 justify-end">
                    {can.canManageStudents && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can.isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(s)}>
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
          <DialogTitle>{editing ? t("students.edit") : t("students.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t("students.fullName")}</Label>
            <Input {...form.register("full_name")} autoFocus />
            {form.formState.errors.full_name && (
              <p className="text-xs text-[color:var(--color-destructive)] mt-1">
                {t("common.required")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.phone")}</Label>
              <Input dir="ltr" className="text-start" {...form.register("phone")} />
            </div>
            <div>
              <Label>{t("students.parentPhone")}</Label>
              <Input dir="ltr" className="text-start" {...form.register("parent_phone")} />
            </div>
          </div>
          <div>
            <Label>{t("students.parentName")}</Label>
            <Input {...form.register("parent_name")} />
          </div>
          <div>
            <Label>{t("common.address")}</Label>
            <Input {...form.register("address")} />
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
