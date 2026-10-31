import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Savings" };

export default function SavingsPage() {
  return (
    <PagePlaceholder
      icon={PiggyBank}
      title="Savings goals"
      description="Set targets, add contributions, and see how close you are to each goal."
    />
  );
}
