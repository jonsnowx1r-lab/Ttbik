export function generateOrderCode(): string {
  const rand = crypto.randomUUID().split("-")[0].toUpperCase();
  return `ORD-${rand}`;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "مجاني";
  return `$${amount.toFixed(2)}`;
}
