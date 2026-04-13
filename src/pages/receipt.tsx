import { toBlob, toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { Copy, Download, MessageCircle, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReceiptData {
  receipt_code: string;
  amount: number;
  method: string;
  payment_date: string;
  notes: string | null;
  cancelled_at: string | null;
  student: {
    full_name: string;
    code: string;
    phone: string | null;
    parent_phone: string | null;
  } | null;
  settings: {
    institution_name_ar: string;
    address: string | null;
    phone: string | null;
    receipt_page_size?: "a4" | "a5" | "a6" | "letter";
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
  }, []);

  const { data, loading } = useSupabaseQuery(async () => {
    if (!paymentId) return { data: null, error: { message: "no id" } };
    const [paymentRes, settingsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("*, student:students(full_name, code, phone, parent_phone)")
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
      const dataUrl = await toJpeg(node, {
        pixelRatio: 2,
        quality: 0.85,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const format = data.settings.receipt_page_size ?? "a5";
      const pdf = new jsPDF({
        unit: "mm",
        format,
        orientation: "portrait",
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const ratio = node.offsetHeight / node.offsetWidth;
      const imgH = Math.min(imgW * ratio, pageH - margin * 2);
      pdf.addImage(dataUrl, "JPEG", margin, margin, imgW, imgH, undefined, "FAST");
      pdf.save(`receipt-${data.receipt_code}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleShareWhatsApp = (rawPhone: string) => {
    if (!data) return;
    const phone = normalizePhone(rawPhone);
    if (!phone) return toast.error(t("common.error"));
    const text =
      `${t("receipts.title")} ${data.receipt_code}\n` +
      `${data.student?.full_name ?? ""}\n` +
      `${t("payments.amount")}: ${formatCurrency(Number(data.amount))}\n` +
      `${formatDate(data.payment_date)}`;
    window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleCopyImage = async () => {
    if (!data || !receiptRef.current || copying) return;
    setCopying(true);
    try {
      const blob = await toBlob(receiptRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success(t("receipts.imageCopied"));
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `receipt-${data.receipt_code}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("receipts.imageDownloaded"));
      }
    } finally {
      setCopying(false);
    }
  };

  if (loading) return <div className="p-8">{t("common.loading")}</div>;
  if (!data) return <div className="p-8">{t("common.noResults")}</div>;

  const pageSize = data.settings.receipt_page_size ?? "a5";
  const phones: Array<{ raw: string; label: string }> = [];
  if (data.student?.phone) {
    phones.push({ raw: data.student.phone, label: t("receipts.shareStudent") });
  }
  if (data.student?.parent_phone) {
    phones.push({ raw: data.student.parent_phone, label: t("receipts.shareParent") });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <style>{`@page { size: ${pageSize} portrait; margin: 10mm; }`}</style>
      <div className="mb-4 flex justify-between items-start gap-2 flex-wrap">
        <h1 className="text-xl font-bold">
          {t("receipts.title")} — {data.receipt_code}
        </h1>
        <div className="flex gap-2 flex-wrap">
          {isMobile ? (
            <>
              {phones.map((p) => (
                <Button
                  key={p.raw}
                  onClick={() => handleShareWhatsApp(p.raw)}
                  variant="outline"
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {p.label}
                </Button>
              ))}
              <Button
                onClick={handleCopyImage}
                disabled={copying}
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                <Copy className="h-4 w-4" />
                {t("receipts.copyImage")}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleCopyImage}
              disabled={copying}
              variant="outline"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              <Copy className="h-4 w-4" />
              {t("receipts.copyImage")}
            </Button>
          )}
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
        className="print-area receipt-print bg-white border rounded-lg p-8 shadow-sm print:border-0 print:shadow-none"
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
            <div className="font-mono font-bold text-lg whitespace-nowrap">
              {data.receipt_code}
            </div>
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

        <div className="receipt-amount bg-sky-50 border border-sky-500 rounded-lg p-6 my-8 text-end">
          <div className="text-xs text-sky-700">{t("receipts.amount")}</div>
          <div className="amount-value text-4xl font-bold text-sky-900 mt-1">
            {formatCurrency(Number(data.amount))}
          </div>
        </div>

        {data.cancelled_at && (
          <div className="text-center text-red-600 text-2xl font-bold border-4 border-red-600 py-3 my-4">
            *** {t("payments.cancelled")} ***
          </div>
        )}

        <div className="receipt-footer grid grid-cols-2 gap-10 mt-16">
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
