import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../shared/layouts';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route
            index
            element={
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-slate-800">
                  Welcome to Appointly
                </h2>
                <p className="mt-2 text-slate-600">
                  Clinic Appointment & Scheduling Management System
                </p>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

