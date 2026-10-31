import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Brand />
      </div>
      <div className="px-3">
        <Separator className="mb-3" />
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Menu
        </p>
        <NavLinks />
      </div>
      <div className="mt-auto p-3">
        <div className="rounded-lg border border-sidebar-border bg-card p-3.5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-success/40" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <p className="text-xs font-medium">Preview mode</p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Sample data only. Transactions are not saved yet.
          </p>
        </div>
        <p className="mt-3 px-1 text-[11px] text-muted-foreground">
          A little saved today. A better tomorrow.
        </p>
      </div>
    </aside>
  );
}
