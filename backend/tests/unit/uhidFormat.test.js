'use strict';
/** The standard patient UHID, SH-YY-NNNNNN, shared with the Consultant dashboard and the Physio app. */
const { uhidYear, uhidCounterKey, formatUhid, normalizeUhid } = require('../../src/modules/patients/uhidFormat');

describe('patient UHID format', () => {
  it('is SH, the 2-digit year and a 6-digit count', () => {
    expect(formatUhid('26', 123)).toBe('SH-26-000123');
    expect(formatUhid('26', 1)).toBe('SH-26-000001');
  });
  it('grows past 999999 instead of wrapping', () => {
    expect(formatUhid('26', 1000000)).toBe('SH-26-1000000');
  });
  it('takes the year in India time and keeps one counter per year', () => {
    expect(uhidYear(new Date('2026-12-31T17:00:00Z'))).toBe('26'); // 22:30 IST
    expect(uhidYear(new Date('2026-12-31T19:00:00Z'))).toBe('27'); // 00:30 IST, 1 Jan
    expect(uhidCounterKey('26')).toBe('uhid:26');
  });
  it('reads short and spaced forms of a UHID', () => {
    expect(normalizeUhid('sh26123')).toBe('SH-26-000123');
    expect(normalizeUhid(' sh-26-000123 ')).toBe('SH-26-000123');
    expect(normalizeUhid('UH-000123')).toBeNull();
    expect(normalizeUhid('')).toBeNull();
  });
});
