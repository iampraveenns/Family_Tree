import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in UI component tree:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleNavigateHome = (): void => {
    window.location.href = '/family/tree';
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          id="error-boundary-container"
          role="alert"
          aria-live="assertive"
          className="min-h-[400px] flex items-center justify-center p-6 bg-amber-50/50 rounded-2xl border border-amber-200 m-4"
        >
          <div className="max-w-md text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {this.props.fallbackTitle || 'Something interrupted this heritage view'}
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {this.props.fallbackMessage ||
                'An unexpected rendering issue occurred. Your family data remains securely preserved in the database.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                id="btn-error-retry"
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
              <button
                id="btn-error-home"
                type="button"
                onClick={this.handleNavigateHome}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 cursor-pointer"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Return to Family Tree
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
