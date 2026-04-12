import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border bg-[color:var(--color-card)] px-3 py-2 text-sm",
      "placeholder:text-[color:var(--color-muted-foreground)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
