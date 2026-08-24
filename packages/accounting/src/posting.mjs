import crypto from 'node:crypto';
import { validateJournal } from './journal.mjs';
export function canonicalPostingHash({ previousHash = '', journalId, organizationId, lines }) {
  const body = JSON.stringify({ previousHash, journalId, organizationId, lines: [...lines].map(l => ({ accountId:l.accountId, debit:String(l.debitMinor), credit:String(l.creditMinor) })) });
  return crypto.createHash('sha256').update(body).digest('hex');
}
export function assertPostableJournal(journal) {
  if (journal.status !== 'approved') throw new Error('JOURNAL_NOT_APPROVED');
  if (journal.periodStatus !== 'open') throw new Error('PERIOD_CLOSED');
  const result = validateJournal({ lines: journal.lines.map(l => ({ accountId:l.accountId, debit:l.debit, credit:l.credit })), scale: journal.scale ?? 2 });
  if (!result.valid) throw new Error(result.errors[0] ?? 'JOURNAL_INVALID');
  return result;
}
export function reversalLines(lines) { return lines.map(line => ({ ...line, debit: line.credit, credit: line.debit })); }
