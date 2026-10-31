import Link from "next/link";
import { Wallet } from "lucide-react";

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Wallet className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">
          Ledger
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Personal finance
        </span>
      </span>
    </Link>
  );
}
