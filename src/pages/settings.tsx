import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  institution_name: z.string().min(1),
  institution_name_ar: z.string().min(1),
  logo_url: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  currency_code: z.string().min(2),
  receipt_page_size: z.enum(["a4", "a5", "a6", "letter"]),
});
type FormData = z.infer<typeof schema>;

export function SettingsPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const { data: settings, refetch } = useSupabaseQuery(async () => {
    const res = await supabase.from("settings").select("*").eq("id", 1).single();
    return { data: res.data, error: res.error };
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings) {
      form.reset({
        institution_name: settings.institution_name,
        institution_name_ar: settings.institution_name_ar,
        logo_url: settings.logo_url ?? "",
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        currency_code: settings.currency_code,
        receipt_page_size: settings.receipt_page_size ?? "a5",
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase
      .from("settings")
      .update({
        institution_name: data.institution_name,
        institution_name_ar: data.institution_name_ar,
        logo_url: data.logo_url || null,
        address: data.address || null,
        phone: data.phone || null,
        currency_code: data.currency_code,
        receipt_page_size: data.receipt_page_size,
      })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success(t("settings.saved"));
    await refetch();
  };

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.institution")} />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("settings.institution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>{t("settings.institutionNameAr")}</Label>
              <Input {...form.register("institution_name_ar")} />
            </div>
            <div>
              <Label>{t("settings.institutionName")}</Label>
              <Input dir="ltr" className="text-start" {...form.register("institution_name")} />
            </div>
            <div>
              <Label>{t("settings.logoUrl")}</Label>
              <Input dir="ltr" className="text-start" {...form.register("logo_url")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("settings.address")}</Label>
                <Input {...form.register("address")} />
              </div>
              <div>
                <Label>{t("settings.phone")}</Label>
                <Input dir="ltr" className="text-start" {...form.register("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("settings.currencyCode")}</Label>
                <Input
                  dir="ltr"
                  className="text-start max-w-[100px]"
                  {...form.register("currency_code")}
                />
              </div>
              <div>
                <Label>{t("settings.receiptPageSize")}</Label>
                <Select {...form.register("receipt_page_size")}>
                  <option value="a4">A4</option>
                  <option value="a5">A5</option>
                  <option value="a6">A6</option>
                  <option value="letter">Letter</option>
                </Select>
              </div>
            </div>
            <div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="h-4 w-4" />
                {t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
