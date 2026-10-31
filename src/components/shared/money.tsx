import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";

export function Money({
  amount,
  className,
}: {
  amount: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatPeso(amount)}</span>
  );
}
