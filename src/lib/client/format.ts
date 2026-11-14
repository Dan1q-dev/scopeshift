const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Contract amounts are integer cents. Whole-dollar values are shown without decimals. */
export function formatMoney(cents: number) {
  return cents % 100 === 0 ? usd.format(cents / 100) : usdCents.format(cents / 100);
}

export function formatSignedMoney(cents: number) {
  if (cents === 0) return "$0";
  return `${cents > 0 ? "+" : "-"}${formatMoney(Math.abs(cents))}`;
}

export function formatRate(centsPerHour: number) {
  return `${usdCents.format(centsPerHour / 100)}/h`;
}

export function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function formatDays(days: number) {
  return `${days} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

export function formatSigned(value: number, unit: string) {
  if (value === 0) return `0 ${unit}`;
  const shown = Number.isInteger(value) ? Math.abs(value) : Math.abs(value).toFixed(1);
  return `${value > 0 ? "+" : "-"}${shown} ${unit}`;
}
