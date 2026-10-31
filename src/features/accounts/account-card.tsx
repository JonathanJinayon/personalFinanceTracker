import { Archive, Pencil } from "lucide-react";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  accountTypeIcons,
  accountTypeLabels,
} from "@/lib/account-meta";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/finance";

export function AccountCard({
  account,
  onEdit,
  onArchive,
}: {
  account: Account;
  onEdit: (account: Account) => void;
  onArchive: (account: Account) => void;
}) {
  const Icon = accountTypeIcons[account.type];

  return (
    <Card
      className={cn(
        "h-full transition-shadow hover:shadow-sm [--card-spacing:--spacing(5)]",
        account.isArchived && "bg-muted/25",
      )}
    >
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
            <Icon className="size-[18px]" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{account.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {accountTypeLabels[account.type]}
              {account.accountNumber ? ` · ${account.accountNumber}` : ""}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              account.isArchived
                ? "text-muted-foreground"
                : "border-success/20 bg-success/10 text-success",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                account.isArchived ? "bg-muted-foreground" : "bg-success",
              )}
            />
            {account.isArchived ? "Archived" : "Active"}
          </Badge>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current balance
          </p>
          <Money
            amount={account.balance}
            className="mt-0.5 block text-2xl font-semibold tracking-tight"
          />
          <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
            {account.description ?? "No description"}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(account)}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          {account.isArchived ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-foreground"
              disabled
            >
              <Archive data-icon="inline-start" />
              Archived
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onArchive(account)}
            >
              <Archive data-icon="inline-start" />
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
