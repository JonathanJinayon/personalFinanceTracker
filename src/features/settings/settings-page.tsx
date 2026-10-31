"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check, Database, Download, FileUp, Moon, RotateCcw, Settings2, Sun, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchTheme } from "@/lib/theme-transition";

type Preferences = {
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  weekStartsOn: "sunday" | "monday";
  numberFormat: "comma-decimal" | "space-comma" | "period-comma";
};

const defaultPreferences: Preferences = {
  dateFormat: "MM/DD/YYYY",
  weekStartsOn: "sunday",
  numberFormat: "comma-decimal",
};
const preferenceStorageKey = "personal-finance-preferences";

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const stored = window.localStorage.getItem(preferenceStorageKey);
    if (!stored) return defaultPreferences;
    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return {
      dateFormat: parsed.dateFormat === "DD/MM/YYYY" || parsed.dateFormat === "YYYY-MM-DD" ? parsed.dateFormat : "MM/DD/YYYY",
      weekStartsOn: parsed.weekStartsOn === "monday" ? "monday" : "sunday",
      numberFormat: parsed.numberFormat === "space-comma" || parsed.numberFormat === "period-comma" ? parsed.numberFormat : "comma-decimal",
    };
  } catch {
    return defaultPreferences;
  }
}

export function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isReady] = useState(true);

  function updatePreference<Key extends keyof Preferences>(key: Key, value: Preferences[Key]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      window.localStorage.setItem(preferenceStorageKey, JSON.stringify(next));
      toast.success("Preference updated", { description: "Saved in this browser only." });
    } catch {
      toast.error("Could not save preference", { description: "Browser storage may be unavailable." });
    }
  }

  function handleTheme(theme: "light" | "dark") {
    if (theme === resolvedTheme) return;
    switchTheme(theme, setTheme);
    toast.success(`Switched to ${theme} mode`);
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
    try {
      window.localStorage.removeItem(preferenceStorageKey);
      window.localStorage.removeItem("theme");
    } catch {
      toast.error("Could not reset browser preferences");
      setIsResetOpen(false);
      return;
    }
    switchTheme("light", setTheme);
    setIsResetOpen(false);
    toast.success("Settings reset to defaults", { description: "Preferences are stored locally in this browser." });
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Customize how the tracker looks and displays information. Preferences are saved in this browser only.</p>
      </div>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardHeader>
          <div className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /><CardTitle>General preferences</CardTitle></div>
          <CardDescription>Choose how dates and numbers appear throughout the app.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="grid gap-2">
            <label htmlFor="currency" className="text-sm font-medium">Currency</label>
            <Select value="PHP" disabled><SelectTrigger id="currency" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PHP">PHP — Philippine Peso (₱)</SelectItem></SelectContent></Select>
            <p className="text-xs text-muted-foreground">PHP is currently the only supported currency.</p>
          </div>
          <div className="grid gap-2">
            <label htmlFor="date-format" className="text-sm font-medium">Date format</label>
            <Select value={preferences.dateFormat} onValueChange={(value) => updatePreference("dateFormat", value as Preferences["dateFormat"])} disabled={!isReady}>
              <SelectTrigger id="date-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem><SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="week-start" className="text-sm font-medium">First day of the week</label>
            <Select value={preferences.weekStartsOn} onValueChange={(value) => updatePreference("weekStartsOn", value as Preferences["weekStartsOn"])} disabled={!isReady}>
              <SelectTrigger id="week-start" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sunday">Sunday</SelectItem><SelectItem value="monday">Monday</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2 xl:col-span-1">
            <label htmlFor="number-format" className="text-sm font-medium">Number formatting</label>
            <Select value={preferences.numberFormat} onValueChange={(value) => updatePreference("numberFormat", value as Preferences["numberFormat"])} disabled={!isReady}>
              <SelectTrigger id="number-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="comma-decimal">1,234.56 (comma, decimal point)</SelectItem><SelectItem value="space-comma">1 234,56 (space, decimal comma)</SelectItem><SelectItem value="period-comma">1.234,56 (period, decimal comma)</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This preference is saved locally; financial displays currently use the standard PHP format.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardHeader>
          <div className="flex items-center gap-2"><Sun className="size-4 text-primary" /><CardTitle>Appearance</CardTitle></div>
          <CardDescription>Choose a theme. It uses the app’s existing theme control and transition.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ThemeOption title="Light mode" description="A bright, low-contrast workspace." icon={Sun} selected={resolvedTheme === "light"} disabled={!isReady} onClick={() => handleTheme("light")} />
          <ThemeOption title="Dark mode" description="A darker workspace for low-light use." icon={Moon} selected={resolvedTheme === "dark"} disabled={!isReady} onClick={() => handleTheme("dark")} />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardHeader>
          <div className="flex items-center gap-2"><Database className="size-4 text-primary" /><CardTitle>Data management</CardTitle></div>
          <CardDescription>Export, import, and backup tools are not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <ComingSoon icon={Download} title="Export data" description="Download a copy of your financial records." />
          <ComingSoon icon={FileUp} title="Import data" description="Bring records into your tracker." />
          <ComingSoon icon={RotateCcw} title="Backup & restore" description="Create or restore a backup." />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><p className="text-sm font-medium">Reset preferences</p><p className="mt-1 text-xs text-muted-foreground">Restore the default date, number, week, and light theme settings.</p></div>
        <Button variant="outline" onClick={() => setIsResetOpen(true)} className="w-full sm:w-fit"><Trash2 data-icon="inline-start" />Reset to defaults</Button>
      </div>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset settings to defaults?</DialogTitle><DialogDescription>This resets browser preferences and switches the app to light mode. It does not affect financial data.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setIsResetOpen(false)}>Cancel</Button><Button onClick={resetPreferences}>Reset settings</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeOption({ title, description, icon: Icon, selected, disabled, onClick }: {
  title: string;
  description: string;
  icon: typeof Sun;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={`flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-60 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-medium">{title}{selected ? <Badge variant="secondary" className="h-5">Selected</Badge> : null}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span>
      {selected ? <Check className="mt-1 size-4 shrink-0 text-primary" /> : null}
    </button>
  );
}

function ComingSoon({ icon: Icon, title, description }: { icon: typeof Download; title: string; description: string }) {
  return <div className="flex min-h-24 items-start gap-3 rounded-xl border border-dashed bg-muted/10 p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-medium">{title}<Badge variant="outline">Coming soon</Badge></span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span></div>;
}
