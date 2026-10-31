import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      title="Your financial overview"
      description="Total balance, account breakdown, recent activity, and this month's spending will live here."
    />
  );
}
