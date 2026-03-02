import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import AppRouter from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'border border-border bg-card text-foreground',
            success: {
              className: 'border border-green-300 bg-green-50 text-green-900',
            },
            error: {
              className: 'border border-red-300 bg-red-50 text-red-900',
            },
          }}
        />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
