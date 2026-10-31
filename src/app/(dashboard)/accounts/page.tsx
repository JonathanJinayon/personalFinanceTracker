import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <PagePlaceholder
      icon={Wallet}
      title="Accounts"
      description="Create and manage your bank, e-wallet, and cash accounts, with balances derived from recorded transactions."
    />
  );
}
