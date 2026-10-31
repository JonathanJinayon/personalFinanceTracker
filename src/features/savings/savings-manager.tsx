"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  CircleCheck,
  Coins,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatShortDate } from "@/lib/date";
import { formatPeso, normalizePesoInput, sumPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SavingsAllocation, SavingsGoal } from "@/types/finance";

type GoalDraft = {
  name: string;
  targetAmount: string;
  savedAmount: string;
  targetDate: string;
  description: string;
};

type Confirmation = {
  goal: SavingsGoal;
  action: "complete" | "archive";
};

function emptyDraft(goal?: SavingsGoal): GoalDraft {
  return {
    name: goal?.name ?? "",
    targetAmount: goal?.targetAmount ?? "",
    savedAmount: goal?.savedAmount ?? "0.00",
    targetDate: goal?.targetDate ?? "",
    description: goal?.description ?? "",
  };
}

function amountCents(value: string) {
  const normalized = normalizePesoInput(value);
  if (!normalized) return null;
  const [pesos, centavos] = normalized.split(".");
  return BigInt(pesos) * 100n + BigInt(centavos);
}

function centsToAmount(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

function remainingAmount(goal: SavingsGoal) {
  const target = amountCents(goal.targetAmount) ?? 0n;
  const saved = amountCents(goal.savedAmount) ?? 0n;
  return centsToAmount(target > saved ? target - saved : 0n);
}

function progressPercent(goal: SavingsGoal) {
  const target = amountCents(goal.targetAmount) ?? 0n;
  const saved = amountCents(goal.savedAmount) ?? 0n;
  if (target <= 0n) return 0;
  const percent = Number((saved * 10000n) / target) / 100;
  return Math.min(percent, 100);
}

function todayString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function getGoalStatus(goal: SavingsGoal) {
  if (goal.isArchived) return "Archived" as const;
  if (goal.completed || progressPercent(goal) >= 100) return "Completed" as const;
  return "In progress" as const;
}

function SummaryCard({
  label,
  value,
  caption,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof PiggyBank;
  iconClassName: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function GoalCard({
  goal,
  onOpen,
  onEdit,
  onAllocate,
  onComplete,
  onArchive,
}: {
  goal: SavingsGoal;
  onOpen: (goal: SavingsGoal) => void;
  onEdit: (goal: SavingsGoal) => void;
  onAllocate: (goal: SavingsGoal) => void;
  onComplete: (goal: SavingsGoal) => void;
  onArchive: (goal: SavingsGoal) => void;
}) {
  const status = getGoalStatus(goal);
  const percent = progressPercent(goal);
  const statusClass = status === "Completed"
    ? "border-success/20 bg-success/10 text-success"
    : status === "Archived"
      ? "bg-muted text-muted-foreground"
      : "border-primary/20 bg-primary/5 text-primary";

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="grid min-w-0 gap-4">
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <button className="flex min-w-0 items-start gap-3 text-left" onClick={() => onOpen(goal)}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {status === "Completed" ? <CircleCheck className="size-5" /> : <Target className="size-5" />}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block truncate font-semibold">{goal.name}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{goal.description || "Savings goal"}</span>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Manage ${goal.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!goal.isArchived ? <DropdownMenuItem onClick={() => onEdit(goal)}><Pencil />Edit details</DropdownMenuItem> : null}
              {!goal.isArchived && status !== "Completed" ? <DropdownMenuItem onClick={() => onAllocate(goal)}><Coins />Adjust allocation</DropdownMenuItem> : null}
              {!goal.isArchived && status !== "Completed" ? <DropdownMenuItem onClick={() => onComplete(goal)}><Check />Mark completed</DropdownMenuItem> : null}
              {!goal.isArchived ? <DropdownMenuItem onClick={() => onArchive(goal)}><Archive />Archive goal</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass)}>{status}</span>
          {goal.targetDate ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{formatShortDate(goal.targetDate)}</span> : <span className="text-xs text-muted-foreground">No target date</span>}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 sm:gap-3">
          <div className="min-w-0"><p className="text-[11px] text-muted-foreground">Allocated</p><p className="mt-1 break-words font-semibold tabular-nums">{formatPeso(goal.savedAmount)}</p></div>
          <div className="min-w-0 text-right"><p className="text-[11px] text-muted-foreground">Target</p><p className="mt-1 break-words font-semibold tabular-nums">{formatPeso(goal.targetAmount)}</p></div>
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs"><span className="font-medium">{percent.toFixed(percent % 1 === 0 ? 0 : 1)}% complete</span><span className="text-muted-foreground">{formatPeso(remainingAmount(goal))} remaining</span></div>
          <Progress value={percent} aria-label={`${goal.name} progress`} className="h-2" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">Allocated from existing account balances; not additional funds.</p>
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpen(goal)}>View details</Button>
          {!goal.isArchived && status !== "Completed" ? <Button className="flex-1" onClick={() => onAllocate(goal)}><Plus data-icon="inline-start" />Allocate</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function SavingsManager({ initialGoals }: { initialGoals: SavingsGoal[] }) {
  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<"add" | "edit" | "allocate" | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(() => emptyDraft());
  const [allocationInput, setAllocationInput] = useState("");
  const [allocationNote, setAllocationNote] = useState("");

  const activeGoals = goals.filter((goal) => !goal.isArchived);
  const visibleGoals = goals.filter((goal) => showArchived || !goal.isArchived);
  const totalTarget = sumPeso(activeGoals.map((goal) => goal.targetAmount));
  const totalAllocated = sumPeso(activeGoals.map((goal) => goal.savedAmount));
  const totalTargetCents = amountCents(totalTarget) ?? 0n;
  const totalAllocatedCents = amountCents(totalAllocated) ?? 0n;
  const overallProgress = totalTargetCents === 0n ? 0 : Math.min(Number((totalAllocatedCents * 10000n) / totalTargetCents) / 100, 100);
  const completedCount = activeGoals.filter((goal) => getGoalStatus(goal) === "Completed").length;

  const selectedCurrent = useMemo(
    () => selectedGoal ? goals.find((goal) => goal.id === selectedGoal.id) ?? selectedGoal : null,
    [goals, selectedGoal],
  );

  function openAdd() {
    setEditingGoal(null);
    setDraft(emptyDraft());
    setDialog("add");
  }

  function openEdit(goal: SavingsGoal) {
    setEditingGoal(goal);
    setDraft(emptyDraft(goal));
    setDialog("edit");
  }

  function openAllocate(goal: SavingsGoal) {
    setEditingGoal(goal);
    setAllocationInput("");
    setAllocationNote("");
    setDialog("allocate");
  }

  function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = normalizePesoInput(draft.targetAmount);
    const savedAmount = normalizePesoInput(draft.savedAmount);
    const targetCents = targetAmount ? amountCents(targetAmount) : null;
    const savedCents = savedAmount ? amountCents(savedAmount) : null;

    if (!draft.name.trim()) return toast.error("Enter a goal name.");
    if (!targetAmount || targetCents === null || targetCents <= 0n) return toast.error("Target amount must be greater than zero.");
    if (!savedAmount || savedCents === null) return toast.error("Enter a valid initial allocation.");
    if (savedCents > targetCents) return toast.error("Initial allocated amount cannot exceed the target.");
    if (draft.targetDate && Number.isNaN(Date.parse(`${draft.targetDate}T00:00:00`))) return toast.error("Enter a valid target date.");

    if (dialog === "edit" && editingGoal) {
      setGoals((current) => current.map((goal) => goal.id === editingGoal.id ? {
        ...goal,
        name: draft.name.trim(),
        targetAmount,
        savedAmount,
        targetDate: draft.targetDate || undefined,
        description: draft.description.trim() || undefined,
        completed: savedCents === targetCents,
      } : goal));
      toast("Goal updated in preview", { description: "No account balance or transaction was changed." });
    } else {
      const initialHistory: SavingsAllocation[] = savedCents > 0n ? [{
        id: `allocation-${crypto.randomUUID()}`,
        amount: savedAmount,
        date: todayString(),
        note: "Initial allocation",
      }] : [];
      const goal: SavingsGoal = {
        id: `goal-${crypto.randomUUID()}`,
        name: draft.name.trim(),
        targetAmount,
        savedAmount,
        targetDate: draft.targetDate || undefined,
        description: draft.description.trim() || undefined,
        completed: savedCents === targetCents,
        history: initialHistory,
      };
      setGoals((current) => [goal, ...current]);
      toast("Goal added in preview", { description: "Allocated savings do not change account balances." });
    }
    setDialog(null);
  }

  function handleAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingGoal) applyAllocation(editingGoal, "add");
  }

  function applyAllocation(goal: SavingsGoal, direction: "add" | "remove") {
    const current = amountCents(goal.savedAmount) ?? 0n;
    const normalizedAmount = normalizePesoInput(allocationInput);
    const amount = normalizedAmount ? amountCents(normalizedAmount) : null;
    if (amount === null || amount <= 0n) return toast.error("Enter an adjustment greater than zero.");
    const next = direction === "add" ? current + amount : current - amount;
    if (next < 0n) return toast.error("Allocation cannot be negative.");
    if (next > (amountCents(goal.targetAmount) ?? 0n)) return toast.error("Allocation cannot exceed the goal target.");
    const historyEntry: SavingsAllocation = {
      id: `allocation-${crypto.randomUUID()}`,
      amount: `${direction === "remove" ? "−" : ""}${centsToAmount(amount)}`,
      date: todayString(),
      note: allocationNote.trim() || (direction === "add" ? "Allocation added" : "Allocation released"),
    };
    setGoals((currentGoals) => currentGoals.map((item) => item.id === goal.id ? {
      ...item,
      savedAmount: centsToAmount(next),
      completed: next >= (amountCents(item.targetAmount) ?? 0n),
      history: [historyEntry, ...(item.history ?? [])],
    } : item));
    setDialog(null);
    toast("Allocation adjusted in preview", { description: "This only changes the goal earmark." });
  }

  function confirmAction() {
    if (!confirmation) return;
    const { goal, action } = confirmation;
    if (action === "archive") {
      setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, isArchived: true } : item));
      toast("Goal archived in preview", { description: "The goal remains in your archived list." });
    } else {
      const current = amountCents(goal.savedAmount) ?? 0n;
      const target = amountCents(goal.targetAmount) ?? 0n;
      if (current < target) {
        toast.error("This goal has not reached its target yet.");
      } else {
        setGoals((items) => items.map((item) => item.id === goal.id ? { ...item, completed: true } : item));
        toast.success("Goal marked completed in preview.");
      }
    }
    setConfirmation(null);
  }

  function revertCompletion(goal: SavingsGoal) {
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, completed: false } : item));
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm leading-relaxed text-muted-foreground">Set aside portions of your existing money for the things that matter. Goal allocations are earmarks only—they never add to account balances or income.</p>
          <p className="mt-2 text-xs text-muted-foreground">Preview data only. Changes are temporary and reset when you reload.</p>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto"><Plus data-icon="inline-start" />Add goal</Button>
      </div>

      <section aria-label="Savings overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Savings goals" value={String(activeGoals.length)} caption={`${completedCount} completed`} icon={PiggyBank} iconClassName="bg-primary/10 text-primary" />
        <SummaryCard label="Total target amount" value={formatPeso(totalTarget)} caption="Across active goals" icon={Target} iconClassName="bg-chart-3/10 text-chart-3" />
        <SummaryCard label="Total allocated" value={formatPeso(totalAllocated)} caption="Earmarked from account balances" icon={Coins} iconClassName="bg-success/10 text-success" />
        <Card className="[--card-spacing:--spacing(5)]">
          <CardContent className="grid gap-3">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Overall progress</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{overallProgress.toFixed(overallProgress % 1 === 0 ? 0 : 1)}%</p></div><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingUp className="size-4" /></span></div>
            <Progress value={overallProgress} aria-label="Overall savings goal progress" className="h-2" />
            <p className="text-xs text-muted-foreground">Weighted by each goal’s target amount</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-sm font-semibold">Your goals</h2><p className="mt-0.5 text-xs text-muted-foreground">{visibleGoals.length} {visibleGoals.length === 1 ? "goal" : "goals"} shown</p></div>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm" onClick={() => setShowArchived((current) => !current)}><Archive data-icon="inline-start" />{showArchived ? "Hide archived" : `Show archived${goals.some((goal) => goal.isArchived) ? ` (${goals.filter((goal) => goal.isArchived).length})` : ""}`}</Button>
      </div>

      {visibleGoals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleGoals.map((goal) => <GoalCard key={goal.id} goal={goal} onOpen={setSelectedGoal} onEdit={openEdit} onAllocate={openAllocate} onComplete={(item) => setConfirmation({ goal: item, action: "complete" })} onArchive={(item) => setConfirmation({ goal: item, action: "archive" })} />)}
        </div>
      ) : (
        <EmptyState icon={PiggyBank} title={showArchived ? "No goals here yet" : "No savings goals yet"} description={showArchived ? "Archived goals will appear here." : "Create a goal to earmark existing money and track your progress."} action={!showArchived ? <Button onClick={openAdd}><Plus data-icon="inline-start" />Add your first goal</Button> : null} />
      )}

      <Dialog open={dialog === "add" || dialog === "edit"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{dialog === "edit" ? "Edit savings goal" : "Add savings goal"}</DialogTitle><DialogDescription>Goal allocations track existing money and do not change account balances.</DialogDescription></DialogHeader>
          <form onSubmit={handleGoalSubmit} className="grid gap-4">
            <Field label="Goal name" id="goal-name"><Input id="goal-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Emergency fund" maxLength={80} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target amount" id="goal-target"><PesoInput id="goal-target" value={draft.targetAmount} onChange={(value) => setDraft({ ...draft, targetAmount: value })} required /></Field>
              <Field label="Current allocated amount" id="goal-saved"><PesoInput id="goal-saved" value={draft.savedAmount} onChange={(value) => setDraft({ ...draft, savedAmount: value })} min="0" /></Field>
            </div>
            <Field label="Target date (optional)" id="goal-date"><Input id="goal-date" type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} /></Field>
            <Field label="Description (optional)" id="goal-description"><Input id="goal-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What are you saving for?" maxLength={200} /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit">{dialog === "edit" ? "Save changes" : "Create goal"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "allocate"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adjust goal allocation</DialogTitle><DialogDescription>Change the amount earmarked from existing accounts. No balance is moved or altered.</DialogDescription></DialogHeader>
          {editingGoal ? <form onSubmit={handleAllocation} className="grid gap-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">{editingGoal.name}</p><p className="mt-1 text-xs text-muted-foreground">Currently allocated {formatPeso(editingGoal.savedAmount)} of {formatPeso(editingGoal.targetAmount)}</p></div>
            <Field label="Amount to adjust" id="allocation-amount"><PesoInput id="allocation-amount" value={allocationInput} onChange={setAllocationInput} required min="0.01" /></Field>
            <Field label="Note (optional)" id="allocation-note"><Input id="allocation-note" value={allocationNote} onChange={(event) => setAllocationNote(event.target.value)} placeholder="e.g. Monthly savings" maxLength={200} /></Field>
            <DialogFooter className="sm:justify-between"><Button type="button" variant="outline" onClick={() => applyAllocation(editingGoal, "remove")}>Release allocation</Button><Button type="submit"><Plus data-icon="inline-start" />Add allocation</Button></DialogFooter>
          </form> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCurrent)} onOpenChange={(open) => { if (!open) setSelectedGoal(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selectedCurrent ? <>
            <DialogHeader><DialogTitle>{selectedCurrent.name}</DialogTitle><DialogDescription>{selectedCurrent.description || "Savings goal details"}</DialogDescription></DialogHeader>
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between"><span className="rounded-full border px-2.5 py-1 text-xs">{getGoalStatus(selectedCurrent)}</span>{selectedCurrent.targetDate ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />Target {formatShortDate(selectedCurrent.targetDate)}</span> : null}</div>
              <div className="grid grid-cols-2 gap-3"><Detail label="Target amount" value={formatPeso(selectedCurrent.targetAmount)} /><Detail label="Allocated" value={formatPeso(selectedCurrent.savedAmount)} /><Detail label="Remaining" value={formatPeso(remainingAmount(selectedCurrent))} /><Detail label="Progress" value={`${progressPercent(selectedCurrent).toFixed(progressPercent(selectedCurrent) % 1 === 0 ? 0 : 1)}%`} /></div>
              <Progress value={progressPercent(selectedCurrent)} aria-label={`${selectedCurrent.name} progress`} className="h-2" />
              <p className="text-xs leading-relaxed text-muted-foreground">This allocation is an earmark of money already included in your account balances. It does not change your total balance, income, or expenses.</p>
            </div>
            <div className="grid gap-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Allocation history</h3><span className="text-xs text-muted-foreground">{selectedCurrent.history?.length ?? 0} entries</span></div>
              {selectedCurrent.history?.length ? <ul className="divide-y rounded-lg border px-3">{selectedCurrent.history.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 py-3"><span className="flex min-w-0 items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Coins className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{entry.note}</span><span className="block text-xs text-muted-foreground">{formatShortDate(entry.date)}</span></span></span><span className={cn("shrink-0 text-sm font-medium tabular-nums", entry.amount.startsWith("−") ? "text-muted-foreground" : "text-success")}>{entry.amount.startsWith("−") ? "−" : "+"}{formatPeso(entry.amount.replace("−", ""))}</span></li>)}</ul> : <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No allocation history yet.</p>}
            </div>
            <DialogFooter className="sm:justify-between">
              {selectedCurrent.isArchived ? null : <Button variant="outline" onClick={() => { setSelectedGoal(null); openEdit(selectedCurrent); }}><Pencil data-icon="inline-start" />Edit goal</Button>}
              {getGoalStatus(selectedCurrent) === "Completed" ? <Button variant="outline" onClick={() => revertCompletion(selectedCurrent)}>Reopen goal</Button> : null}
              {!selectedCurrent.isArchived && getGoalStatus(selectedCurrent) !== "Completed" ? <Button onClick={() => { setSelectedGoal(null); openAllocate(selectedCurrent); }}><Plus data-icon="inline-start" />Adjust allocation</Button> : null}
            </DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{confirmation?.action === "archive" ? "Archive this goal?" : "Mark goal completed?"}</DialogTitle><DialogDescription>{confirmation?.action === "archive" ? "The goal and its allocation history will remain available under archived goals." : "Confirm that this goal has reached its target. No money will move between accounts."}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button><Button onClick={confirmAction}>{confirmation?.action === "archive" ? "Archive goal" : "Confirm completion"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function PesoInput({
  id,
  value,
  onChange,
  min = "0",
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  required?: boolean;
}) {
  return <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₱</span><Input id={id} type="number" inputMode="decimal" min={min} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0.00" className="pl-7 tabular-nums" required={required} /></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1"><span className="text-xs text-muted-foreground">{label}</span><span className="text-sm font-semibold tabular-nums">{value}</span></div>;
}
