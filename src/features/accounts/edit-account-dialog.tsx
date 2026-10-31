"use client";

import { useState, type FormEvent } from "react";
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
import {
  accountTypeLabels,
} from "@/lib/account-meta";
import { formatPeso } from "@/lib/money";
import type { Account, AccountType } from "@/types/finance";

const accountTypes: AccountType[] = ["bank", "ewallet", "cash"];

export function EditAccountDialog({
  account,
  onSave,
  onClose,
}: {
  account: Account;
  onSave: (account: Account) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [description, setDescription] = useState(account.description ?? "");
  const [nameError, setNameError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError("Enter an account name.");
      return;
    }

    onSave({
      ...account,
      name: trimmedName,
      type,
      description: description.trim() || undefined,
    });
    onClose();
    toast.success("Account updated", {
      description: "Preview only. This change resets when you reload.",
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription>
            Update the account details. Balances are managed by transactions
            and are not editable here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-account-name">Account name</Label>
            <Input
              id="edit-account-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
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
              <Label htmlFor="edit-account-type">Account type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountType)}
              >
                <SelectTrigger id="edit-account-type" className="w-full">
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
              <Label htmlFor="edit-account-balance">Current balance</Label>
              <Input
                id="edit-account-balance"
                value={formatPeso(account.balance)}
                readOnly
                disabled
                className="tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Balance changes require financial transactions.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-account-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-account-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
