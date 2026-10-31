import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <PagePlaceholder
      icon={ChartColumn}
      title="Reports"
      description="Monthly expenses, category breakdowns, income versus expenses, and spending trends."
    />
  );
}
