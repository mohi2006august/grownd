// Amounts are stored and sent to the payment provider in the currency's smallest unit
// (pence, cents; whole yen for zero-decimal currencies). Prices are edited in normal units.

const digitsCache = new Map();

/** Number of decimal places a currency uses (GBP 2, JPY 0, KWD 3). */
export function currencyDigits(currency) {
  const code = currency.toUpperCase();
  if (!digitsCache.has(code)) {
    digitsCache.set(code, new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits);
  }
  return digitsCache.get(code);
}

export const toMinor = (amount, currency) => Math.round(amount * 10 ** currencyDigits(currency));
export const fromMinor = (minor, currency) => minor / 10 ** currencyDigits(currency);

export function formatMoney(minor, currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(fromMinor(minor, currency));
}
