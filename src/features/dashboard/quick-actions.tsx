import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { AddTransactionDialog } from "@/components/shared/add-transaction-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/finance";

interface QuickAction {
  tab: TransactionType;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

const actions: QuickAction[] = [
  {
    tab: "income",
    label: "Add income",
    description: "Record money received",
    icon: ArrowDownLeft,
    iconClassName: "bg-success/10 text-success",
  },
  {
    tab: "expense",
    label: "Add expense",
    description: "Log a daily purchase",
    icon: ArrowUpRight,
    iconClassName: "bg-destructive/10 text-destructive",
  },
  {
    tab: "transfer",
    label: "Transfer money",
    description: "Move funds between accounts",
    icon: ArrowLeftRight,
    iconClassName: "bg-muted text-muted-foreground",
  },
];

export function QuickActions() {
  return (
    <Card className="h-full [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Record a money movement</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <AddTransactionDialog
                key={action.tab}
                defaultTab={action.tab}
                trigger={
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        action.iconClassName,
                      )}
                    >
                      <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-col items-start leading-tight">
                      <span className="text-sm font-medium">
                        {action.label}
                      </span>
                      <span className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </Button>
                }
              />
            );
          })}
        </div>
        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Preview only. Transactions are not saved until the backend is
          connected.
        </p>
      </CardContent>
    </Card>
  );
}
