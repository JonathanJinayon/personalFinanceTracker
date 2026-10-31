import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PagePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[calc(100svh-11rem)] items-center justify-center py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card text-primary shadow-xs">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
        <Badge variant="secondary" className="mb-3">
          Foundation ready
        </Badge>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          This page will be implemented in the next step.
        </p>
      </div>
    </div>
  );
}
