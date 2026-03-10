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
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
        >
          <AlertTriangle className="mx-auto size-8 text-red-400" />
          <h3 className="mt-3 text-sm font-medium text-red-800">
            {section} encountered an error
          </h3>
          <p className="mt-1 text-xs text-red-600">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20"
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
