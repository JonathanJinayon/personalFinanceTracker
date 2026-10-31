import Link from "next/link";
import Image from "next/image";

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      aria-label="TIGOM — Save with purpose"
      className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image src="/tigom-mark.svg" alt="" width={38} height={38} priority className="size-[38px] shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[17px] font-semibold tracking-[0.12em] text-foreground">TIGOM</span>
        <span className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">Save with purpose</span>
      </span>
    </Link>
  );
}
