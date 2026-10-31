import type { Metadata } from "next";
import { ReportsPage as ReportsPageView } from "@/features/reports/reports-page";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportsPageView />;
}
