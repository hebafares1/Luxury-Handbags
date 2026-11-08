export const USD_TO_KWD_RATE = 0.310519;

const kwdFormatter = new Intl.NumberFormat('en-KW', {
  style: 'currency',
  currency: 'KWD',
  currencyDisplay: 'code',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function formatStorePrice(price: number): string {
  return kwdFormatter.format(price);
}

export function convertUsdToKwd(price: number): number {
  return Number((price * USD_TO_KWD_RATE).toFixed(3));
}
