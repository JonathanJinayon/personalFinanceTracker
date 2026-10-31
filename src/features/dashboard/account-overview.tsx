import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  accountTypeIcons,
  accountTypeLabels,
} from "@/lib/account-meta";
import type { Account } from "@/types/finance";

export function AccountOverview({
  accounts,
  totalBalance,
}: {
  accounts: Account[];
  totalBalance: string;
}) {
  const activeAccounts = accounts.filter((account) => !account.isArchived);

  return (
    <Card className="h-full [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>Balances across your accounts</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts">
              Manage
              <ChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="space-y-0.5">
          {activeAccounts.map((account) => {
            const Icon = accountTypeIcons[account.type];

            return (
              <li
                key={account.id}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                  <Icon className="size-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {account.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {accountTypeLabels[account.type]}
                    {account.accountNumber
                      ? ` · ${account.accountNumber}`
                      : ""}
                  </p>
                </div>
                <Money
                  amount={account.balance}
                  className="shrink-0 text-sm font-medium"
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-auto pt-3">
          <Separator />
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Total across accounts
            </p>
            <Money
              amount={totalBalance}
              className="text-sm font-semibold"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
