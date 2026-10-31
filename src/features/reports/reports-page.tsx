"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, RotateCcw, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPeso, formatPercent } from "@/lib/money";
import { deriveReports, getReportDateRange, reportAccounts, reportDatePresets, type ReportPeriod } from "@/lib/reports-data";

const periods: { value: ReportPeriod; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "last-3-months", label: "Last 3 Months" },
  { value: "this-year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const chartTooltipStyle = { borderRadius: 12, borderColor: "var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" };
const chartAmount = (value: number) => formatPeso(value.toFixed(2));

function SummaryCard({ label, value, caption, icon: Icon, tone }: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Wallet;
  tone: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("this-month");
  const initialRange = reportDatePresets.thisMonth;
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [accountId, setAccountId] = useState("all");

  const reports = useMemo(() => deriveReports(undefined, undefined, { period, accountId, fromDate, toDate }), [period, accountId, fromDate, toDate]);
  const trendData = useMemo(() => reports.months.map((item, index, all) => ({
    ...item,
    current: Number(item.expenses),
    previous: index > 0 ? Number(all[index - 1].expenses) : null,
  })), [reports.months]);

  function selectPeriod(value: ReportPeriod) {
    setPeriod(value);
    if (value !== "custom") {
      const range = getReportDateRange(value);
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
  }

  function clearFilters() {
    const range = reportDatePresets.thisMonth;
    setPeriod("this-month");
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setAccountId("all");
  }

  const noTransactions = reports.transactionCount === 0;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Understand your income, spending, and cash flow across accounts.</p>
        </div>
        <Badge variant="secondary" className="w-fit">Preview data</Badge>
      </div>

      <Card className="[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(5)]">
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
          <div className="grid gap-1.5">
            <label htmlFor="report-period" className="text-xs font-medium">Reporting period</label>
            <Select value={period} onValueChange={(value) => selectPeriod(value as ReportPeriod)}>
              <SelectTrigger id="report-period" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{periods.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="report-account" className="text-xs font-medium">Account</label>
            <Select value={accountId} onValueChange={(value) => setAccountId(value ?? "all")}>
              <SelectTrigger id="report-account" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All accounts</SelectItem>{reportAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}{account.isArchived ? " (archived)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {period === "custom" ? (
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-1">
              <div className="grid gap-1.5"><label htmlFor="report-from" className="text-xs font-medium">From</label><Input id="report-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
              <div className="grid gap-1.5"><label htmlFor="report-to" className="text-xs font-medium">To</label><Input id="report-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
            </div>
          ) : (
            <p className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1"><CalendarDays className="size-4 shrink-0" />{fromDate} – {toDate}</p>
          )}
          <Button type="button" variant="outline" onClick={clearFilters} className="w-full sm:w-fit"><RotateCcw data-icon="inline-start" />Clear filters</Button>
        </CardContent>
      </Card>

      <section aria-label="Financial summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Income" value={formatPeso(reports.income)} caption="Recorded income" icon={ArrowDownRight} tone="bg-success/10 text-success" />
        <SummaryCard label="Total Expenses" value={formatPeso(reports.expenses)} caption="Recorded expenses" icon={ArrowUpRight} tone="bg-destructive/10 text-destructive" />
        <SummaryCard label="Net Cash Flow" value={formatPeso(reports.net)} caption="Income minus expenses" icon={Activity} tone="bg-primary/10 text-primary" />
        <SummaryCard label="Savings Rate" value={formatPercent(reports.savingsRate / 100, 1)} caption="Net cash flow ÷ income" icon={ChartNoAxesCombined} tone="bg-chart-3/10 text-chart-3" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader><CardTitle>Expense breakdown</CardTitle><CardDescription>Spending by category for the selected filters</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[minmax(190px,0.85fr)_1.15fr] md:items-center">
            {reports.categories.length ? <>
              <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reports.categories} dataKey={(item) => Number(item.amount)} nameKey="category" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="var(--card)" strokeWidth={3}>
                      {reports.categories.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value, _name, item) => [chartAmount(Number(value)), item.payload.category]} contentStyle={chartTooltipStyle} />
                    <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize="12">Total spent</text>
                    <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize="16" fontWeight="600">{formatPeso(reports.expenses)}</text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-3">
                {reports.categories.map((item, index) => <li key={item.category}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 font-medium"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{item.category}</span></span>
                    <span className="flex shrink-0 items-baseline gap-2 text-right tabular-nums"><span className="font-medium">{formatPeso(item.amount)}</span><span className="w-9 text-muted-foreground">{formatPercent(item.percent / 100)}</span></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(item.percent, 100)}%`, backgroundColor: chartColors[index % chartColors.length] }} /></div>
                </li>)}
              </ul>
            </> : <EmptyChart message="No expenses found for this period." />}
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader><CardTitle>Income vs. expenses</CardTitle><CardDescription>Monthly totals and net cash flow</CardDescription></CardHeader>
          <CardContent>
            {reports.months.length ? <div className="h-[270px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reports.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} dy={8} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value) => `₱${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value)}`} width={52} />
                  <Tooltip formatter={(value, name) => [chartAmount(Number(value)), name === "net" ? "Net cash flow" : name === "income" ? "Income" : "Expenses"]} contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Income" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="net" name="Net cash flow" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.08} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div> : <EmptyChart message="No income or expenses found for this period." />}
          </CardContent>
        </Card>
      </section>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader><CardTitle>Spending trends</CardTitle><CardDescription>Monthly expense totals compared with the previous month</CardDescription></CardHeader>
        <CardContent>
          {trendData.length >= 1 ? <div className="h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} dy={8} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value) => `₱${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value)}`} width={52} />
                <Tooltip formatter={(value, name) => [chartAmount(Number(value)), name === "previous" ? "Previous month" : "Selected month"]} contentStyle={chartTooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="current" name="Selected month" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={2.5} />
                <Area type="monotone" dataKey="previous" name="Previous month" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.05} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div> : <EmptyChart message="No monthly spending data is available for the selected filters." />}
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(5)]">
        <CardHeader><CardTitle>Account report</CardTitle><CardDescription>Income and expenses by account; internal transfers are excluded</CardDescription></CardHeader>
        <CardContent>
          {reports.accounts.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="pb-3 font-medium">Account</th><th className="pb-3 text-right font-medium">Income</th><th className="pb-3 text-right font-medium">Expenses</th><th className="pb-3 text-right font-medium">Net cash flow</th></tr></thead>
              <tbody className="divide-y">{reports.accounts.map((item) => <tr key={item.accountId}><th scope="row" className="py-3 font-medium">{item.accountName}</th><td className="py-3 text-right tabular-nums">{formatPeso(item.income)}</td><td className="py-3 text-right tabular-nums">{formatPeso(item.expenses)}</td><td className={`py-3 text-right font-medium tabular-nums ${item.net.startsWith("-") ? "text-destructive" : "text-success"}`}>{formatPeso(item.net)}</td></tr>)}</tbody>
            </table>
          </div> : <EmptyChart message="No account activity found for this period." />}
        </CardContent>
      </Card>

      {noTransactions ? <p className="text-center text-xs text-muted-foreground">No income or expense transactions match these filters. Transfers and savings allocations are not included in report totals.</p> : <p className="text-center text-xs text-muted-foreground">Based on {reports.transactionCount} recorded income and expense {reports.transactionCount === 1 ? "transaction" : "transactions"}. Transfer amounts and savings allocations are not counted as income or expenses.</p>}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 px-4 text-center"><span className="flex size-9 items-center justify-center rounded-full bg-muted"><ChartNoAxesCombined className="size-4 text-muted-foreground" /></span><p className="max-w-sm text-sm text-muted-foreground">{message}</p></div>;
}
