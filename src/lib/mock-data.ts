import type {
  Account,
  Category,
  CategorySpend,
  MonthlySpend,
  MonthlySummary,
  SavingsGoal,
  Transaction,
} from "@/types/finance";

export const mockAccounts: Account[] = [
  {
    id: "acc-bpi",
    name: "BPI Savings",
    type: "bank",
    accountNumber: "•••• 4821",
    balance: "30000.00",
    description: "Main savings account for bills and daily spending.",
    isArchived: false,
  },
  {
    id: "acc-gcash",
    name: "GCash",
    type: "ewallet",
    accountNumber: "•••• 0917",
    balance: "10000.00",
    description: "Everyday e-wallet for transfers and online payments.",
    isArchived: false,
  },
  {
    id: "acc-maya",
    name: "Maya",
    type: "ewallet",
    accountNumber: "•••• 2210",
    balance: "8500.00",
    description: "Digital wallet for subscriptions and utilities.",
    isArchived: false,
  },
  {
    id: "acc-cash",
    name: "Cash",
    type: "cash",
    balance: "5000.00",
    description: "Physical cash on hand.",
    isArchived: false,
  },
  {
    id: "acc-metrobank",
    name: "Metrobank Payroll",
    type: "bank",
    accountNumber: "•••• 7754",
    balance: "0.00",
    description: "Previous payroll account, kept for transaction history.",
    isArchived: true,
  },
];

export const mockTotalBalance = "53500.00";

export const mockCategories: Category[] = [
  { id: "cat-food", name: "Food" },
  { id: "cat-transport", name: "Transport" },
  { id: "cat-bills", name: "Bills" },
  { id: "cat-shopping", name: "Shopping" },
  { id: "cat-health", name: "Health" },
  { id: "cat-entertainment", name: "Entertainment" },
  { id: "cat-other", name: "Other" },
];

export const mockTransactions: Transaction[] = [
  {
    id: "txn-001",
    type: "expense",
    date: "2026-10-30",
    description: "Lunch at Jollibee",
    amount: "250.00",
    accountId: "acc-bpi",
    accountName: "BPI Savings",
    category: "Food",
  },
  {
    id: "txn-007",
    type: "expense",
    date: "2026-10-29",
    description: "Coffee and snacks",
    amount: "320.00",
    accountId: "acc-maya",
    accountName: "Maya",
    category: "Food",
  },
  {
    id: "txn-002",
    type: "income",
    date: "2026-10-28",
    description: "Monthly salary",
    amount: "45000.00",
    accountId: "acc-bpi",
    accountName: "BPI Savings",
  },
  {
    id: "txn-003",
    type: "transfer",
    date: "2026-10-27",
    description: "Transfer to GCash",
    amount: "2000.00",
    accountId: "acc-bpi",
    accountName: "BPI Savings",
    destinationAccountName: "GCash",
  },
  {
    id: "txn-004",
    type: "expense",
    date: "2026-10-26",
    description: "Mobile load",
    amount: "300.00",
    accountId: "acc-gcash",
    accountName: "GCash",
    category: "Bills",
  },
  {
    id: "txn-005",
    type: "expense",
    date: "2026-10-25",
    description: "Groceries",
    amount: "1850.00",
    accountId: "acc-cash",
    accountName: "Cash",
    category: "Food",
  },
  {
    id: "txn-006",
    type: "expense",
    date: "2026-10-24",
    description: "Grab ride",
    amount: "180.00",
    accountId: "acc-gcash",
    accountName: "GCash",
    category: "Transport",
  },
];

export const mockCurrentPeriod = "October 2026";

export const mockMonthlySummary: MonthlySummary = {
  income: "45000.00",
  expenses: "5000.00",
  net: "40000.00",
};

export const mockCategorySpend: CategorySpend[] = [
  { category: "Food", amount: "2100.00" },
  { category: "Bills", amount: "1200.00" },
  { category: "Transport", amount: "800.00" },
  { category: "Shopping", amount: "600.00" },
  { category: "Other", amount: "300.00" },
];

export const mockSpendingTrend: MonthlySpend[] = [
  { month: "May", expenses: "4200.00" },
  { month: "Jun", expenses: "5100.00" },
  { month: "Jul", expenses: "4650.00" },
  { month: "Aug", expenses: "5800.00" },
  { month: "Sep", expenses: "4950.00" },
  { month: "Oct", expenses: "5000.00" },
];

export const mockSavingsGoals: SavingsGoal[] = [
  {
    id: "goal-001",
    name: "Emergency fund",
    targetAmount: "50000.00",
    savedAmount: "18500.00",
    targetDate: "2027-06-30",
  },
  {
    id: "goal-002",
    name: "Japan trip",
    targetAmount: "80000.00",
    savedAmount: "24000.00",
    targetDate: "2028-03-01",
  },
  {
    id: "goal-003",
    name: "New laptop",
    targetAmount: "60000.00",
    savedAmount: "15000.00",
  },
];
