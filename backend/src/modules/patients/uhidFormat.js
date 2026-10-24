'use strict';
/**
 * THE patient UHID format, shared by the Consultant dashboard, the Physio app and the EMR:
 *
 *   SH-26-000123
 *   │  │  └── patient count for that year, 6 digits; grows by itself past 999999 (SH-26-1000000)
 *   │  └───── registration year, 2 digits, India time (a 31 Dec 11 pm registration is still that year)
 *   └──────── SMAART Healthcare
 *
 * The count restarts at 1 every year: one counter per year, `uhid:26`, `uhid:27`, … in the shared
 * `counters` collection. The same code lives in the Consultant backend (backend/utils/uhidFormat.js) and the
 * Physio app (backend/src/services/uhid.ts); change all three together.
 */
const UHID_TIME_ZONE = 'Asia/Kolkata';

/** '26' for a date in 2026 (India time). */
const uhidYear = (date = new Date()) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: UHID_TIME_ZONE, year: '2-digit' }).format(date);

const uhidCounterKey = (yy) => `uhid:${yy}`;

const formatUhid = (yy, n) => `SH-${yy}-${String(n).padStart(6, '0')}`;

/** Forgiving input → the canonical UHID: 'sh26123', 'SH 26 123', 'sh-26-000123' → 'SH-26-000123'. Null if not one. */
const normalizeUhid = (input) => {
  const m = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^SH(\d{2})(\d+)$/);
  return m ? formatUhid(m[1], Number(m[2])) : null;
};

/**
 * Extra Mongo $or terms so a UHID search also finds: a short form ('sh26123'), and a patient's OLD UHID
 * (UH-000123, SMAART-2026-1234, EMG-…) printed on earlier papers, kept in `previousUhids` by the conversion.
 */
const uhidSearchConditions = (q) => {
  const text = String(q || '').trim();
  if (!text) return [];
  const exact = normalizeUhid(text);
  const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return [{ previousUhids: rx }, ...(exact ? [{ uhid: exact }, { previousUhids: exact }] : [])];
};

module.exports = { UHID_TIME_ZONE, uhidYear, uhidCounterKey, formatUhid, normalizeUhid, uhidSearchConditions };
