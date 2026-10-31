import { Archive, CircleCheck, Wallet, type LucideIcon } from "lucide-react";
import { Money } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryItem {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  iconClassName: string;
}

export function AccountsSummary({
  totalBalance,
  activeCount,
  archivedCount,
}: {
  totalBalance: string;
  activeCount: number;
  archivedCount: number;
}) {
  const items: SummaryItem[] = [
    {
      label: "Total balance",
      value: totalBalance,
      note: "Across active accounts",
      icon: Wallet,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      label: "Active accounts",
      value: String(activeCount),
      note: "Included in totals",
      icon: CircleCheck,
      iconClassName: "bg-success/10 text-success",
    },
    {
      label: "Archived accounts",
      value: String(archivedCount),
      note: "Excluded from totals",
      icon: Archive,
      iconClassName: "bg-muted text-muted-foreground",
    },
  ];

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="grid gap-4 sm:grid-cols-3 sm:gap-0">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-3",
                index > 0 &&
                  "border-t pt-4 sm:border-t-0 sm:border-l sm:py-0 sm:pl-6",
                index === 0 && "sm:pr-6",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md",
                  item.iconClassName,
                )}
              >
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                {item.label === "Total balance" ? (
                  <Money
                    amount={item.value}
                    className="mt-0.5 block text-2xl font-semibold tracking-tight"
                  />
                ) : (
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                    {item.value}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.note}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
