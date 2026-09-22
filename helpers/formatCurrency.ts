const formatCurrency = (currency: string = "NGN", amount: number) =>
  new Intl.NumberFormat(currency === "NGN" ? "en-NG" : undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0, // Ensures no decimal places
  }).format(amount);

export default formatCurrency;
