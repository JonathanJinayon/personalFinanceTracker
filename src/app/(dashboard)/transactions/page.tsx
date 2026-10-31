import type { Metadata } from "next";
import { TransactionsPage as TransactionsPageView } from "@/features/transactions/transactions-page";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return <TransactionsPageView />;
}
