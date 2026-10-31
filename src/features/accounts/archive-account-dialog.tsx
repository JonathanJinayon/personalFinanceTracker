"use client";

import { Archive, TriangleAlert } from "lucide-react";
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
import { formatPeso, isPesoPositive } from "@/lib/money";
import type { Account } from "@/types/finance";

export function ArchiveAccountDialog({
  account,
  onConfirm,
  onClose,
}: {
  account: Account;
  onConfirm: (account: Account) => void;
  onClose: () => void;
}) {
  const hasOutstandingBalance = isPesoPositive(account.balance);

  function handleConfirm() {
    onConfirm(account);
    onClose();
    toast.success("Account archived", {
      description:
        "The account remains in history. This change resets when you reload.",
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
          <DialogTitle>Archive {account.name}?</DialogTitle>
          <DialogDescription>
            Archived accounts stay visible in history but are excluded from
            active totals. Nothing is permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatPeso(account.balance)}
          </p>
        </div>

        {hasOutstandingBalance ? (
          <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-warning-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed">
              This account still has an outstanding balance of{" "}
              <span className="font-semibold">
                {formatPeso(account.balance)}
              </span>
              . Move the funds to another account before archiving it.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={hasOutstandingBalance}
          >
            <Archive data-icon="inline-start" />
            Archive account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
