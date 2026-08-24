import { parseMoney } from './money.mjs';
export function validateJournal(input) {
  const errors = []; const lines = Array.isArray(input?.lines) ? input.lines : [];
  if (lines.length < 2) errors.push('JOURNAL_REQUIRES_TWO_LINES');
  let debit = 0n, credit = 0n;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? {}; if (!line.accountId) errors.push(`LINE_${i+1}_ACCOUNT_REQUIRED`);
    let dr, cr; try { dr = parseMoney(line.debit ?? '0', input?.scale ?? 2); } catch { errors.push(`LINE_${i+1}_INVALID_DEBIT`); dr = 0n; }
    try { cr = parseMoney(line.credit ?? '0', input?.scale ?? 2); } catch { errors.push(`LINE_${i+1}_INVALID_CREDIT`); cr = 0n; }
    if (dr < 0n || cr < 0n) errors.push(`LINE_${i+1}_NEGATIVE_AMOUNT`);
    if (dr > 0n && cr > 0n) errors.push(`LINE_${i+1}_BOTH_SIDES`);
    if (dr === 0n && cr === 0n) errors.push(`LINE_${i+1}_ZERO_LINE`);
    debit += dr; credit += cr;
  }
  if (debit !== credit) errors.push('JOURNAL_UNBALANCED');
  if (debit === 0n && credit === 0n) errors.push('JOURNAL_ZERO_TOTAL');
  return Object.freeze({ valid: errors.length === 0, debitMinor: debit, creditMinor: credit, errors: Object.freeze(errors) });
}
