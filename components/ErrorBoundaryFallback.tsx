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
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-red-400" />
          <h3 className="text-base font-semibold text-red-400">
            {this.props.fallbackMessage || "Something went wrong loading this section."}
          </h3>
          <p className="mt-1 text-sm text-red-400">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
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
