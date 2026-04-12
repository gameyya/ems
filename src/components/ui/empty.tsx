import { Inbox } from "lucide-react";

export function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <Inbox className="mx-auto h-12 w-12 text-[color:var(--color-muted-foreground)]" />
      <p className="mt-4 text-sm text-[color:var(--color-muted-foreground)]">{message}</p>
    </div>
  );
}
