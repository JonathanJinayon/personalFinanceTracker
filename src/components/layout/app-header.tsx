"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings, UserRound } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AddTransactionDialog } from "@/components/shared/add-transaction-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { getNavItem } from "@/lib/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const current = getNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-sm sm:gap-3 sm:px-6 lg:px-8">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {current.title}
        </h1>
      </div>

      <AddTransactionDialog />

      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-2 px-1.5 sm:pr-2"
            aria-label="Open profile menu"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-accent text-[11px] font-semibold text-accent-foreground">
                ME
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              Personal
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Personal account</p>
                <p className="text-xs text-muted-foreground">Preview data</p>
              </div>
              <Badge variant="secondary">Demo</Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserRound data-icon="inline-start" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings data-icon="inline-start" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
