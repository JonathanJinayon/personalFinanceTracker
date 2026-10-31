import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <PagePlaceholder
      icon={ArrowLeftRight}
      title="Transaction history"
      description="Search, filter, and inspect every income, expense, and transfer in one place."
    />
  );
}
