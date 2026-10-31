"use client";

import { useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { switchTheme, type Theme } from "@/lib/theme-transition";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const currentTheme = useRef<string | undefined>(undefined);

  function handleToggle() {
    const theme = currentTheme.current ?? (resolvedTheme as Theme | undefined);
    const nextTheme = theme === "dark" ? "light" : "dark";
    currentTheme.current = nextTheme;

    switchTheme(nextTheme, setTheme);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="gap-2 px-2"
          aria-label="Toggle light and dark theme"
        >
          <span
            data-theme-icon
            aria-hidden
            className="relative size-4 shrink-0"
          >
            <Sun className="absolute inset-0 size-4 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none dark:rotate-90 dark:scale-0 dark:opacity-0" />
            <Moon className="absolute inset-0 size-4 -rotate-90 scale-0 opacity-0 transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none dark:rotate-0 dark:scale-100 dark:opacity-100" />
          </span>
          <span className="hidden text-xs font-medium sm:inline dark:hidden">
            Light
          </span>
          <span className="hidden text-xs font-medium dark:sm:inline">
            Dark
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle theme</TooltipContent>
    </Tooltip>
  );
}
