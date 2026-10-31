import type { Metadata } from "next";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountOverview } from "@/features/dashboard/account-overview";
import { ExpenseSummary } from "@/features/dashboard/expense-summary";
import { OverviewCards } from "@/features/dashboard/overview-cards";
import { QuickActions } from "@/features/dashboard/quick-actions";
import { RecentTransactions } from "@/features/dashboard/recent-transactions";
import {
  mockAccounts,
  mockCurrentPeriod,
  mockTotalBalance,
  mockTransactions,
} from "@/lib/mock-data";
import { deriveReports, reportDatePresets } from "@/lib/reports-data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const activeAccountCount = mockAccounts.filter(
    (account) => !account.isArchived,
  ).length;
  const monthlyReports = deriveReports(undefined, undefined, {
    period: "this-month",
    accountId: "all",
    ...reportDatePresets.thisMonth,
  });
  const spendingTrend = deriveReports(undefined, undefined, {
    period: "custom",
    accountId: "all",
    fromDate: "2026-05-01",
    toDate: reportDatePresets.thisMonth.toDate,
  }).months;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Your money at a glance</p>
          <p className="mt-1 text-xs text-muted-foreground">{mockCurrentPeriod} · Preview data</p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/transactions"><Plus data-icon="inline-start" />Record transaction<ArrowRight data-icon="inline-end" /></Link>
        </Button>
      </div>
      <OverviewCards
        totalBalance={mockTotalBalance}
        monthlyIncome={monthlyReports.income}
        monthlyExpenses={monthlyReports.expenses}
        monthlySavings={monthlyReports.net}
        accountCount={activeAccountCount}
        period={mockCurrentPeriod}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <AccountOverview
            accounts={mockAccounts}
            totalBalance={mockTotalBalance}
          />
        </div>
        <div className="lg:col-span-8">
          <ExpenseSummary
            period={mockCurrentPeriod}
            totalExpenses={monthlyReports.expenses}
            spendingTrend={spendingTrend.map((month) => ({ month: month.month, expenses: month.expenses }))}
            categorySpend={monthlyReports.categories.map(({ category, amount }) => ({ category, amount }))}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="md:col-span-2 lg:col-span-8">
          <RecentTransactions transactions={mockTransactions.slice(0, 6)} />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
