const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function normalizeDigits(value) {
  return String(value ?? '').replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d))).replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d))).replace(/[\u200e\u200f\u061c]/g, '').trim();
}
export function parseMoney(value, scale = 2) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) throw new Error('INVALID_SCALE');
  let s = normalizeDigits(value).replace(/\s/g, '').replace(/٬/g, ',').replace(/٫/g, '.').replace(/,/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) throw new Error('INVALID_MONEY');
  const negative = s.startsWith('-'); s = s.replace(/^[+-]/, '');
  const [whole, fraction = ''] = s.split('.');
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) throw new Error('MONEY_PRECISION_EXCEEDED');
  const padded = (fraction.slice(0, scale) + '0'.repeat(scale)).slice(0, scale);
  const minor = BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded || '0');
  return negative ? -minor : minor;
}
export function formatMoney(minor, scale = 2) {
  if (typeof minor !== 'bigint') throw new Error('MONEY_MUST_BE_BIGINT');
  const neg = minor < 0n; const n = neg ? -minor : minor; const base = 10n ** BigInt(scale);
  const whole = n / base; const frac = (n % base).toString().padStart(scale, '0');
  return `${neg ? '-' : ''}${whole}${scale ? '.' + frac : ''}`;
}
