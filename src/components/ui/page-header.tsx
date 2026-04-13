import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[color:var(--color-muted-foreground)] mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </div>
  );
}
