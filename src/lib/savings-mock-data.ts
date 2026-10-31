import type { SavingsGoal } from "@/types/finance";

export const mockSavingsGoals: SavingsGoal[] = [
  {
    id: "goal-001",
    name: "Emergency fund",
    targetAmount: "50000.00",
    savedAmount: "18500.00",
    targetDate: "2027-06-30",
    description: "A comfortable cushion for unexpected expenses.",
    history: [
      { id: "allocation-001", amount: "5000.00", date: "2026-10-15", note: "Monthly allocation" },
      { id: "allocation-002", amount: "3500.00", date: "2026-09-15", note: "Monthly allocation" },
      { id: "allocation-003", amount: "10000.00", date: "2026-08-01", note: "Initial earmark" },
    ],
  },
  {
    id: "goal-002",
    name: "Japan trip",
    targetAmount: "80000.00",
    savedAmount: "24000.00",
    targetDate: "2028-03-01",
    description: "Travel fund for a future Japan trip.",
    history: [
      { id: "allocation-004", amount: "4000.00", date: "2026-10-01", note: "Trip fund allocation" },
      { id: "allocation-005", amount: "20000.00", date: "2026-07-01", note: "Initial earmark" },
    ],
  },
  {
    id: "goal-003",
    name: "New laptop",
    targetAmount: "60000.00",
    savedAmount: "15000.00",
    description: "Replacement laptop for work and personal use.",
    history: [
      { id: "allocation-006", amount: "5000.00", date: "2026-10-20", note: "Monthly allocation" },
      { id: "allocation-007", amount: "10000.00", date: "2026-09-01", note: "Initial earmark" },
    ],
  },
];
