import test from 'node:test'; import assert from 'node:assert/strict'; import { parseMoney, formatMoney, normalizeDigits } from '../src/money.mjs';
test('normalizes Arabic and Persian digits',()=>{ assert.equal(normalizeDigits('١٢٣۴۵'), '12345'); });
test('parses exact minor units',()=>{ assert.equal(parseMoney('١٬٢٣٤٫٥٠'),123450n); assert.equal(formatMoney(123450n),'1234.50'); });
test('rejects excess non-zero precision',()=>{ assert.throws(()=>parseMoney('1.001'),/MONEY_PRECISION_EXCEEDED/); });
