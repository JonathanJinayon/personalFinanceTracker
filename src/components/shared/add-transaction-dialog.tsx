"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockAccounts, mockCategories } from "@/lib/mock-data";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function AmountInput({ id = "amount" }: { id?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        ₱
      </span>
      <Input
        id={id}
        name="amount"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        placeholder="0.00"
        className="pl-7 tabular-nums"
        required
      />
    </div>
  );
}

function AccountOptions() {
  return (
    <>
      {mockAccounts.map((account) => (
        <SelectItem key={account.id} value={account.id}>
          {account.name}
        </SelectItem>
      ))}
    </>
  );
}

export function AddTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDate(new Date().toISOString().slice(0, 10));
    }
    setOpen(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    toast("Preview only", {
      description:
        "This transaction was not saved. Persistence arrives with the backend.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">Add transaction</span>
          <span className="sr-only sm:hidden">Add transaction</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>
            Record money moving in, out, or between your accounts.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="expense" className="gap-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense">
              <ArrowUpRight data-icon="inline-start" />
              Expense
            </TabsTrigger>
            <TabsTrigger value="income">
              <ArrowDownLeft data-icon="inline-start" />
              Income
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <ArrowLeftRight data-icon="inline-start" />
              Transfer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Field label="Amount" htmlFor="expense-amount">
                <AmountInput id="expense-amount" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account" htmlFor="expense-account">
                  <Select name="account" required>
                    <SelectTrigger id="expense-account" className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <AccountOptions />
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Category" htmlFor="expense-category">
                  <Select name="category" required>
                    <SelectTrigger id="expense-category" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" htmlFor="expense-date">
                  <Input
                    id="expense-date"
                    name="date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="expense-description">
                  <Input
                    id="expense-description"
                    name="description"
                    placeholder="e.g. Lunch"
                    maxLength={120}
                  />
                </Field>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Add expense</Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="income">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Field label="Amount" htmlFor="income-amount">
                <AmountInput id="income-amount" />
              </Field>
              <Field label="Deposit to" htmlFor="income-account">
                <Select name="account" required>
                  <SelectTrigger id="income-account" className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <AccountOptions />
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" htmlFor="income-date">
                  <Input
                    id="income-date"
                    name="date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="income-description">
                  <Input
                    id="income-description"
                    name="description"
                    placeholder="e.g. Salary"
                    maxLength={120}
                  />
                </Field>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Add income</Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="transfer">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <Field label="Amount" htmlFor="transfer-amount">
                <AmountInput id="transfer-amount" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From account" htmlFor="transfer-from">
                  <Select name="from" required>
                    <SelectTrigger id="transfer-from" className="w-full">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <AccountOptions />
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="To account" htmlFor="transfer-to">
                  <Select name="to" required>
                    <SelectTrigger id="transfer-to" className="w-full">
                      <SelectValue placeholder="Destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <AccountOptions />
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fee (optional)"
                  htmlFor="transfer-fee"
                  hint="A fee is recorded as an expense."
                >
                  <Input
                    id="transfer-fee"
                    name="fee"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Date" htmlFor="transfer-date">
                  <Input
                    id="transfer-date"
                    name="date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="Description" htmlFor="transfer-description">
                <Input
                  id="transfer-description"
                  name="description"
                  placeholder="e.g. Move to e-wallet"
                  maxLength={120}
                />
              </Field>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Add transfer</Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
