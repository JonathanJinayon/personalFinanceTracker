"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { accountTypeLabels } from "@/lib/account-meta";
import { normalizePesoInput } from "@/lib/money";
import type { Account, AccountType } from "@/types/finance";

const accountTypes: AccountType[] = ["bank", "ewallet", "cash"];

export function AddAccountDialog({
  onAdd,
  trigger,
}: {
  onAdd: (account: Account) => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [initialBalance, setInitialBalance] = useState("0.00");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [balanceError, setBalanceError] = useState("");

  function resetForm() {
    setName("");
    setType("bank");
    setInitialBalance("0.00");
    setDescription("");
    setNameError("");
    setBalanceError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetForm();
    }
    setOpen(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalizedBalance = normalizePesoInput(initialBalance.trim() || "0");

    let valid = true;

    if (!trimmedName) {
      setNameError("Enter an account name.");
      valid = false;
    }

    if (normalizedBalance === null) {
      setBalanceError("Enter a valid amount with up to 2 decimals.");
      valid = false;
    }

    if (!valid || normalizedBalance === null) {
      return;
    }

    onAdd({
      id: crypto.randomUUID(),
      name: trimmedName,
      type,
      balance: normalizedBalance,
      description: description.trim() || undefined,
      isArchived: false,
    });
    setOpen(false);
    toast.success("Account added", {
      description: "Preview only. This change resets when you reload.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            Create a bank, e-wallet, or cash account. This is a preview and
            nothing is saved permanently.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="add-account-name">Account name</Label>
            <Input
              id="add-account-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
              placeholder="e.g. BPI Savings"
              maxLength={80}
              aria-invalid={Boolean(nameError)}
              required
            />
            {nameError ? (
              <p className="text-[11px] text-destructive">{nameError}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="add-account-type">Account type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountType)}
              >
                <SelectTrigger id="add-account-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((accountType) => (
                    <SelectItem key={accountType} value={accountType}>
                      {accountTypeLabels[accountType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="add-account-balance">Initial balance</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  ₱
                </span>
                <Input
                  id="add-account-balance"
                  value={initialBalance}
                  onChange={(event) => {
                    setInitialBalance(event.target.value);
                    setBalanceError("");
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-7 tabular-nums"
                  aria-invalid={Boolean(balanceError)}
                  required
                />
              </div>
              {balanceError ? (
                <p className="text-[11px] text-destructive">
                  {balanceError}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Recorded once as an opening balance.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-account-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="add-account-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this account used for?"
              rows={2}
              maxLength={200}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
