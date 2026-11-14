// ==============================================================================
// Appointly Client — Loading Skeleton
// ==============================================================================
// Reference: System-Level SDS Section 4.3 (Loading & Empty States, NFR-020)
// Purely decorative placeholder block; hidden from assistive technology.
// ==============================================================================

import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => (
  <div aria-hidden="true" data-testid="skeleton" className={`animate-pulse rounded bg-slate-200 ${className}`} />
);

export default Skeleton;
