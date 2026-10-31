"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPeso, formatPercent } from "@/lib/money";
import type { CategorySpend, MonthlySpend } from "@/types/finance";

export function ExpenseSummary({
  period,
  totalExpenses,
  spendingTrend,
  categorySpend,
}: {
  period: string;
  totalExpenses: string;
  spendingTrend: MonthlySpend[];
  categorySpend: CategorySpend[];
}) {
  const chartData = spendingTrend.map((entry) => ({
    month: entry.month,
    expenses: Number(entry.expenses),
  }));
  const total = Number(totalExpenses);

  return (
    <Card className="h-full [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle>Expense summary</CardTitle>
        <CardDescription>Monthly spending and category mix</CardDescription>
        <CardAction>
          <Badge variant="secondary">{period}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Recent months
            </p>
            <p className="text-xs text-muted-foreground">
              Selected month{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatPeso(totalExpenses)}
              </span>
            </p>
          </div>
          <div className="h-[168px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  dy={8}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-medium">{label}</p>
                        <p className="mt-0.5 text-muted-foreground tabular-nums">
                          {formatPeso(String(payload[0].value))}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="expenses" radius={[5, 5, 0, 0]} maxBarSize={34}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.month}
                      fill="var(--chart-1)"
                      fillOpacity={
                        index === chartData.length - 1 ? 1 : 0.38
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Separator />

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              By category
            </p>
            <p className="text-xs text-muted-foreground">
              {categorySpend.length} categories
            </p>
          </div>
          <ul className="space-y-3">
            {categorySpend.map((item, index) => {
              const percent =
                total > 0 ? (Number(item.amount) / total) * 100 : 0;
              const color = `var(--chart-${index + 1})`;
              return (
                <li key={item.category}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{item.category}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span>{formatPeso(item.amount)}</span>
                      <span className="w-9 text-right text-muted-foreground">
                        {formatPercent(percent / 100)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
