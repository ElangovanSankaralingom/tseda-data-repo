"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ConfirmationContextValue,
  ConfirmationDialogOptions,
  Toast,
  ToastOptions,
  ProgressNotification,
} from "@/lib/confirmations/types";
import ConfirmDialogUI from "./ConfirmDialog";
import ToastContainer from "./ToastContainer";
import ProgressOverlay from "./ProgressOverlay";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function useConfirmation(): ConfirmationContextValue {
  const ctx = useContext(ConfirmationContext);
  if (!ctx) throw new Error("useConfirmation must be used within ConfirmationProvider");
  return ctx;
}

// Convenience aliases
export function useToast() {
  const { toast, success, error, warning, info, loading, updateToast, dismissToast } = useConfirmation();
  return { toast, success, error, warning, info, loading, updateToast, dismissToast };
}

export function useConfirm() {
  return useConfirmation().confirm;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PendingConfirm = {
  options: ConfirmationDialogOptions;
  resolve: (value: boolean) => void;
};

const MAX_TOASTS = 5;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function ConfirmationProvider({ children }: { children: ReactNode }) {
  // --- Confirm dialog state ---
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // --- Toast state ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);

  // --- Progress state ---
  const [progresses, setProgresses] = useState<ProgressNotification[]>([]);

  // --- Undo timers ---
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // =========================================================================
  // Confirm
  // =========================================================================

  const confirm = useCallback(
    (options: ConfirmationDialogOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setPendingConfirm({ options, resolve });
      });
    },
    [],
  );

  const handleConfirmResult = useCallback((result: boolean) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(result);
      setPendingConfirm(null);
    }
  }, [pendingConfirm]);

  // =========================================================================
  // Toasts
  // =========================================================================

  const addToast = useCallback((options: ToastOptions): string => {
    const id = `toast-${++toastIdCounter.current}`;
    const newToast: Toast = { ...options, id, createdAt: Date.now() };
    setToasts((prev) => {
      const next = [newToast, ...prev];
      return next.slice(0, MAX_TOASTS);
    });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // Clean up any undo timer
    const timer = undoTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      undoTimers.current.delete(id);
    }
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastOptions>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  }, []);

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: "success", title, message, duration: 4000 }),
    [addToast],
  );

  const error = useCallback(
    (title: string, message?: string) => addToast({ type: "error", title, message, duration: 8000 }),
    [addToast],
  );

  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: "warning", title, message, duration: 6000 }),
    [addToast],
  );

  const info = useCallback(
    (title: string, message?: string) => addToast({ type: "info", title, message, duration: 4000 }),
    [addToast],
  );

  const loading = useCallback(
    (title: string, message?: string) => addToast({ type: "loading", title, message, duration: 0 }),
    [addToast],
  );

  // =========================================================================
  // Undo
  // =========================================================================

  const undoable = useCallback(
    (
      description: string,
      action: () => Promise<void>,
      undoFn: () => Promise<void>,
      timeout = 8000,
    ) => {
      let undone = false;
      const toastId = addToast({
        type: "undo",
        title: description,
        duration: timeout,
        dismissible: false,
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            const timer = undoTimers.current.get(toastId);
            if (timer) {
              clearTimeout(timer);
              undoTimers.current.delete(toastId);
            }
            dismissToast(toastId);
            void undoFn().then(() => {
              addToast({ type: "success", title: "Restored!", duration: 2000 });
            });
          },
        },
      });

      const timer = setTimeout(() => {
        undoTimers.current.delete(toastId);
        dismissToast(toastId);
        if (!undone) {
          void action();
        }
      }, timeout);
      undoTimers.current.set(toastId, timer);
    },
    [addToast, dismissToast],
  );

  // =========================================================================
  // Progress
  // =========================================================================

  const startProgress = useCallback((title: string): string => {
    const id = `progress-${++toastIdCounter.current}`;
    const prog: ProgressNotification = {
      id,
      title,
      status: "running",
      progress: 0,
      startedAt: Date.now(),
    };
    setProgresses((prev) => [...prev, prog]);
    return id;
  }, []);

  const updateProgress = useCallback((id: string, progress: number, message?: string) => {
    setProgresses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, progress, message } : p)),
    );
  }, []);

  const completeProgress = useCallback((id: string, summary: string) => {
    setProgresses((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "success" as const, progress: 100, completedAt: Date.now(), result: { summary } }
          : p,
      ),
    );
    setTimeout(() => {
      setProgresses((prev) => prev.filter((p) => p.id !== id));
    }, 3000);
  }, []);

  const failProgress = useCallback((id: string, errorMsg: string) => {
    setProgresses((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "error" as const, completedAt: Date.now(), result: { summary: errorMsg } }
          : p,
      ),
    );
    setTimeout(() => {
      setProgresses((prev) => prev.filter((p) => p.id !== id));
    }, 5000);
  }, []);

  // =========================================================================
  // Context value
  // =========================================================================

  const value = useMemo<ConfirmationContextValue>(
    () => ({
      confirm,
      toast: addToast,
      success,
      error,
      warning,
      info,
      loading,
      updateToast,
      dismissToast,
      undoable,
      startProgress,
      updateProgress,
      completeProgress,
      failProgress,
    }),
    [
      confirm,
      addToast,
      success,
      error,
      warning,
      info,
      loading,
      updateToast,
      dismissToast,
      undoable,
      startProgress,
      updateProgress,
      completeProgress,
      failProgress,
    ],
  );

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {pendingConfirm && (
        <ConfirmDialogUI
          options={pendingConfirm.options}
          onResult={handleConfirmResult}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {progresses.map((p) => (
        <ProgressOverlay key={p.id} progress={p} onDismiss={() => setProgresses((prev) => prev.filter((x) => x.id !== p.id))} />
      ))}
    </ConfirmationContext.Provider>
  );
}
