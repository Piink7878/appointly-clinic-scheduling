// ==============================================================================
// Appointly Client — Status Badge
// ==============================================================================
// Reference: System-Level SDS Section 4.3 (Status Badge)
// ACTIVE -> green, INACTIVE -> gray. Unknown values fall back to neutral gray.
// ==============================================================================

import React from 'react';

export interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {isActive ? 'Active' : status === 'INACTIVE' ? 'Inactive' : status}
    </span>
  );
};

export default StatusBadge;
