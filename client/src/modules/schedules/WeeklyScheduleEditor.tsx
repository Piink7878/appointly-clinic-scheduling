// ==============================================================================
// Appointly Client — Weekly Recurring Schedule Editor
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006); AC-F006-01/02/03; SDS 4.3
// Seven day cards (Sunday–Saturday). Each day holds any number of time slots, so
// split shifts (09:00–12:00 + 13:00–17:00) are just two slots. Pure presentation:
// the page owns the draft, validation and the PUT request.
// ==============================================================================

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  DAY_NAMES,
  type SlotDraft,
  type WeekDraft,
  type WeekErrors,
  newSlotKey,
  suggestSlot,
} from './validation';

export interface WeeklyScheduleEditorProps {
  week: WeekDraft;
  errors: WeekErrors;
  onChange: (next: WeekDraft) => void;
  disabled?: boolean;
}

const timeInputClass = (invalid: boolean) =>
  `block w-full px-2.5 py-2 border rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 disabled:opacity-60 ${
    invalid
      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
      : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
  }`;

export const WeeklyScheduleEditor: React.FC<WeeklyScheduleEditorProps> = ({
  week,
  errors,
  onChange,
  disabled = false,
}) => {
  const updateDay = (day: number, slots: SlotDraft[]) =>
    onChange(week.map((existing, i) => (i === day ? slots : existing)));

  const addSlot = (day: number) =>
    updateDay(day, [...week[day], { key: newSlotKey(), isActive: true, ...suggestSlot(week[day]) }]);

  const patchSlot = (day: number, key: string, patch: Partial<SlotDraft>) =>
    updateDay(
      day,
      week[day].map((slot) => (slot.key === key ? { ...slot, ...patch } : slot))
    );

  const removeSlot = (day: number, key: string) =>
    updateDay(
      day,
      week[day].filter((slot) => slot.key !== key)
    );

  return (
    <ul aria-label="Weekly schedule" className="space-y-3">
      {DAY_NAMES.map((dayName, day) => {
        const slots = week[day];
        return (
          <li key={dayName} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{dayName}</h3>
              <button
                type="button"
                onClick={() => addSlot(day)}
                disabled={disabled}
                aria-label={`Add time slot for ${dayName}`}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Add Time Slot
              </button>
            </div>

            {slots.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Day off — no working hours.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {slots.map((slot, index) => {
                  const error = errors.slots[slot.key];
                  const label = `${dayName} slot ${index + 1}`;
                  return (
                    <li key={slot.key}>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-28">
                          <label htmlFor={`${slot.key}-start`} className="block text-xs text-slate-500 mb-1">
                            Start
                          </label>
                          <input
                            id={`${slot.key}-start`}
                            type="time"
                            aria-label={`${label} start time`}
                            value={slot.startTime}
                            disabled={disabled}
                            onChange={(e) => patchSlot(day, slot.key, { startTime: e.target.value })}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? `${slot.key}-error` : undefined}
                            className={timeInputClass(Boolean(error))}
                          />
                        </div>
                        <div className="w-28">
                          <label htmlFor={`${slot.key}-end`} className="block text-xs text-slate-500 mb-1">
                            End
                          </label>
                          <input
                            id={`${slot.key}-end`}
                            type="time"
                            aria-label={`${label} end time`}
                            value={slot.endTime}
                            disabled={disabled}
                            onChange={(e) => patchSlot(day, slot.key, { endTime: e.target.value })}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? `${slot.key}-error` : undefined}
                            className={timeInputClass(Boolean(error))}
                          />
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 pb-2">
                          <input
                            type="checkbox"
                            checked={slot.isActive}
                            disabled={disabled}
                            onChange={(e) => patchSlot(day, slot.key, { isActive: e.target.checked })}
                            aria-label={`${label} active`}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => removeSlot(day, slot.key)}
                          disabled={disabled}
                          aria-label={`Remove ${label}`}
                          className="ml-auto inline-flex items-center px-2 py-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      {error && (
                        <p id={`${slot.key}-error`} className="mt-1 text-xs text-red-600">
                          {error}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default WeeklyScheduleEditor;
