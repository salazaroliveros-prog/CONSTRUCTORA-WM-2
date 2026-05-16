import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

console.error('App initialized');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Bound error:', error, errorInfo);
      }}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

