// ==============================================================================
// Appointly Client — Toast / Alert Banner
// ==============================================================================
// Reference: System-Level SDS Section 4.3 (Toast / Alert Banner)
// - success: polite live region (role="status"), optionally auto-dismissed.
// - error:   assertive live region (role="alert"), stays until dismissed/replaced.
// ==============================================================================

import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface AlertBannerProps {
  variant: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
  /** Auto-dismiss after this many ms (requires onDismiss). Ignored when omitted. */
  autoDismissMs?: number;
  /** Optional action rendered after the message (e.g. a Retry button). */
  action?: React.ReactNode;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  variant,
  message,
  onDismiss,
  autoDismissMs,
  action,
}) => {
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss, message]);

  const isSuccess = variant === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`p-4 rounded-xl border flex items-start space-x-3 ${
        isSuccess
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 text-sm leading-relaxed">{message}</div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
