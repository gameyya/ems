import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Copy,
  Link as LinkIcon,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { formatDateTime } from "@/lib/utils";
import type { ClassRegistration, ClassRegistrationLink, ClassRow, Teacher } from "@/types/db";

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
  const [linksOpen, setLinksOpen] = useState<ClassWithTeacher | null>(null);

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

  const { data: pendingCounts, refetch: refetchPending } = useSupabaseQuery(async () => {
    const res = await supabase.from("v_class_pending_registrations").select("*");
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

  const pendingByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pendingCounts ?? []) map.set(p.class_id, p.pending);
    return map;
  }, [pendingCounts]);

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
              const pending = pendingByClass.get(c.id) ?? 0;
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLinksOpen(c)}
                            className="relative"
                            title={t("classes.registrationLinks")}
                          >
                            <LinkIcon className="h-4 w-4" />
                            {pending > 0 && (
                              <span className="absolute -top-1 -end-1 h-4 min-w-4 rounded-full bg-[color:var(--color-destructive)] text-white text-[10px] font-semibold grid place-items-center px-1">
                                {pending}
                              </span>
                            )}
                          </Button>
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
            <Combobox
              value={form.watch("teacher_id") ?? ""}
              onChange={(v) => form.setValue("teacher_id", v)}
              options={(teachers ?? []).map((t2) => ({
                value: t2.id,
                label: t2.full_name,
              }))}
              placeholder={t("classes.selectTeacher")}
            />
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
          <div>
            <Label>{t("classes.scheduleTime")}</Label>
            <TimeRangeInput
              value={form.watch("schedule_time") ?? ""}
              onChange={(v) => form.setValue("schedule_time", v)}
            />
          </div>
          <div>
            <Label>{t("classes.capacity")}</Label>
            <Input type="number" dir="ltr" className="text-start" {...form.register("capacity")} />
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

      {linksOpen && (
        <LinksDialog
          cls={linksOpen}
          onClose={async () => {
            setLinksOpen(null);
            await Promise.all([refetch(), refetchPending(), refetchCounts()]);
          }}
        />
      )}
    </div>
  );
}

function TimeRangeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [startRaw, endRaw] = value.split("-").map((s) => s.trim());
  const setRange = (start: string, end: string) => {
    if (!start && !end) return onChange("");
    onChange(`${start || ""} - ${end || ""}`);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-[color:var(--color-muted-foreground)] mb-1">من</div>
        <input
          type="time"
          dir="ltr"
          value={startRaw ?? ""}
          onChange={(e) => setRange(e.target.value, endRaw ?? "")}
          className="h-10 w-full rounded-md border bg-[color:var(--color-card)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]"
        />
      </div>
      <div>
        <div className="text-xs text-[color:var(--color-muted-foreground)] mb-1">إلى</div>
        <input
          type="time"
          dir="ltr"
          value={endRaw ?? ""}
          onChange={(e) => setRange(startRaw ?? "", e.target.value)}
          className="h-10 w-full rounded-md border bg-[color:var(--color-card)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]"
        />
      </div>
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

  const [searchTerm, setSearchTerm] = useState("");
  const available = (students ?? []).filter((s) => {
    if (enrolledSet.has(s.id)) return false;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return s.full_name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

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
          <div className="relative mb-2">
            <Search className="absolute top-1/2 -translate-y-1/2 start-2 h-3.5 w-3.5 text-[color:var(--color-muted-foreground)] pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("students.searchPlaceholder")}
              className="h-8 ps-7 text-sm"
            />
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

function LinksDialog({ cls, onClose }: { cls: ClassRow; onClose: () => Promise<void> | void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [queueActive, setQueueActive] = useState<boolean>(cls.registration_queue_active);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: links, refetch } = useSupabaseQuery<ClassRegistrationLink[]>(async () => {
    const res = await supabase
      .from("class_registration_links")
      .select("*")
      .eq("class_id", cls.id)
      .order("created_at", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  }, [cls.id]);

  const { data: pendingRegs, refetch: refetchPendingRegs } = useSupabaseQuery<
    ClassRegistration[]
  >(async () => {
    const res = await supabase
      .from("class_registrations")
      .select("*")
      .eq("class_id", cls.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return { data: res.data ?? [], error: res.error };
  }, [cls.id]);

  const pendingCount = pendingRegs?.length ?? 0;

  const createLink = async () => {
    const days = Number(expiryDays);
    const expires_at =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const { error } = await supabase.from("class_registration_links").insert({
      class_id: cls.id,
      expires_at,
    });
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    await refetch();
  };

  const toggleLink = async (link: ClassRegistrationLink) => {
    const { error } = await supabase
      .from("class_registration_links")
      .update({ enabled: !link.enabled })
      .eq("id", link.id);
    if (error) return toast.error(error.message);
    await refetch();
  };

  const deleteLink = async (link: ClassRegistrationLink) => {
    if (!confirm(t("common.confirmDelete"))) return;
    const { error } = await supabase.from("class_registration_links").delete().eq("id", link.id);
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    await refetch();
  };

  const toggleQueue = async (next: boolean) => {
    setQueueActive(next);
    const { error } = await supabase
      .from("classes")
      .update({ registration_queue_active: next })
      .eq("id", cls.id);
    if (error) {
      setQueueActive(!next);
      toast.error(error.message);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/register/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("classes.linkCopied"));
    } catch {
      toast.error("clipboard failed");
    }
  };

  const publicUrl = (token: string) => `${window.location.origin}/register/${token}`;

  return (
    <>
      <Dialog open onOpenChange={() => onClose()} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("classes.registrationLinksFor", { name: cls.name })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[70vh] overflow-auto">
          {/* Queue toggle */}
          <div className="rounded-md border p-3 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{t("classes.queueActive")}</div>
              <div className="text-xs text-[color:var(--color-muted-foreground)] mt-1">
                {t("classes.queueActiveHint")}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={queueActive}
                onChange={(e) => toggleQueue(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>

          {/* Pending review */}
          <div className="rounded-md border p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("classes.pendingRegistrations")}</div>
              <div className="text-xs text-[color:var(--color-muted-foreground)] mt-1">
                {t("classes.pending", { count: pendingCount })}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewOpen(true)}
              disabled={pendingCount === 0}
            >
              {t("classes.reviewPending")}
            </Button>
          </div>

          {/* Create link */}
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">{t("classes.createLink")}</div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">{t("classes.defaultExpiryDays")}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  className="text-start h-9"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  placeholder="7"
                  min={0}
                />
              </div>
              <Button onClick={createLink}>
                <Plus className="h-4 w-4" />
                {t("classes.createLink")}
              </Button>
            </div>
          </div>

          {/* Links list */}
          <div>
            <div className="text-sm font-medium mb-2">{t("classes.registrationLinks")}</div>
            {(links ?? []).length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted-foreground)] rounded-md border border-dashed p-4 text-center">
                {t("classes.noLinks")}
              </div>
            ) : (
              <div className="space-y-2">
                {(links ?? []).map((link) => {
                  const isExpired =
                    link.expires_at != null && new Date(link.expires_at).getTime() <= Date.now();
                  const active = link.enabled && !isExpired;
                  return (
                    <div key={link.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={active ? "success" : "secondary"}>
                          {isExpired
                            ? t("classes.linkExpired")
                            : link.enabled
                              ? t("classes.linkEnabled")
                              : t("classes.linkDisabled")}
                        </Badge>
                        <span className="text-xs text-[color:var(--color-muted-foreground)]">
                          {t("classes.linkExpiry")}:{" "}
                          {link.expires_at
                            ? formatDateTime(link.expires_at)
                            : t("classes.linkExpiryNever")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          dir="ltr"
                          readOnly
                          className="text-start text-xs font-mono h-8"
                          value={publicUrl(link.token)}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyLink(link.token)}
                          title={t("classes.linkUrl")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleLink(link)}
                          title={link.enabled ? t("classes.disableLink") : t("classes.enableLink")}
                        >
                          {link.enabled ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => deleteLink(link)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            {t("common.back")}
          </Button>
        </DialogFooter>
      </Dialog>

      {reviewOpen && (
        <ReviewPendingDialog
          classId={cls.id}
          registrations={pendingRegs ?? []}
          onClose={async () => {
            setReviewOpen(false);
            await refetchPendingRegs();
          }}
        />
      )}
    </>
  );
}

function ReviewPendingDialog({
  classId: _classId,
  registrations,
  onClose,
}: {
  classId: string;
  registrations: ClassRegistration[];
  onClose: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  const [list, setList] = useState(registrations);

  const approve = async (id: string) => {
    if (!confirm(t("classes.approveConfirm"))) return;
    setProcessing(id);
    const { error } = await supabase.rpc("approve_class_registration", { p_reg_id: id });
    setProcessing(null);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setList((l) => l.filter((r) => r.id !== id));
  };

  const reject = async (id: string) => {
    if (!confirm(t("classes.rejectConfirm"))) return;
    setProcessing(id);
    const { error } = await supabase.rpc("reject_class_registration", { p_reg_id: id });
    setProcessing(null);
    if (error) return toast.error(error.message);
    toast.success(t("common.saved"));
    setList((l) => l.filter((r) => r.id !== id));
  };

  return (
    <Dialog open onOpenChange={() => onClose()} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t("classes.reviewPending")}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-auto space-y-2">
        {list.length === 0 ? (
          <div className="text-sm text-[color:var(--color-muted-foreground)] rounded-md border border-dashed p-6 text-center">
            {t("classes.noPending")}
          </div>
        ) : (
          list.map((r) => (
            <div key={r.id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{r.full_name}</div>
                <div className="text-xs text-[color:var(--color-muted-foreground)]">
                  {formatDateTime(r.created_at)}
                </div>
              </div>
              <div className="text-xs text-[color:var(--color-muted-foreground)] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                {r.phone && (
                  <div>
                    <span className="font-medium">{t("common.phone")}:</span>{" "}
                    <span dir="ltr">{r.phone}</span>
                  </div>
                )}
                {r.parent_name && (
                  <div>
                    <span className="font-medium">{t("students.parentName")}:</span> {r.parent_name}
                  </div>
                )}
                {r.parent_phone && (
                  <div>
                    <span className="font-medium">{t("students.parentPhone")}:</span>{" "}
                    <span dir="ltr">{r.parent_phone}</span>
                  </div>
                )}
                {r.address && (
                  <div>
                    <span className="font-medium">{t("common.address")}:</span> {r.address}
                  </div>
                )}
                {r.notes && (
                  <div className="sm:col-span-2">
                    <span className="font-medium">{t("common.notes")}:</span> {r.notes}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reject(r.id)}
                  disabled={processing === r.id}
                >
                  <X className="h-4 w-4" />
                  {t("classes.reject")}
                </Button>
                <Button size="sm" onClick={() => approve(r.id)} disabled={processing === r.id}>
                  <Check className="h-4 w-4" />
                  {t("classes.approve")}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onClose()}>
          {t("common.back")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
