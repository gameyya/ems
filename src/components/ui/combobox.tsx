import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "اختر",
  searchPlaceholder = "ابحث...",
  emptyText = "لا نتائج",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

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
        <span
          className={cn(
            "truncate text-start flex-1",
            !selected && "text-[color:var(--color-muted-foreground)]",
          )}
        >
          {selected
            ? selected.hint
              ? `${selected.hint} — ${selected.label}`
              : selected.label
            : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-[color:var(--color-muted-foreground)] shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border bg-[color:var(--color-card)] shadow-lg">
          <div className="relative border-b">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-[color:var(--color-muted-foreground)] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-10 ps-9 pe-3 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
                {emptyText}
              </div>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors text-start",
                      isSelected
                        ? "bg-[color:var(--color-primary)] text-white"
                        : "hover:bg-[color:var(--color-accent)]",
                    )}
                  >
                    <span className="flex-1 truncate">
                      {o.hint && (
                        <span
                          className={cn(
                            "font-mono text-xs me-2",
                            !isSelected && "text-[color:var(--color-muted-foreground)]",
                          )}
                        >
                          {o.hint}
                        </span>
                      )}
                      {o.label}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
