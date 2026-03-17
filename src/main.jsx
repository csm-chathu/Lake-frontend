import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ClinicSettingsProvider } from './context/ClinicSettingsContext.jsx';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <React.Suspense fallback={null}>
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ClinicSettingsProvider>
                <App />
              </ClinicSettingsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </React.StrictMode>
      </React.Suspense>
    </Router>
  </React.StrictMode>
);
