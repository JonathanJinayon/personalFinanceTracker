import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Your financial overview at a glance",
    icon: LayoutDashboard,
  },
  {
    title: "Accounts",
    href: "/accounts",
    description: "Bank, e-wallet, and cash balances",
    icon: Wallet,
  },
  {
    title: "Transactions",
    href: "/transactions",
    description: "Every income, expense, and transfer",
    icon: ArrowLeftRight,
  },
  {
    title: "Savings",
    href: "/savings",
    description: "Goals and progress",
    icon: PiggyBank,
  },
  {
    title: "Reports",
    href: "/reports",
    description: "Spending patterns and trends",
    icon: ChartColumn,
  },
  {
    title: "Settings",
    href: "/settings",
    description: "Categories and preferences",
    icon: Settings,
  },
];

export function getNavItem(pathname: string): NavItem {
  return (
    navItems.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? navItems[0]
  );
}
