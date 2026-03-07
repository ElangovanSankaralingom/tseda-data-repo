export type Comparison = {
  current: number;
  previous: number;
  delta: number;
  percentChange: number;
  direction: "up" | "down" | "flat";
};

export function compare(current: number, previous: number): Comparison {
  const delta = current - previous;
  const percentChange = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { current, previous, delta, percentChange, direction } as const;
}

/** Filter data points to a date range. Returns items where date >= from and date <= to. */
export function filterByDateRange<T extends { date: string }>(
  items: T[],
  from: string,
  to: string
): T[] {
  return items.filter((item) => item.date >= from && item.date <= to);
}

/** Get YYYY-MM-DD for N days ago */
export function daysAgo(n: number, from?: Date): string {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Get YYYY-MM-DD for the first day of this month */
export function monthStart(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Get YYYY-MM-DD for the first day of last month */
export function lastMonthStart(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Group items by a key function and count */
export function groupAndCount<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}
