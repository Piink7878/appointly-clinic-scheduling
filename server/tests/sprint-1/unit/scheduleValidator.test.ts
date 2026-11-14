// ==============================================================================
// Appointly Server — Unit Tests: Schedule Window Validation (F-006, F-007)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6, 2.6 (AC-F006-02/03) & 3.1 (unit tier:
//            "schedule window overlap detection logic"); STS-S1-008
// The same validator guards the doctor's own schedule (F-006) and the administrator's
// override (F-007), so it is tested once, in isolation, here. No database, no HTTP.
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  isValidTimeFormat,
  parseTimeToSeconds,
  validateTimeWindow,
  doShiftsOverlap,
  validateShifts,
  validateException,
} from '../../../src/modules/schedules/scheduleValidator';
import { AppError } from '../../../src/shared/middleware/errorHandler';

describe('1. scheduleValidator Domain Validation Unit Tests', () => {
  describe('Time format validation (HH:mm or HH:mm:ss)', () => {
    it('accepts valid HH:mm and HH:mm:ss strings', () => {
      expect(isValidTimeFormat('09:00')).toBe(true);
      expect(isValidTimeFormat('09:00:00')).toBe(true);
      expect(isValidTimeFormat('00:00')).toBe(true);
      expect(isValidTimeFormat('23:59')).toBe(true);
      expect(isValidTimeFormat('23:59:59')).toBe(true);
      expect(isValidTimeFormat('13:30:15')).toBe(true);
    });

    it('rejects invalid time strings', () => {
      expect(isValidTimeFormat('24:00')).toBe(false);
      expect(isValidTimeFormat('25:00')).toBe(false);
      expect(isValidTimeFormat('12:60')).toBe(false);
      expect(isValidTimeFormat('9:00')).toBe(false);
      expect(isValidTimeFormat('invalid')).toBe(false);
      expect(isValidTimeFormat('')).toBe(false);
      expect(isValidTimeFormat('12:00:60')).toBe(false);
    });

    it('parseTimeToSeconds converts valid formats to seconds from midnight', () => {
      expect(parseTimeToSeconds('00:00')).toBe(0);
      expect(parseTimeToSeconds('01:00')).toBe(3600);
      expect(parseTimeToSeconds('09:30')).toBe(9 * 3600 + 30 * 60);
      expect(parseTimeToSeconds('09:30:15')).toBe(9 * 3600 + 30 * 60 + 15);
    });

    it('parseTimeToSeconds throws 422 INVALID_SCHEDULE_WINDOW on invalid format', () => {
      expect(() => parseTimeToSeconds('25:00')).toThrowError(AppError);
      try {
        parseTimeToSeconds('25:00');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });
  });

  describe('Window validation (startTime < endTime)', () => {
    it('passes when startTime < endTime', () => {
      expect(() => validateTimeWindow('09:00', '12:00')).not.toThrow();
      expect(() => validateTimeWindow('09:00:00', '12:00:00')).not.toThrow();
      expect(() => validateTimeWindow('00:00', '23:59')).not.toThrow();
    });

    it('rejects with 422 INVALID_SCHEDULE_WINDOW when startTime >= endTime (e.g. 14:00–10:00 or 10:00–10:00)', () => {
      expect(() => validateTimeWindow('14:00', '10:00')).toThrowError(AppError);
      try {
        validateTimeWindow('14:00', '10:00');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }

      try {
        validateTimeWindow('10:00', '10:00');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });
  });

  describe('Shift overlap detection (strict overlap vs back-to-back)', () => {
    it('permits back-to-back shifts: 09:00–12:00 and 12:00–15:00 do not overlap (returns false)', () => {
      const shift1 = { startTime: '09:00', endTime: '12:00' };
      const shift2 = { startTime: '12:00', endTime: '15:00' };
      expect(doShiftsOverlap(shift1, shift2)).toBe(false);
      expect(doShiftsOverlap(shift2, shift1)).toBe(false);
    });

    it('detects strict overlap: 09:00–13:00 and 12:00–16:00 overlap (returns true)', () => {
      const shift1 = { startTime: '09:00', endTime: '13:00' };
      const shift2 = { startTime: '12:00', endTime: '16:00' };
      expect(doShiftsOverlap(shift1, shift2)).toBe(true);
      expect(doShiftsOverlap(shift2, shift1)).toBe(true);
    });

    it('detects containment overlap: 09:00–17:00 and 10:00–14:00 overlap (returns true)', () => {
      const shift1 = { startTime: '09:00', endTime: '17:00' };
      const shift2 = { startTime: '10:00', endTime: '14:00' };
      expect(doShiftsOverlap(shift1, shift2)).toBe(true);
      expect(doShiftsOverlap(shift2, shift1)).toBe(true);
    });

    it('detects identical shift overlap: 09:00–12:00 and 09:00–12:00 overlap (returns true)', () => {
      const shift1 = { startTime: '09:00', endTime: '12:00' };
      const shift2 = { startTime: '09:00', endTime: '12:00' };
      expect(doShiftsOverlap(shift1, shift2)).toBe(true);
    });
  });

  describe('Multi-shift array validation (validateShifts)', () => {
    it('allows split shifts and back-to-back shifts across days', () => {
      const validShifts = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
        { dayOfWeek: 1, startTime: '12:00', endTime: '15:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
      ];
      expect(() => validateShifts(validShifts)).not.toThrow();
    });

    it('rejects overlapping shifts on the same day with 422 INVALID_SCHEDULE_WINDOW', () => {
      const overlappingShifts = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isActive: true },
        { dayOfWeek: 1, startTime: '12:00', endTime: '16:00', isActive: true },
      ];
      try {
        validateShifts(overlappingShifts);
        expect.fail('Should have thrown AppError 422');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });

    it('rejects inverted shift with 422 INVALID_SCHEDULE_WINDOW', () => {
      const invertedShifts = [
        { dayOfWeek: 1, startTime: '14:00', endTime: '10:00', isActive: true },
      ];
      try {
        validateShifts(invertedShifts);
        expect.fail('Should have thrown AppError 422');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });
  });

  describe('Exception validation (validateException)', () => {
    it('accepts full-day HOLIDAY exception with null startTime and endTime', () => {
      expect(() =>
        validateException({
          exceptionDate: '2026-12-25',
          exceptionType: 'HOLIDAY',
          startTime: null,
          endTime: null,
          reason: 'Christmas Holiday',
        })
      ).not.toThrow();
    });

    it('accepts partial-day exception with valid time window', () => {
      expect(() =>
        validateException({
          exceptionDate: '2026-12-26',
          exceptionType: 'BREAK',
          startTime: '12:00',
          endTime: '14:00',
          reason: 'Doctor Seminar',
        })
      ).not.toThrow();
    });

    it('rejects partial-day exception with inverted time window (422 INVALID_SCHEDULE_WINDOW)', () => {
      try {
        validateException({
          exceptionDate: '2026-12-26',
          exceptionType: 'BREAK',
          startTime: '14:00',
          endTime: '12:00',
        });
        expect.fail('Should have thrown 422');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });

    it('rejects partial-day exception when only startTime is provided', () => {
      try {
        validateException({
          exceptionDate: '2026-12-26',
          exceptionType: 'BREAK',
          startTime: '12:00',
          endTime: null,
        });
        expect.fail('Should have thrown 422');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
      }
    });
  });
});
