"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode; fallbackMessage?: string };
type State = { hasError: boolean; error: Error | null };

export default class FormErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-[var(--color-status-error)]" />
          <h3 className="text-base font-semibold text-[var(--color-status-error)]">
            {this.props.fallbackMessage || "Something went wrong loading this section."}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-status-error)]">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-status-error)] px-4 py-2 text-sm font-medium text-[var(--color-text-on-accent)] transition-colors hover:bg-[var(--color-status-error-strong)]"
          >
            <RefreshCw className="size-3.5" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
