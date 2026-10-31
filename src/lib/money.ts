const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPeso(amount: string): string {
  // Display-only formatting. Authoritative money values come from PostgreSQL numeric.
  return pesoFormatter.format(Number(amount));
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-PH", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
