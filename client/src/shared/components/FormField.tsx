// ==============================================================================
// Appointly Client — Form Field
// ==============================================================================
// Reference: System-Level SDS Section 4.3 (inline validation feedback, NFR-020)
// Label + control + inline error / hint, wired with aria-describedby. The
// required marker sits outside the <label> so the accessible name stays clean.
// ==============================================================================

import React from 'react';

export const fieldInputClass = (invalid: boolean, readOnly = false): string =>
  `block w-full px-3 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
    invalid
      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
      : 'border-slate-300 focus:ring-amber-500 focus:border-amber-500'
  } ${readOnly ? 'bg-slate-50 text-slate-500' : 'bg-white'}`;

export interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Receives the id to use for `aria-describedby` (undefined when there is nothing to describe). */
  children: (describedBy: string | undefined) => React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ id, label, error, hint, required, children }) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {required && (
          <span className="text-red-500 text-sm" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {children(describedBy)}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default FormField;
