import type { Metadata } from "next";
import { SavingsManager } from "@/features/savings/savings-manager";
import { mockSavingsGoals } from "@/lib/savings-mock-data";

export const metadata: Metadata = { title: "Savings" };

export default function SavingsPage() {
  return <SavingsManager initialGoals={mockSavingsGoals} />;
}
