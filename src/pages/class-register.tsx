import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  parent_name: z.string().optional().or(z.literal("")),
  parent_phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

interface ClassInfo {
  class_id: string;
  class_name: string;
  class_code: string;
  queue_active: boolean;
}

export function ClassRegisterPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState<"pending" | "auto" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_class_registration_info", {
        p_token: token,
      });
      if (error || !data || (data as ClassInfo[]).length === 0) {
        setInvalid(true);
      } else {
        setInfo((data as ClassInfo[])[0]);
      }
      setLoading(false);
    })();
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token || !info) return;
    setSubmitError(null);
    const { error } = await supabase.rpc("submit_class_registration", {
      p_token: token,
      p_full_name: data.full_name,
      p_phone: data.phone || null,
      p_parent_name: data.parent_name || null,
      p_parent_phone: data.parent_phone || null,
      p_address: data.address || null,
      p_notes: data.notes || null,
    });
    if (error) {
      if (error.message.includes("link_invalid")) {
        setInvalid(true);
      } else {
        setSubmitError(error.message);
      }
      return;
    }
    setSubmitted(info.queue_active ? "pending" : "auto");
    form.reset();
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-sm text-[color:var(--color-muted-foreground)]">
        …
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-[color:var(--color-background)] to-[color:var(--color-accent)]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-3">
            <XCircle className="mx-auto h-12 w-12 text-[color:var(--color-destructive)]" />
            <p className="font-medium">{t("publicRegister.linkInvalid")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-[color:var(--color-background)] to-[color:var(--color-accent)]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="font-medium">
              {submitted === "pending"
                ? t("publicRegister.successPending")
                : t("publicRegister.successAuto")}
            </p>
            <Button variant="outline" onClick={() => setSubmitted(null)}>
              {t("publicRegister.submitAnother")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[color:var(--color-background)] to-[color:var(--color-accent)] p-6">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-xl bg-[color:var(--color-primary)] text-white grid place-items-center">
              <GraduationCap className="h-7 w-7" />
            </div>
            <CardTitle>{t("publicRegister.title")}</CardTitle>
            <CardDescription>
              {t("publicRegister.classLabel")}: <strong>{info?.class_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>{t("publicRegister.fullName")} *</Label>
                <Input {...form.register("full_name")} autoFocus />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-[color:var(--color-destructive)] mt-1">
                    {t("common.required")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("publicRegister.phone")}</Label>
                  <Input dir="ltr" className="text-start" {...form.register("phone")} />
                </div>
                <div>
                  <Label>{t("publicRegister.parentPhone")}</Label>
                  <Input dir="ltr" className="text-start" {...form.register("parent_phone")} />
                </div>
              </div>
              <div>
                <Label>{t("publicRegister.parentName")}</Label>
                <Input {...form.register("parent_name")} />
              </div>
              <div>
                <Label>{t("publicRegister.address")}</Label>
                <Input {...form.register("address")} />
              </div>
              <div>
                <Label>{t("publicRegister.notes")}</Label>
                <Textarea rows={2} {...form.register("notes")} />
              </div>
              {submitError && (
                <div className="rounded-md bg-[color:var(--color-destructive)]/10 p-3 text-sm text-[color:var(--color-destructive)]">
                  {submitError}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("publicRegister.submitting")
                  : t("publicRegister.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
