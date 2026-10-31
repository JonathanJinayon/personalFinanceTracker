"use client";

import { useState } from "react";
import { Info, Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountCard } from "@/features/accounts/account-card";
import { AccountsSummary } from "@/features/accounts/accounts-summary";
import { AddAccountDialog } from "@/features/accounts/add-account-dialog";
import { ArchiveAccountDialog } from "@/features/accounts/archive-account-dialog";
import { EditAccountDialog } from "@/features/accounts/edit-account-dialog";
import { isPesoPositive, sumPeso } from "@/lib/money";
import type { Account } from "@/types/finance";

type AccountFilter = "all" | "active" | "archived";

export function AccountsManager({
  initialAccounts,
}: {
  initialAccounts: Account[];
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [editing, setEditing] = useState<Account | null>(null);
  const [archiving, setArchiving] = useState<Account | null>(null);

  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const archivedAccounts = accounts.filter((account) => account.isArchived);
  const totalBalance = sumPeso(
    activeAccounts.map((account) => account.balance),
  );

  const visibleAccounts = accounts.filter((account) => {
    if (filter === "active") {
      return !account.isArchived;
    }
    if (filter === "archived") {
      return account.isArchived;
    }
    return true;
  });

  function handleAdd(account: Account) {
    setAccounts((current) => [account, ...current]);
  }

  function handleSave(updated: Account) {
    setAccounts((current) =>
      current.map((account) =>
        account.id === updated.id ? updated : account,
      ),
    );
  }

  function handleArchive(account: Account) {
    if (isPesoPositive(account.balance)) {
      return;
    }

    setAccounts((current) =>
      current.map((existing) =>
        existing.id === account.id
          ? { ...existing, isArchived: true }
          : existing,
      ),
    );
  }

  const filterCounts: Record<AccountFilter, number> = {
    all: accounts.length,
    active: activeAccounts.length,
    archived: archivedAccounts.length,
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Manage the bank, e-wallet, and cash accounts used to record your
            income and expenses.
          </p>
        </div>
        <AddAccountDialog
          onAdd={handleAdd}
          trigger={
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          }
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Preview data only. Changes are temporary and reset when you reload
          the page.
        </p>
      </div>

      <AccountsSummary
        totalBalance={totalBalance}
        activeCount={activeAccounts.length}
        archivedCount={archivedAccounts.length}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Your accounts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {visibleAccounts.length} of {accounts.length} accounts shown
          </p>
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as AccountFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">
              All
              <span className="text-[11px] text-muted-foreground">
                {filterCounts.all}
              </span>
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              <span className="text-[11px] text-muted-foreground">
                {filterCounts.active}
              </span>
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archived
              <span className="text-[11px] text-muted-foreground">
                {filterCounts.archived}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visibleAccounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={setEditing}
              onArchive={setArchiving}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Wallet}
          title="No accounts in this view"
          description="Try another filter or add a new account to get started."
          action={
            filter !== "all" ? (
              <Button variant="outline" onClick={() => setFilter("all")}>
                View all accounts
              </Button>
            ) : null
          }
        />
      )}

      {editing ? (
        <EditAccountDialog
          key={editing.id}
          account={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {archiving ? (
        <ArchiveAccountDialog
          key={archiving.id}
          account={archiving}
          onConfirm={handleArchive}
          onClose={() => setArchiving(null)}
        />
      ) : null}
    </div>
  );
}
