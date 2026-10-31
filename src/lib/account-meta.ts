import {
  Banknote,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AccountType } from "@/types/finance";

export const accountTypeLabels: Record<AccountType, string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Cash",
};

export const accountTypeIcons: Record<AccountType, LucideIcon> = {
  bank: Banknote,
  ewallet: Smartphone,
  cash: Wallet,
};
