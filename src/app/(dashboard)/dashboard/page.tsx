import type { Metadata } from "next";
import { AccountOverview } from "@/features/dashboard/account-overview";
import { ExpenseSummary } from "@/features/dashboard/expense-summary";
import { OverviewCards } from "@/features/dashboard/overview-cards";
import { QuickActions } from "@/features/dashboard/quick-actions";
import { RecentTransactions } from "@/features/dashboard/recent-transactions";
import {
  mockAccounts,
  mockCategorySpend,
  mockCurrentPeriod,
  mockMonthlySummary,
  mockSpendingTrend,
  mockTotalBalance,
  mockTransactions,
} from "@/lib/mock-data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const activeAccountCount = mockAccounts.filter(
    (account) => !account.isArchived,
  ).length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <OverviewCards
        totalBalance={mockTotalBalance}
        monthlyIncome={mockMonthlySummary.income}
        monthlyExpenses={mockMonthlySummary.expenses}
        monthlySavings={mockMonthlySummary.net}
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
            totalExpenses={mockMonthlySummary.expenses}
            spendingTrend={mockSpendingTrend}
            categorySpend={mockCategorySpend}
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
