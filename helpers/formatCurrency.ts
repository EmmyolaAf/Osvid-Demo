export function formatCurrency(
  currencyOrAmount: string | number = "NGN",
  maybeAmount?: number
): string {
  let currency = "NGN";
  let amount = 0;

  if (typeof currencyOrAmount === "number") {
    amount = currencyOrAmount;
    currency = "NGN";
  } else {
    currency = currencyOrAmount || "NGN";
    amount = maybeAmount !== undefined ? maybeAmount : 0;
  }

  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default formatCurrency;
