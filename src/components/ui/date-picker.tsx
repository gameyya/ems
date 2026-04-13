import { format, parse } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const display = selected ? format(selected, "d MMMM yyyy", { locale: ar }) : "";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-10 rounded-md border bg-[color:var(--color-card)] px-3 flex items-center justify-between gap-2 text-sm transition-colors",
          "hover:bg-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={cn(!display && "text-[color:var(--color-muted-foreground)]")}>
          {display || placeholder}
        </span>
        <Calendar className="h-4 w-4 text-[color:var(--color-muted-foreground)]" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 rounded-lg border bg-[color:var(--color-card)] shadow-lg p-2">
          <DayPicker
            mode="single"
            locale={ar}
            dir="rtl"
            weekStartsOn={6}
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 5, 0)}
            endMonth={new Date(new Date().getFullYear() + 5, 11)}
            showOutsideDays
            classNames={{
              today: "rdp-today-styled",
              selected: "rdp-selected-styled",
            }}
          />
        </div>
      )}
    </div>
  );
}
