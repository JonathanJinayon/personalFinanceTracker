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

function parseAmountToCents(amount: string): bigint | null {
  const normalized = amount.trim().replace(/,/g, "");

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [peso, centavos = ""] = normalized.split(".");

  return BigInt(peso) * 100n + BigInt(centavos.padEnd(2, "0"));
}

function centsToPeso(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;

  return `${sign}${absolute / 100n}.${(absolute % 100n)
    .toString()
    .padStart(2, "0")}`;
}

export function normalizePesoInput(value: string): string | null {
  const cents = parseAmountToCents(value);

  return cents === null ? null : centsToPeso(cents);
}

export function sumPeso(amounts: string[]): string {
  const total = amounts.reduce((sum, amount) => {
    const cents = parseAmountToCents(amount);

    return cents === null ? sum : sum + cents;
  }, 0n);

  return centsToPeso(total);
}

export function isPesoPositive(value: string): boolean {
  const cents = parseAmountToCents(value);

  return cents !== null && cents > 0n;
}
