// ==============================================================================
// Appointly Server — Unit Tests: UTC ↔ Asia/Bangkok Conversion & Calendar Dates
// ==============================================================================
// Reference: Sprint 1 Contracts Section 3.1 (unit tier: "UTC ↔ Asia/Bangkok conversion
//            utilities"); SDS Sections 3.1, 5.1 & 8.2 (DEC-016)
// Instants are stored in UTC; the clinic works in Asia/Bangkok (UTC+7, no DST).
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  BANGKOK_TIMEZONE,
  CLINIC_TIMEZONE,
  bangkokToUtcDate,
  formatUtcToTimezone,
  isValidTimezone,
  parseBangkokToUtc,
  parseClinicCalendarDate,
  toBangkokDateString,
  toBangkokDateTimeString,
  toBangkokTimeString,
  utcToBangkokDate,
} from '../../../src/shared/utils/timezone';

describe('clinic timezone', () => {
  it('is Asia/Bangkok', () => {
    expect(CLINIC_TIMEZONE).toBe('Asia/Bangkok');
    expect(BANGKOK_TIMEZONE).toBe('Asia/Bangkok');
  });

  it.each(['Asia/Bangkok', 'UTC', 'America/New_York', 'Europe/London'])('%s is a valid IANA timezone', (tz) => {
    expect(isValidTimezone(tz)).toBe(true);
  });

  it.each(['Mars/Olympus', 'Bangkok', 'Invalid/Zone', '', 'UTC+7'])('%j is not', (tz) => {
    expect(isValidTimezone(tz)).toBe(false);
  });
});

describe('UTC -> Bangkok (+07:00)', () => {
  it('adds seven hours', () => {
    expect(formatUtcToTimezone('2026-11-14T10:00:00Z')).toBe('2026-11-14T17:00:00');
    expect(toBangkokTimeString('2026-11-14T10:30:15Z')).toBe('17:30:15');
    expect(toBangkokDateTimeString('2026-11-14T10:30:15Z')).toBe('2026-11-14 17:30:15');
  });

  it('crosses midnight exactly at 17:00 UTC', () => {
    expect(toBangkokDateString('2026-11-14T16:59:59Z')).toBe('2026-11-14');
    expect(toBangkokDateString('2026-11-14T17:00:00Z')).toBe('2026-11-15');
    expect(formatUtcToTimezone('2026-11-14T17:00:00Z')).toBe('2026-11-15T00:00:00');
  });

  it('rolls over month and year ends', () => {
    expect(toBangkokDateString('2026-12-31T17:00:00Z')).toBe('2027-01-01');
    expect(toBangkokDateString('2028-02-28T17:00:00Z')).toBe('2028-02-29'); // leap year
    expect(toBangkokDateString('2027-02-28T17:00:00Z')).toBe('2027-03-01');
  });

  it('accepts Date objects and other zones', () => {
    expect(toBangkokDateString(new Date('2026-11-14T17:00:00Z'))).toBe('2026-11-15');
    expect(formatUtcToTimezone('2026-11-14T10:00:00Z', 'UTC')).toBe('2026-11-14T10:00:00');
  });

  it('throws on an invalid instant', () => {
    expect(() => toBangkokDateString('not a date')).toThrow(/Invalid date/);
    expect(() => formatUtcToTimezone('')).toThrow();
  });
});

describe('Bangkok -> UTC', () => {
  it('turns a clinic-local date and time into the right UTC instant', () => {
    expect(parseBangkokToUtc('2026-11-15', '09:00').toISOString()).toBe('2026-11-15T02:00:00.000Z');
    expect(parseBangkokToUtc('2026-11-15', '09:30:45').toISOString()).toBe('2026-11-15T02:30:45.000Z');
    expect(parseBangkokToUtc('2026-11-15').toISOString()).toBe('2026-11-14T17:00:00.000Z'); // clinic midnight
  });

  it('round-trips with the formatter', () => {
    const utc = parseBangkokToUtc('2026-03-08', '23:45');
    expect(formatUtcToTimezone(utc)).toBe('2026-03-08T23:45:00');
  });

  it('throws on an impossible date or time', () => {
    expect(() => parseBangkokToUtc('2026-13-01')).toThrow(/Failed to parse/);
    expect(() => parseBangkokToUtc('2026-11-15', '25:00')).toThrow();
  });

  it('shift helpers are exact inverses', () => {
    const utc = new Date('2026-11-14T10:00:00Z');
    expect(utcToBangkokDate(utc).toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(bangkokToUtcDate(utcToBangkokDate(utc)).toISOString()).toBe(utc.toISOString());
  });
});

describe('parseClinicCalendarDate (a calendar DATE entered as text or as a timestamp)', () => {
  it.each([
    ['2099-12-25', '2099-12-25'],
    ['2099-12-25T01:00:00+07:00', '2099-12-25'], // Bangkok morning, still the 25th (UTC says the 24th)
    ['2099-12-24T18:00:00Z', '2099-12-25'], // = 01:00 on the 25th in Bangkok
    ['2099-12-25T16:59:59Z', '2099-12-25'], // 23:59:59 in Bangkok
    ['2099-12-25T17:00:00Z', '2099-12-26'], // midnight in Bangkok -> next day
    ['2096-02-29', '2096-02-29'], // leap day
  ])('%s -> %s', (input, expected) => {
    expect(parseClinicCalendarDate(input)).toBe(expected);
  });

  it('accepts a Date object', () => {
    expect(parseClinicCalendarDate(new Date('2099-12-24T18:00:00Z'))).toBe('2099-12-25');
  });

  it.each(['2099-02-30', '2099-13-01', '2099-00-10', '2099-04-31', '2097-02-29', 'tomorrow', '', '99999-01-01', '31/12/2099'])(
    'rejects %j instead of rolling it over to another day',
    (input) => {
      expect(parseClinicCalendarDate(input)).toBeNull();
    }
  );
});
