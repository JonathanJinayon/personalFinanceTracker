import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate } from "@/lib/date";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types/finance";

const transactionIcons: Record<TransactionType, LucideIcon> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

const transactionIconClasses: Record<TransactionType, string> = {
  income: "bg-success/10 text-success",
  expense: "bg-destructive/10 text-destructive",
  transfer: "bg-muted text-muted-foreground",
};

function formatTransactionAmount(transaction: Transaction): string {
  if (transaction.type === "income") {
    return `+${formatPeso(transaction.amount)}`;
  }

  if (transaction.type === "expense") {
    return `-${formatPeso(transaction.amount)}`;
  }

  return formatPeso(transaction.amount);
}

export function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <Card className="h-full [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Latest activity across your accounts</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/transactions">
              View all
              <ChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {transactions.map((transaction) => {
            const Icon = transactionIcons[transaction.type];
            const label =
              transaction.type === "expense" && transaction.category
                ? transaction.category
                : transactionTypeLabels[transaction.type];
            const destination = transaction.destinationAccountName
              ? ` → ${transaction.destinationAccountName}`
              : "";

            return (
              <li
                key={transaction.id}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors first:pt-0 hover:bg-muted/40 last:pb-0"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    transactionIconClasses[transaction.type],
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {transaction.description}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {label} · {transaction.accountName}
                    {destination}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      transaction.type === "income" && "text-success",
                      transaction.type === "transfer" &&
                        "text-muted-foreground",
                    )}
                  >
                    {formatTransactionAmount(transaction)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatShortDate(transaction.date)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
