// ==============================================================================
// Appointly Client — "Coming Soon" Page
// ==============================================================================
// Reference: Sprint 1 Contracts / Three-Sprint Plan — appointment screens are Sprint 2.
// Shown for navigation entries whose feature is planned but not built yet, so a
// menu item never leads to a blank page or to misleading content.
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';

export interface ComingSoonPageProps {
  title: string;
  description: string;
  /** Where the "Back" link goes. */
  backTo: string;
  backLabel: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ title, description, backTo, backLabel }) => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <CalendarClock className="w-6 h-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">Coming soon</h2>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      <Link
        to={backTo}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        {backLabel}
      </Link>
    </div>
  </div>
);

export default ComingSoonPage;
