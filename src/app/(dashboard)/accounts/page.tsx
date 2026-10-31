import type { Metadata } from "next";
import { AccountsManager } from "@/features/accounts/accounts-manager";
import { mockAccounts } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return <AccountsManager initialAccounts={mockAccounts} />;
}
