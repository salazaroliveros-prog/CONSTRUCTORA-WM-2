/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global Error Boundary component for React 19+.
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the entire application.
 */
import React, { Component, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Optional fallback UI to display when an error is caught. */
  fallback?: React.ReactNode;
  /** Callback invoked when an error is caught, useful for logging services. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Children components to wrap. */
  children: React.ReactNode;
}

/**
 * ErrorBoundary wraps the application and catches errors in the component tree.
 * Displays a graceful fallback UI and optionally reports errors to logging services.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Invoke optional callback for logging/observability
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-black text-red-400 uppercase tracking-tight mb-2">
              Error en la Aplicación
            </h1>
            <p className="text-sm text-slate-300 mb-4">
              Ha ocurrido un error inesperado. Por favor, recargue la página.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition-all active:scale-95"
            >
              Recargar Página
            </button>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo?.componentStack && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-slate-400 cursor-pointer uppercase tracking-widest">
                  Detalles del Error (Development)
                </summary>
                <pre className="mt-2 text-[10px] text-slate-500 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

