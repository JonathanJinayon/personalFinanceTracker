export type AccountType = "bank" | "ewallet" | "cash";

export type TransactionType = "income" | "expense" | "transfer";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  accountNumber?: string;
  balance: string;
  description?: string;
  isArchived: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  amount: string;
  accountId: string;
  accountName: string;
  destinationAccountName?: string;
  category?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: string;
  savedAmount: string;
  targetDate?: string;
}

export interface MonthlySummary {
  income: string;
  expenses: string;
  net: string;
}

export interface CategorySpend {
  category: string;
  amount: string;
}

export interface MonthlySpend {
  month: string;
  expenses: string;
}
