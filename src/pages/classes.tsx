import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import { useCan } from "@/context/auth";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { ClassRow, Teacher } from "@/types/db";

const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;

const schema = z.object({
  name: z.string().min(2),
  teacher_id: z.string().optional().or(z.literal("")),
  schedule_time: z.string().optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

interface ClassWithTeacher extends ClassRow {
  teacher: { full_name: string } | null;
}

export function ClassesPage() {
  const { t } = useTranslation();
  const can = useCan();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassWithTeacher | null>(null);
  const [days, setDays] = useState<string[]>([]);

  const [enrollOpen, setEnrollOpen] = useState<ClassWithTeacher | null>(null);

  const { data: classes, refetch } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("classes")
      .select("*, teacher:teachers(full_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return { data: (res.data ?? []) as unknown as ClassWithTeacher[], error: res.error };
  });

  const { data: enrollmentCounts, refetch: refetchCounts } = useSupabaseQuery(async () => {
    const res = await supabase.from("v_class_enrollment_counts").select("*");
    return { data: res.data ?? [], error: res.error };
  });

  const { data: teachers } = useSupabaseQuery<Teacher[]>(async () => {
    const res = await supabase
      .from("teachers")
      .select("*")
      .is("deleted_at", null)
      .order("full_name");
    return { data: res.data ?? [], error: res.error };
  });

  const countByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of enrollmentCounts ?? []) map.set(c.class_id, c.enrolled);
    return map;
  }, [enrollmentCounts]);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const openAdd = () => {
    form.reset({ name: "", teacher_id: "", schedule_time: "", capacity: "", notes: "" });
    setDays([]);
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: ClassWithTeacher) => {
    form.reset({
      name: c.name,
      teacher_id: c.teacher_id ?? "",
      schedule_time: c.schedule_time ?? "",
      capacity: c.capacity != null ? String(c.capacity) : "",
      notes: c.notes ?? "",
    });
    setDays(c.schedule_days ?? []);
    setEditing(c);
    setOpen(true);
  };

  const toggleDay = (d: string) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      teacher_id: data.teacher_id || null,
      schedule_days: days,
      schedule_time: data.schedule_time || null,
      capacity: data.capacity ? Number(data.capacity) : null,
      notes: data.notes || null,
    };
    const { error } = editing
      ? await supabase.from("classes").update(payload).eq("id", editing.id)
      : await supabase.from("classes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setOpen(false);
    await refetch();
  };

  const onDelete = async (c: ClassWithTeacher) => {
    if (!confirm(t("common.confirmDelete"))) return;
    const { error } = await supabase
      .from("classes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    await refetch();
  };

  return (
    <div>
      <PageHeader
        title={t("classes.title")}
        actions={
          can.canManageClasses && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t("classes.add")}
            </Button>
          )
        }
      />

      {!classes?.length ? (
        <Empty message={t("classes.empty")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("classes.code")}</TH>
              <TH>{t("classes.name")}</TH>
              <TH>{t("classes.teacher")}</TH>
              <TH>{t("classes.schedule")}</TH>
              <TH>{t("classes.enrolled")}</TH>
              <TH className="text-end">{t("common.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {classes.map((c) => {
              const enrolled = countByClass.get(c.id) ?? 0;
              const atCapacity = c.capacity != null && enrolled >= c.capacity;
              return (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.code}</TD>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{c.teacher?.full_name ?? "—"}</TD>
                  <TD className="text-xs">
                    {(c.schedule_days ?? []).map((d) => t(`classes.days.${d}`)).join("، ")}
                    {c.schedule_time && <span dir="ltr"> · {c.schedule_time}</span>}
                  </TD>
                  <TD>
                    <Badge variant={atCapacity ? "warning" : "secondary"}>
                      {enrolled}
                      {c.capacity ? ` / ${c.capacity}` : ""}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-1 justify-end">
                      {can.canManageClasses && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setEnrollOpen(c)}>
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {can.isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => onDelete(c)}>
                          <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? t("classes.edit") : t("classes.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t("classes.name")}</Label>
            <Input {...form.register("name")} autoFocus />
          </div>
          <div>
            <Label>{t("classes.teacher")}</Label>
            <Select {...form.register("teacher_id")}>
              <option value="">— {t("classes.selectTeacher")} —</option>
              {(teachers ?? []).map((t2) => (
                <option key={t2.id} value={t2.id}>
                  {t2.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("classes.scheduleDays")}</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    days.includes(d)
                      ? "bg-[color:var(--color-primary)] text-white border-transparent"
                      : "hover:bg-[color:var(--color-accent)]"
                  }`}
                >
                  {t(`classes.days.${d}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("classes.scheduleTime")}</Label>
              <Input
                dir="ltr"
                className="text-start"
                placeholder="16:00 - 17:30"
                {...form.register("schedule_time")}
              />
            </div>
            <div>
              <Label>{t("classes.capacity")}</Label>
              <Input
                type="number"
                dir="ltr"
                className="text-start"
                {...form.register("capacity")}
              />
            </div>
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

      {enrollOpen && (
        <EnrollDialog
          cls={enrollOpen}
          onClose={async () => {
            setEnrollOpen(null);
            await refetchCounts();
          }}
        />
      )}
    </div>
  );
}

function EnrollDialog({ cls, onClose }: { cls: ClassRow; onClose: () => Promise<void> | void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: students } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("students")
      .select("id, full_name, code")
      .is("deleted_at", null)
      .order("full_name");
    return { data: res.data ?? [], error: res.error };
  });

  const { data: enrolled, refetch: refetchEnrolled } = useSupabaseQuery(async () => {
    const res = await supabase.from("enrollments").select("student_id").eq("class_id", cls.id);
    return { data: res.data ?? [], error: res.error };
  }, [cls.id]);

  const enrolledSet = useMemo(() => new Set((enrolled ?? []).map((e) => e.student_id)), [enrolled]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    const rows = Array.from(selected).map((student_id) => ({ class_id: cls.id, student_id }));
    const { error } = await supabase.from("enrollments").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setSelected(new Set());
    await refetchEnrolled();
  };

  const handleRemove = async (studentId: string) => {
    const { error } = await supabase
      .from("enrollments")
      .delete()
      .eq("class_id", cls.id)
      .eq("student_id", studentId);
    if (error) return toast.error(error.message);
    await refetchEnrolled();
  };

  const available = (students ?? []).filter((s) => !enrolledSet.has(s.id));

  return (
    <Dialog open onOpenChange={() => onClose()} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {t("classes.enrollStudents")} — {cls.name}
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-auto">
        <div>
          <div className="text-sm font-semibold mb-2">
            {t("classes.enrolled")} ({enrolledSet.size})
          </div>
          <div className="space-y-1 text-sm">
            {(students ?? [])
              .filter((s) => enrolledSet.has(s.id))
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-2 py-1.5"
                >
                  <span>{s.full_name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(s.id)}
                    className="h-6 px-2"
                  >
                    ×
                  </Button>
                </div>
              ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">
            {t("common.add")} ({available.length})
          </div>
          <div className="space-y-1 text-sm">
            {available.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-[color:var(--color-accent)]"
              >
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                {s.full_name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onClose()}>
          {t("common.back")}
        </Button>
        <Button onClick={handleAdd} disabled={selected.size === 0}>
          {t("common.add")} ({selected.size})
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
