"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowUpDown,
  Check,
  CircleDollarSign,
  ListFilter,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatShortDate } from "@/lib/date";
import { mockAccounts, mockCategories, mockTransactions } from "@/lib/mock-data";
import { formatPeso, normalizePesoInput, sumPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types/finance";

type SortKey = "date" | "amount";
type SortDirection = "asc" | "desc";
type Draft = {
  type: TransactionType;
  description: string;
  amount: string;
  accountId: string;
  destinationAccountId: string;
  category: string;
  date: string;
  fee: string;
  notes: string;
};

const labels: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

const icons = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
} satisfies Record<TransactionType, typeof ArrowDownLeft>;

const iconStyles: Record<TransactionType, string> = {
  income: "bg-success/10 text-success",
  expense: "bg-destructive/10 text-destructive",
  transfer: "bg-primary/10 text-primary",
};

function blankDraft(type: TransactionType = "expense"): Draft {
  return {
    type,
    description: "",
    amount: "",
    accountId: "",
    destinationAccountId: "",
    category: "",
    date: "",
    fee: "",
    notes: "",
  };
}

function moneyNumber(amount: string) {
  return Number(normalizePesoInput(amount) ?? "0.00");
}

function toCents(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function fromCents(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function signedAmount(transaction: Transaction) {
  if (transaction.cancelled) return `Reversed · ${formatPeso(transaction.amount)}`;
  if (transaction.type === "income") return `+${formatPeso(transaction.amount)}`;
  if (transaction.type === "expense") return `−${formatPeso(transaction.amount)}`;
  return formatPeso(transaction.amount);
}

function SummaryCard({
  title,
  amount,
  icon: Icon,
  tone,
  caption,
}: {
  title: string;
  amount: string;
  icon: typeof ArrowDownLeft;
  tone: string;
  caption: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">
            {formatPeso(amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState(mockTransactions);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [selected, setSelected] = useState<Transaction | null>(null);

  const categories = useMemo(
    () => [...new Set([...mockCategories.map((category) => category.name), ...transactions.map((txn) => txn.category).filter((value): value is string => Boolean(value))])],
    [transactions],
  );

  const filtered = useMemo(() => transactions
    .filter((transaction) => {
      const dateInRange = (!fromDate || transaction.date >= fromDate) && (!toDate || transaction.date <= toDate);
      const inPeriod = (!periodFrom || transaction.date >= periodFrom) && (!periodTo || transaction.date <= periodTo);
      const accountMatch = accountFilter === "all" || transaction.accountId === accountFilter || (transaction.type === "transfer" && transaction.destinationAccountId === accountFilter);
      return (
        !transaction.cancelled &&
        transaction.description.toLowerCase().includes(search.trim().toLowerCase()) &&
        (typeFilter === "all" || transaction.type === typeFilter) &&
        accountMatch &&
        (categoryFilter === "all" || transaction.category === categoryFilter) &&
        dateInRange &&
        inPeriod
      );
    })
    .sort((first, second) => {
      const comparison = sortKey === "date"
        ? first.date.localeCompare(second.date)
        : moneyNumber(first.amount) - moneyNumber(second.amount);
      return sortDirection === "asc" ? comparison : -comparison;
    }), [transactions, search, typeFilter, accountFilter, categoryFilter, fromDate, toDate, periodFrom, periodTo, sortKey, sortDirection]);

  const incomeTotal = sumPeso(filtered.filter((txn) => txn.type === "income").map((txn) => txn.amount));
  const expenseAmounts = filtered.filter((txn) => txn.type === "expense").map((txn) => txn.amount);
  const transferFeeTransactions = transactions.filter((txn) => {
    if (txn.cancelled || txn.type !== "transfer" || !txn.fee) return false;
    const dateInRange = (!fromDate || txn.date >= fromDate) && (!toDate || txn.date <= toDate);
    const inPeriod = (!periodFrom || txn.date >= periodFrom) && (!periodTo || txn.date <= periodTo);
    const accountMatch = accountFilter === "all" || txn.accountId === accountFilter;
    const queryMatch = txn.description.toLowerCase().includes(search.trim().toLowerCase());
    return dateInRange && inPeriod && accountMatch && queryMatch && (typeFilter === "all" || typeFilter === "transfer") && (categoryFilter === "all" || categoryFilter === "transfer fees");
  });
  const transferFees = transferFeeTransactions.map((txn) => txn.fee ?? "0.00");
  const expenseTotal = sumPeso([...expenseAmounts, ...transferFees]);
  const incomeCents = toCents(incomeTotal);
  const expenseCents = toCents(expenseTotal);
  const netCashFlow = fromCents(incomeCents - expenseCents);

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setAccountFilter("all");
    setCategoryFilter("all");
    setFromDate("");
    setToDate("");
    setPeriodFrom("");
    setPeriodTo("");
  }

  function openAdd(type: TransactionType = "expense") {
    const now = new Date();
    const currentDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    setDraft({ ...blankDraft(type), date: currentDate });
    setAdding(true);
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = normalizePesoInput(draft.amount);
    const fee = draft.fee.trim() ? normalizePesoInput(draft.fee) : "0.00";
    if (!draft.description.trim()) {
      toast.error("Enter a transaction description.");
      return;
    }
    if (!amount || moneyNumber(amount) <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    if (draft.type === "transfer" && draft.accountId === draft.destinationAccountId) {
      toast.error("Choose two different accounts for a transfer.");
      return;
    }
    if (draft.type === "transfer" && draft.fee.trim() && fee === null) {
      toast.error("Enter a valid non-negative transfer fee.");
      return;
    }
    if (!draft.accountId || !draft.date || (draft.type === "expense" && !draft.category) || (draft.type === "transfer" && !draft.destinationAccountId)) {
      toast.error("Complete all required fields.");
      return;
    }

    const account = mockAccounts.find((item) => item.id === draft.accountId);
    const destination = mockAccounts.find((item) => item.id === draft.destinationAccountId);
    const transaction: Transaction = {
      id: `txn-${crypto.randomUUID()}`,
      type: draft.type,
      date: draft.date,
      description: draft.description.trim(),
      amount,
      accountId: draft.accountId,
      accountName: account?.name ?? "Unknown account",
      ...(draft.type === "transfer" && destination ? { destinationAccountName: destination.name, destinationAccountId: destination.id } : {}),
      ...(draft.type === "expense" ? { category: draft.category } : {}),
      ...(draft.type === "transfer" && fee && fee !== "0.00" ? { fee } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    };
    setTransactions((current) => [transaction, ...current]);
    setAdding(false);
    toast("Preview only", { description: "This transaction is temporary and resets when you reload." });
  }

  function cancelTransaction(transaction: Transaction) {
    setTransactions((current) => current.map((item) => item.id === transaction.id ? { ...item, cancelled: true } : item));
    setSelected(null);
    toast("Reversal recorded in preview", { description: "The original transaction remains in history." });
  }

  function changeSort(next: SortKey) {
    if (sortKey === next) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(next);
      setSortDirection("desc");
    }
  }

  const hasFilters = Boolean(search || typeFilter !== "all" || accountFilter !== "all" || categoryFilter !== "all" || fromDate || toDate || periodFrom || periodTo);
  const displayTransactions = [...new Map([...filtered, ...transferFeeTransactions].map((transaction) => [transaction.id, transaction])).values()]
    .sort((a, b) => {
      const amountA = a.type === "transfer" && a.fee && transferFeeTransactions.some((feeTransaction) => feeTransaction.id === a.id) ? a.fee : a.amount;
      const amountB = b.type === "transfer" && b.fee && transferFeeTransactions.some((feeTransaction) => feeTransaction.id === b.id) ? b.fee : b.amount;
      const comparison = sortKey === "date" ? a.date.localeCompare(b.date) : moneyNumber(amountA) - moneyNumber(amountB);
      return sortDirection === "asc" ? comparison : -comparison;
    });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">A clear view of money moving into, out of, and between your accounts.</p>
          <p className="mt-2 text-xs text-muted-foreground">Preview data only. Changes are temporary and reset when you reload.</p>
        </div>
        <Button onClick={() => openAdd()} className="w-full sm:w-auto"><Plus data-icon="inline-start" />Add transaction</Button>
      </div>

      <section aria-label="Transaction summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard title="Total income" amount={incomeTotal} icon={ArrowDownLeft} tone="bg-success/10 text-success" caption="For the selected period and filters" />
        <SummaryCard title="Total expenses" amount={expenseTotal} icon={ArrowUpRight} tone="bg-destructive/10 text-destructive" caption={transferFees.length ? "Includes transfer fees" : "For the selected period and filters"} />
        <SummaryCard title="Net cash flow" amount={netCashFlow} icon={CircleDollarSign} tone="bg-primary/10 text-primary" caption="Income less expenses and fees" />
      </section>

      <Card className="[--card-spacing:--spacing(4)]">
        <div className="flex flex-col gap-3 px-(--card-spacing) lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search transaction description" placeholder="Search descriptions..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={[["all", "All types"], ["income", "Income"], ["expense", "Expense"], ["transfer", "Transfer"]]} />
            <FilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={[["all", "All accounts"], ...mockAccounts.map((account) => [account.id, account.name] as [string, string])]} />
            <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={[["all", "All categories"], ...categories.map((category) => [category, category] as [string, string])]} />
          </div>
        </div>
        <div className="grid gap-2 px-(--card-spacing) sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5"><Label htmlFor="filter-from">Date from</Label><Input id="filter-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="filter-to">Date to</Label><Input id="filter-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
          <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}><X data-icon="inline-start" />Clear filters</Button>
        </div>
        <div className="flex items-center justify-between border-t px-(--card-spacing) pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ListFilter className="size-3.5" />{displayTransactions.length} {displayTransactions.length === 1 ? "transaction" : "transactions"}</span>
          <span>Temporary preview</span>
        </div>
      </Card>

      <Card className="[--card-spacing:--spacing(4)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-(--card-spacing)">
          <div><h2 className="text-sm font-semibold">Transaction history</h2><p className="mt-0.5 text-xs text-muted-foreground">Select a row to view its details</p></div>
          <Button variant="outline" size="sm" onClick={() => changeSort(sortKey)}><ArrowUpDown data-icon="inline-start" />Sort {sortKey}: {sortDirection === "desc" ? "newest / highest" : "oldest / lowest"}</Button>
        </div>
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground"><tr>
              <th className="sticky left-0 bg-muted/70 px-4 py-3 font-medium backdrop-blur-sm">Transaction</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium"><button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeSort("date")}>Date<ArrowUpDown className="size-3" /></button></th><th className="px-4 py-3 text-right font-medium"><button className="ml-auto inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeSort("amount")}>Amount<ArrowUpDown className="size-3" /></button></th>
            </tr></thead>
            <tbody className="divide-y">
              {displayTransactions.map((transaction) => {
                const Icon = icons[transaction.type];
                const isTransferFee = transaction.type === "transfer" && Boolean(transaction.fee) && transferFeeTransactions.some((feeTransaction) => feeTransaction.id === transaction.id);
                return <tr key={transaction.id} onClick={() => setSelected(transaction)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(transaction); } }} tabIndex={0} className="group/row cursor-pointer transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none">
                  <td className="sticky left-0 bg-card px-4 py-3 group-hover/row:bg-muted/30"><div className="flex min-w-48 items-center gap-3"><span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", iconStyles[transaction.type])}><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate font-medium">{isTransferFee ? `Transfer fee · ${transaction.description}` : transaction.description}</span>{transaction.fee && !isTransferFee ? <span className="block text-xs text-muted-foreground">Fee {formatPeso(transaction.fee)}</span> : null}</span></div></td>
                  <td className="px-4 py-3"><span className="rounded-full border px-2 py-1 text-xs">{isTransferFee ? "Expense" : labels[transaction.type]}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{isTransferFee ? "Transfer Fees" : transaction.category ?? "—"}</td>
                  <td className="px-4 py-3"><span className="block">{transaction.accountName}</span>{transaction.destinationAccountName ? <span className="text-xs text-muted-foreground">to {transaction.destinationAccountName}</span> : null}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatShortDate(transaction.date)}</td>
                  <td className={cn("px-4 py-3 text-right font-medium tabular-nums", transaction.type === "income" && "text-success", (transaction.type === "expense" || isTransferFee) && "text-destructive")}>{isTransferFee ? `−${formatPeso(transaction.fee ?? "0.00")}` : signedAmount(transaction)}</td>
                </tr>;
              })}
              {displayTransactions.length === 0 ? <tr><td colSpan={6} className="px-4 py-14 text-center"><div className="mx-auto flex max-w-sm flex-col items-center gap-2"><span className="flex size-10 items-center justify-center rounded-full bg-muted"><Search className="size-4 text-muted-foreground" /></span><p className="font-medium">No transactions found</p><p className="text-xs text-muted-foreground">Try changing your search or filters.</p>{hasFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : null}</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <TransactionFormDialog open={adding} draft={draft} onOpenChange={setAdding} onDraftChange={setDraft} onSubmit={submitDraft} />
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          {selected ? <>
            <DialogHeader><DialogTitle>Transaction details</DialogTitle><DialogDescription>Review the information recorded in this temporary preview.</DialogDescription></DialogHeader>
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
              <Detail label="Description" value={selected.description} /><Detail label="Type" value={labels[selected.type]} /><Detail label="Account" value={selected.type === "transfer" ? `${selected.accountName} → ${selected.destinationAccountName ?? "—"}` : selected.accountName} /><Detail label="Category" value={selected.category ?? "—"} /><Detail label="Date" value={formatShortDate(selected.date)} /><Detail label="Amount" value={formatPeso(selected.amount)} />{selected.fee ? <Detail label="Transfer fee (expense)" value={formatPeso(selected.fee)} /> : null}{selected.notes ? <Detail label="Notes" value={selected.notes} /> : null}
            </div>
            <p className="text-xs text-muted-foreground">For financial history, corrections should be recorded as reversals rather than deleting an entry.</p>
            <DialogFooter className="sm:justify-between"><Button variant="outline" onClick={() => { setSelected(null); openAdd(selected.type); }}>Edit in preview</Button><Button variant="destructive" onClick={() => cancelTransaction(selected)}>Reverse transaction</Button></DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}><SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className="w-full sm:min-w-32"><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{options.map(([option, text]) => <SelectItem key={option} value={option}>{text}</SelectItem>)}</SelectContent></Select>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function TransactionFormDialog({
  open,
  draft,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  open: boolean;
  draft: Draft;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: Draft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    onDraftChange({ ...draft, [key]: value });
  }

  function field(label: string, id: string, element: import("react").ReactNode) {
    return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label>{element}</div>;
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Add transaction</DialogTitle><DialogDescription>Record a preview transaction. Nothing is saved permanently.</DialogDescription></DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">{(["expense", "income", "transfer"] as TransactionType[]).map((type) => { const Icon = icons[type]; return <Button key={type} type="button" variant={draft.type === type ? "default" : "outline"} onClick={() => onDraftChange({ ...blankDraft(type), date: draft.date })} className="px-2"><Icon className="size-4" />{labels[type]}</Button>; })}</div>
        {field("Description", "txn-description", <Input id="txn-description" autoFocus value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. Groceries" maxLength={120} required />)}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("Amount", "txn-amount", <Input id="txn-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={draft.amount} onChange={(event) => update("amount", event.target.value)} required />)}
          {field("Date", "txn-date", <Input id="txn-date" type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} required />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(draft.type === "income" ? "Destination account" : draft.type === "transfer" ? "Source account" : "Source account", "txn-account", <Select value={draft.accountId} onValueChange={(value) => update("accountId", value ?? "")}><SelectTrigger id="txn-account" className="w-full"><SelectValue placeholder="Choose account" /></SelectTrigger><SelectContent>{mockAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}{account.isArchived ? " (archived)" : ""}</SelectItem>)}</SelectContent></Select>)}
          {draft.type === "transfer" ? field("Destination account", "txn-destination", <Select value={draft.destinationAccountId} onValueChange={(value) => update("destinationAccountId", value ?? "")}><SelectTrigger id="txn-destination" className="w-full"><SelectValue placeholder="Choose account" /></SelectTrigger><SelectContent>{mockAccounts.filter((account) => account.id !== draft.accountId).map((account) => <SelectItem key={account.id} value={account.id}>{account.name}{account.isArchived ? " (archived)" : ""}</SelectItem>)}</SelectContent></Select>) : draft.type === "expense" ? field("Expense category", "txn-category", <Select value={draft.category} onValueChange={(value) => update("category", value ?? "")}><SelectTrigger id="txn-category" className="w-full"><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{mockCategories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}</SelectContent></Select>) : <div />}
        </div>
          {draft.type === "transfer" ? field("Transfer fee (optional)", "txn-fee", <Input id="txn-fee" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={draft.fee} onChange={(event) => update("fee", event.target.value)} />) : null}
        {field("Notes (optional)", "txn-notes", <Input id="txn-notes" value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Add a note" maxLength={300} />)}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Check data-icon="inline-start" />Add {labels[draft.type].toLowerCase()}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
