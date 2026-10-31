const shortDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
});

export function formatShortDate(date: string): string {
  return shortDateFormatter.format(new Date(`${date}T00:00:00`));
}
