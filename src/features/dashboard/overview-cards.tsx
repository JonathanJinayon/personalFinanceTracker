import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { cn } from "@/lib/utils";

interface OverviewCardsProps {
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  monthlySavings: string;
  accountCount: number;
  period: string;
}

interface OverviewCard {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  iconClassName: string;
}

export function OverviewCards({
  totalBalance,
  monthlyIncome,
  monthlyExpenses,
  monthlySavings,
  accountCount,
  period,
}: OverviewCardsProps) {
  const cards: OverviewCard[] = [
    {
      label: "Total balance",
      value: totalBalance,
      note: `${accountCount} active accounts`,
      icon: Wallet,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      label: "Total income",
      value: monthlyIncome,
      note: period,
      icon: ArrowDownLeft,
      iconClassName: "bg-success/10 text-success",
    },
    {
      label: "Total expenses",
      value: monthlyExpenses,
      note: period,
      icon: ArrowUpRight,
      iconClassName: "bg-destructive/10 text-destructive",
    },
    {
      label: "Monthly savings",
      value: monthlySavings,
      note: "Income less expenses",
      icon: PiggyBank,
      iconClassName: "bg-chart-3/10 text-chart-3",
    },
  ];

  return (
    <section
      aria-label="Financial overview"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label} className="[--card-spacing:--spacing(5)]">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </p>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    card.iconClassName,
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
              </div>
              <div>
                <Money
                  amount={card.value}
                  className="text-2xl font-semibold tracking-tight"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.note}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
