import { logError, toUserMessage } from "@/lib/errors";

export type UiToast = {
  type: "ok" | "err";
  msg: string;
};

export type UiToastSetter = (toast: UiToast | null) => void;

export function notifySuccess(message: string, setToast?: UiToastSetter, clearAfterMs = 2200): UiToast {
  const toast: UiToast = { type: "ok", msg: message };
  if (setToast) {
    setToast(toast);
    if (clearAfterMs > 0) {
      setTimeout(() => setToast(null), clearAfterMs);
    }
  }
  return toast;
}

export function notifyError(errorOrMessage: unknown, setToast?: UiToastSetter, clearAfterMs = 2600): UiToast {
  const normalized = logError(errorOrMessage, "notify");
  const toast: UiToast = { type: "err", msg: toUserMessage(normalized) };

  if (setToast) {
    setToast(toast);
    if (clearAfterMs > 0) {
      setTimeout(() => setToast(null), clearAfterMs);
    }
  }

  return toast;
}
