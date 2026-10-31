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
    <section aria-label="Financial overview" className="grid gap-4 xl:grid-cols-[1.35fr_2fr]">
      <Card className="relative isolate overflow-hidden border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_9%,var(--card)),var(--card)_62%)] [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(7)]">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full border border-primary/10" />
        <span aria-hidden className="pointer-events-none absolute -right-4 -top-8 size-36 rounded-full border border-primary/10" />
        <CardContent className="relative flex min-h-44 flex-col justify-between gap-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total balance</p>
              <p className="mt-1 text-xs text-muted-foreground">Across {accountCount} active accounts</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Wallet className="size-4" /></span>
          </div>
          <div>
            <Money amount={totalBalance} className="block text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl" />
            <p className="mt-2 text-xs text-muted-foreground">Available across your accounts</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="min-h-32 [--card-spacing:--spacing(5)]">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <span className={cn("flex size-8 items-center justify-center rounded-md", card.iconClassName)}>
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                </div>
                <div>
                  <Money amount={card.value} className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl" />
                  <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
