import React, { ComponentType } from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback(this.state.error!);
    }
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center bg-surface rounded-2xl p-8">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-black text-red-400 mb-2 uppercase tracking-tight">
            Error al cargar la vista
          </h3>
          <p className="text-sm text-neutral-500 mb-4 text-center max-w-md">
            {this.state.error?.message || "Ocurrió un error inesperado"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Higher Order Component for wrapping with ErrorBoundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback?: (error: Error) => React.ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;