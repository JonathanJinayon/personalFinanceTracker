import { mockAccounts, mockTransactions } from "./mock-data";
import type { Account, Transaction } from "../types/finance";

export type ReportPeriod = "this-month" | "last-month" | "last-3-months" | "this-year" | "custom";

export type ReportFilters = {
  period: ReportPeriod;
  accountId: string;
  fromDate: string;
  toDate: string;
};

export type ReportMonth = {
  key: string;
  month: string;
  income: string;
  expenses: string;
  net: string;
};

export type CategoryReport = {
  category: string;
  amount: string;
  percent: number;
};

export type AccountReport = {
  accountId: string;
  accountName: string;
  income: string;
  expenses: string;
  net: string;
};

export type ReportsData = {
  income: string;
  expenses: string;
  net: string;
  savingsRate: number;
  categories: CategoryReport[];
  months: ReportMonth[];
  accounts: AccountReport[];
  transactionCount: number;
};

const cents = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
};

const money = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
};

export function getReportDateRange(period: ReportPeriod, reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  if (period === "custom") return { fromDate: "", toDate: "" };
  if (period === "this-year") return { fromDate: `${year}-01-01`, toDate: dateString(reference) };
  if (period === "last-3-months") {
    return { fromDate: dateString(new Date(year, month - 2, 1)), toDate: dateString(reference) };
  }
  if (period === "last-month") {
    return { fromDate: dateString(new Date(year, month - 1, 1)), toDate: dateString(new Date(year, month, 0)) };
  }
  return { fromDate: dateString(new Date(year, month, 1)), toDate: dateString(reference) };
}

export function deriveReports(
  transactions: Transaction[] = mockTransactions,
  accounts: Account[] = mockAccounts,
  filters: ReportFilters,
): ReportsData {
  const filtered = transactions.filter((transaction) => {
    if (transaction.cancelled) return false;
    if (transaction.type === "transfer") return false;
    if (filters.fromDate && transaction.date < filters.fromDate) return false;
    if (filters.toDate && transaction.date > filters.toDate) return false;
    if (filters.accountId !== "all" && transaction.accountId !== filters.accountId) return false;
    return transaction.type === "income" || transaction.type === "expense";
  });

  let income = 0n;
  let expenses = 0n;
  const byCategory = new Map<string, bigint>();
  const byMonth = new Map<string, { income: bigint; expenses: bigint }>();
  const byAccount = new Map<string, { income: bigint; expenses: bigint }>();

  for (const transaction of filtered) {
    const value = cents(transaction.amount);
    const month = transaction.date.slice(0, 7);
    const monthly = byMonth.get(month) ?? { income: 0n, expenses: 0n };
    const account = byAccount.get(transaction.accountId) ?? { income: 0n, expenses: 0n };

    if (transaction.type === "income") {
      income += value;
      monthly.income += value;
      account.income += value;
    } else {
      expenses += value;
      monthly.expenses += value;
      account.expenses += value;
      const category = transaction.category || "Uncategorized";
      byCategory.set(category, (byCategory.get(category) ?? 0n) + value);
    }

    byMonth.set(month, monthly);
    byAccount.set(transaction.accountId, account);
  }

  const monthKeys = new Set(byMonth.keys());
  if (filters.fromDate && filters.toDate && filters.fromDate <= filters.toDate) {
    const cursor = new Date(`${filters.fromDate}T00:00:00`);
    const end = new Date(`${filters.toDate}T00:00:00`);
    cursor.setDate(1);
    end.setDate(1);
    if (cursor.getTime() === end.getTime()) cursor.setMonth(cursor.getMonth() - 1);
    while (cursor <= end) {
      monthKeys.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const months: ReportMonth[] = [...monthKeys].sort().map((key) => {
    const values = byMonth.get(key) ?? { income: 0n, expenses: 0n };
    return {
      key,
      month: monthLabel(key),
      income: money(values.income),
      expenses: money(values.expenses),
      net: money(values.income - values.expenses),
    };
  }).filter((item) => !filters.fromDate || !filters.toDate || item.key >= filters.fromDate.slice(0, 7));

  const categories = [...byCategory.entries()].sort(([, a], [, b]) => a > b ? -1 : a < b ? 1 : 0).map(([category, amount]) => ({
    category,
    amount: money(amount),
    percent: expenses === 0n ? 0 : Number((amount * 10000n) / expenses) / 100,
  }));

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const accountReports = [...byAccount.entries()].map(([accountId, values]) => ({
    accountId,
    accountName: accountNames.get(accountId) ?? filtered.find((transaction) => transaction.accountId === accountId)?.accountName ?? "Unknown account",
    income: money(values.income),
    expenses: money(values.expenses),
    net: money(values.income - values.expenses),
  })).sort((a, b) => a.accountName.localeCompare(b.accountName));

  return {
    income: money(income),
    expenses: money(expenses),
    net: money(income - expenses),
    savingsRate: income === 0n ? 0 : Number(((income - expenses) * 10000n) / income) / 100,
    categories,
    months,
    accounts: accountReports,
    transactionCount: filtered.length,
  };
}

export const reportAccounts = mockAccounts;

export const reportDatePresets = {
  thisMonth: getReportDateRange("this-month", new Date(2026, 9, 30)),
  lastMonth: getReportDateRange("last-month", new Date(2026, 9, 30)),
  lastThreeMonths: getReportDateRange("last-3-months", new Date(2026, 9, 30)),
  thisYear: getReportDateRange("this-year", new Date(2026, 9, 30)),
  custom: { fromDate: "2026-10-24", toDate: "2026-10-30" },
};
