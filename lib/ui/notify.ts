export type UiToast = {
  type: "ok" | "err";
  msg: string;
};

export type UiToastSetter = (toast: UiToast | null) => void;
