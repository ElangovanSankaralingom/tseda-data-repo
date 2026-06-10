"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Section name shown in the fallback UI */
  section?: string;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console — reportError() can't be imported here (server-only)
    console.error(`[ErrorBoundary${this.props.section ? `:${this.props.section}` : ""}]`, error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const section = this.props.section ?? "This section";

      return (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] p-6 text-center"
        >
          <AlertTriangle className="mx-auto size-8 text-[var(--color-status-error)]" />
          <h3 className="mt-3 text-sm font-medium text-[var(--color-status-error)]">
            {section} encountered an error
          </h3>
          <p className="mt-1 text-xs text-[var(--color-status-error)]">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-glass-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-error)] transition hover:bg-[var(--color-status-error-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-status-error-border)]"
          >
            <RefreshCw className="size-3" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
