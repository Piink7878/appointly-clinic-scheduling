// ==============================================================================
// Appointly Client — Modal Dialog
// ==============================================================================
// Reference: System-Level SDS Section 4.3 (Confirmation Modal), Section 2.3
// Accessible dialog: role="dialog" + aria-modal, labelled by its title,
// Escape / backdrop click to close, Tab focus trap, focus restored on close and
// background scroll locked while open. Rendered in a portal above the layout.
// On narrow screens the panel is full width and scrolls inside the viewport.
// ==============================================================================

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  /** Blocks every way of closing the dialog (e.g. while a request is in flight). */
  closeDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
  footer,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep the latest props reachable from the stable key handler below.
  const stateRef = useRef({ onClose, closeDisabled });
  stateRef.current = { onClose, closeDisabled };

  // Focus management + scroll lock (runs once per open dialog).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
    );
    (firstField ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!stateRef.current.closeDisabled) stateRef.current.onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;

    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        data-testid="modal-backdrop"
        className="absolute inset-0 bg-slate-900/50"
        onMouseDown={() => {
          if (!closeDisabled) onClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
