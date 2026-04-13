import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

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

export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

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

  const handleExportPdf = async () => {
    if (!data || !receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const node = receiptRef.current;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      // A5 portrait: 148 x 210 mm; leave 10mm margin
      const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const ratio = node.offsetHeight / node.offsetWidth;
      const imgH = Math.min(imgW * ratio, pageH - margin * 2);
      pdf.addImage(dataUrl, "PNG", margin, margin, imgW, imgH);
      pdf.save(`receipt-${data.receipt_code}.pdf`);
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

      <div
        ref={receiptRef}
        className="print-area bg-white border rounded-lg p-8 shadow-sm print:border-0 print:shadow-none"
      >
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
