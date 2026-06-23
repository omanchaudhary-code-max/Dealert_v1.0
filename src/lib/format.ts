
export function formatCurrency(
  value: number | null | undefined,
  options?: { decimals?: number }
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Rs. —";
  }

  const decimals = options?.decimals ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return `Rs. ${formatted}`;
}


export function formatPercentage(
  value: number | null | undefined,
  options?: { showSign?: boolean }
): string {
  if (value === null || value === undefined || Number.isNaN(value) || value < 0) {
    return "0%";
  }
  const rounded = Math.round(value);
  const sign = options?.showSign ? "+" : "";
  return `${sign}${rounded}%`;
}