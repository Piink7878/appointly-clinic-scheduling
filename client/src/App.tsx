// ==============================================================================
// Appointly Client — Root Application Entry
// ==============================================================================
// Reference: System-Level SDS Section 2.3 & Sprint 1 Contracts (F-001)
// Wraps the application tree with AuthProvider.
// ==============================================================================

import React from 'react';
import { AuthProvider } from './shared/context/AuthContext';
import { AppRouter } from './router';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};

export default App;
