import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against benign ResizeObserver loop limit notifications common in React Flow / chart layouts
if (typeof window !== 'undefined') {
  const isResizeObserverError = (msg: unknown) => {
    if (typeof msg === 'string') {
      return (
        msg.includes('ResizeObserver loop') ||
        msg.includes('undelivered notifications')
      );
    }
    return false;
  };

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isResizeObserverError(message) || (error && isResizeObserverError(error.message))) {
      return true; // Prevents the firing of the default event handler
    }
    if (prevOnError) {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener(
    'error',
    (e: ErrorEvent) => {
      if (isResizeObserverError(e.message) || isResizeObserverError(e.error?.message)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (e: PromiseRejectionEvent) => {
      if (isResizeObserverError(e.reason?.message)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
