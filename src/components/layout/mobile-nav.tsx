"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main application navigation
          </SheetDescription>
          <Brand onNavigate={() => setOpen(false)} />
        </SheetHeader>
        <div className="flex-1 px-3">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-success/40" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <p className="text-xs font-medium">Preview mode</p>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sample data only. Transactions are not saved yet.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
