import { Document, Font, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

Font.register({
  family: "Tajawal",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Tajawal", fontSize: 12 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 30 },
  title: { fontSize: 22, fontWeight: 700, textAlign: "right" },
  subtitle: { color: "#666", fontSize: 10, textAlign: "right" },
  receiptCode: { fontSize: 14, fontWeight: 700, direction: "ltr" },
  section: { marginBottom: 16 },
  row: { flexDirection: "row-reverse", borderBottom: "1pt solid #eee", paddingVertical: 6 },
  label: { width: "40%", color: "#666", textAlign: "right" },
  value: { width: "60%", fontWeight: 700, textAlign: "right" },
  amountBox: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: "#f0f9ff",
    border: "1pt solid #0ea5e9",
    borderRadius: 6,
  },
  amountLabel: { fontSize: 10, color: "#0369a1", textAlign: "right" },
  amountValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0c4a6e",
    textAlign: "right",
    marginTop: 4,
  },
  footer: {
    marginTop: 40,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  signBox: { width: "40%", alignItems: "center", paddingTop: 40, borderTop: "1pt solid #333" },
  signLabel: { fontSize: 10, color: "#666" },
});

interface ReceiptData {
  receipt_code: string;
  amount: number;
  method: string;
  payment_date: string;
  notes: string | null;
  cancelled_at: string | null;
  student: { full_name: string; code: string } | null;
  settings: { institution_name_ar: string; address: string | null; phone: string | null };
}

function ReceiptPDF({ data, t }: { data: ReceiptData; t: (k: string) => string }) {
  return (
    <Document>
      <Page size="A5" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{data.settings.institution_name_ar}</Text>
            {data.settings.address && <Text style={styles.subtitle}>{data.settings.address}</Text>}
            {data.settings.phone && <Text style={styles.subtitle}>{data.settings.phone}</Text>}
          </View>
          <View>
            <Text style={styles.subtitle}>{t("receipts.receiptNo")}</Text>
            <Text style={styles.receiptCode}>{data.receipt_code}</Text>
            <Text style={styles.subtitle}>{formatDate(data.payment_date)}</Text>
          </View>
        </View>

        <Text style={{ ...styles.title, fontSize: 16, marginBottom: 16 }}>
          {t("receipts.title")}
        </Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>{t("receipts.receivedFrom")}</Text>
            <Text style={styles.value}>{data.student?.full_name ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("payments.method")}</Text>
            <Text style={styles.value}>
              {t(data.method === "cash" ? "payments.methodCash" : "payments.methodOther")}
            </Text>
          </View>
          {data.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>{t("receipts.notes")}</Text>
              <Text style={styles.value}>{data.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>{t("receipts.amount")}</Text>
          <Text style={styles.amountValue}>{formatCurrency(Number(data.amount))}</Text>
        </View>

        {data.cancelled_at && (
          <Text style={{ color: "red", textAlign: "center", fontSize: 20, marginVertical: 10 }}>
            *** {t("payments.cancelled")} ***
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>{t("receipts.institutionStamp")}</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>{t("receipts.receivedBy")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { t } = useTranslation();

  const { data, loading } = useSupabaseQuery(async () => {
    if (!paymentId) return { data: null, error: { message: "no id" } };
    const [paymentRes, settingsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("*, student:students(full_name, code)")
        .eq("id", paymentId)
        .single(),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);
    if (paymentRes.error) return { data: null, error: paymentRes.error };
    return {
      data: {
        ...(paymentRes.data as Record<string, unknown>),
        settings: settingsRes.data ?? {
          institution_name_ar: "",
          address: null,
          phone: null,
        },
      } as unknown as ReceiptData,
      error: null,
    };
  }, [paymentId]);

  useEffect(() => {
    document.title = data ? `${t("receipts.title")} ${data.receipt_code}` : t("receipts.title");
  }, [data, t]);

  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const blob = await pdf(<ReceiptPDF data={data} t={t} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${data.receipt_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-8">{t("common.loading")}</div>;
  if (!data) return <div className="p-8">{t("common.noResults")}</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 flex justify-between">
        <h1 className="text-xl font-bold">
          {t("receipts.title")} — {data.receipt_code}
        </h1>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="h-4 w-4" />
            {t("common.print")}
          </Button>
          <Button onClick={handleExportPdf} disabled={exporting}>
            <Download className="h-4 w-4" />
            {t("common.exportPdf")}
          </Button>
        </div>
      </div>

      {/* On-screen printable receipt */}
      <div className="print-area bg-white border rounded-lg p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between mb-6 border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold">{data.settings.institution_name_ar}</h2>
            {data.settings.address && (
              <p className="text-sm text-slate-500">{data.settings.address}</p>
            )}
            {data.settings.phone && (
              <p className="text-sm text-slate-500" dir="ltr">
                {data.settings.phone}
              </p>
            )}
          </div>
          <div className="text-end">
            <div className="text-xs text-slate-500">{t("receipts.receiptNo")}</div>
            <div className="font-mono font-bold text-lg">{data.receipt_code}</div>
            <div className="text-sm text-slate-600 mt-1">{formatDate(data.payment_date)}</div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-center mb-6">{t("receipts.title")}</h3>

        <div className="space-y-3 mb-6">
          <div className="flex border-b pb-2">
            <span className="w-40 text-slate-500">{t("receipts.receivedFrom")}</span>
            <span className="font-semibold">{data.student?.full_name ?? "—"}</span>
          </div>
          <div className="flex border-b pb-2">
            <span className="w-40 text-slate-500">{t("payments.method")}</span>
            <span className="font-semibold">
              {t(data.method === "cash" ? "payments.methodCash" : "payments.methodOther")}
            </span>
          </div>
          {data.notes && (
            <div className="flex border-b pb-2">
              <span className="w-40 text-slate-500">{t("receipts.notes")}</span>
              <span>{data.notes}</span>
            </div>
          )}
        </div>

        <div className="bg-sky-50 border border-sky-500 rounded-lg p-6 my-8 text-end">
          <div className="text-xs text-sky-700">{t("receipts.amount")}</div>
          <div className="text-4xl font-bold text-sky-900 mt-1">
            {formatCurrency(Number(data.amount))}
          </div>
        </div>

        {data.cancelled_at && (
          <div className="text-center text-red-600 text-2xl font-bold border-4 border-red-600 py-3 my-4">
            *** {t("payments.cancelled")} ***
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 mt-16">
          <div className="border-t pt-2 text-center text-xs text-slate-500">
            {t("receipts.institutionStamp")}
          </div>
          <div className="border-t pt-2 text-center text-xs text-slate-500">
            {t("receipts.receivedBy")}
          </div>
        </div>
      </div>
    </div>
  );
}
