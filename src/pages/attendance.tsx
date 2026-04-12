import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/context/auth";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { AttendanceStatus } from "@/types/db";

export function AttendancePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useAuth();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const { data: classes } = useSupabaseQuery(async () => {
    const res = await supabase
      .from("classes")
      .select("id, name, code")
      .is("deleted_at", null)
      .order("name");
    return { data: res.data ?? [], error: res.error };
  });

  const { data: enrolled } = useSupabaseQuery(async () => {
    if (!classId) return { data: [], error: null };
    const res = await supabase
      .from("enrollments")
      .select("student:students(id, full_name, code)")
      .eq("class_id", classId);
    return {
      data: (
        (res.data ?? []) as unknown as Array<{
          student: { id: string; full_name: string; code: string };
        }>
      )
        .map((e) => e.student)
        .filter(Boolean),
      error: res.error,
    };
  }, [classId]);

  const { data: existing } = useSupabaseQuery(async () => {
    if (!classId) return { data: [], error: null };
    const res = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("class_id", classId)
      .eq("date", date);
    return { data: res.data ?? [], error: res.error };
  }, [classId, date]);

  useEffect(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const r of existing ?? []) initial[r.student_id] = r.status;
    setMarks(initial);
  }, [existing]);

  const bulkMark = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of enrolled ?? []) next[s.id] = status;
    setMarks(next);
  };

  const save = async () => {
    if (!classId) return;
    const rows = Object.entries(marks).map(([student_id, status]) => ({
      student_id,
      class_id: classId,
      date,
      status,
      recorded_by: session?.user.id ?? null,
    }));
    if (rows.length === 0) return toast.error(t("common.noResults"));
    // Delete old rows for that class+date then insert (simpler than upsert composite)
    await supabase.from("attendance").delete().eq("class_id", classId).eq("date", date);
    const { error } = await supabase.from("attendance").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(t("attendance.saved"));
  };

  return (
    <div>
      <PageHeader title={t("attendance.title")} />

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>{t("attendance.forClass")}</Label>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— {t("classes.title")} —</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("attendance.selectDate")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={() => bulkMark("present")} disabled={!classId}>
            {t("attendance.markAllPresent")}
          </Button>
          <Button variant="outline" onClick={() => bulkMark("absent")} disabled={!classId}>
            {t("attendance.markAllAbsent")}
          </Button>
        </div>
      </div>

      {!classId ? (
        <Empty message={t("attendance.empty")} />
      ) : enrolled && enrolled.length > 0 ? (
        <div className="space-y-2">
          {enrolled.map((s) => {
            const status = marks[s.id];
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border bg-[color:var(--color-card)] px-4 py-3"
              >
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-[color:var(--color-muted-foreground)] font-mono">
                    {s.code}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={status === "present" ? "default" : "outline"}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: "present" }))}
                  >
                    {t("attendance.present")}
                  </Button>
                  <Button
                    size="sm"
                    variant={status === "absent" ? "destructive" : "outline"}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: "absent" }))}
                  >
                    {t("attendance.absent")}
                  </Button>
                  {status && (
                    <Badge variant={status === "present" ? "success" : "destructive"}>
                      {t(`attendance.${status}`)}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
          <div className="pt-4">
            <Button onClick={save}>
              <Save className="h-4 w-4" />
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <Empty message={t("classes.empty")} />
      )}
    </div>
  );
}
