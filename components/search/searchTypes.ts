export type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: "zap" | "file" | "layout";
  adminOnly: boolean;
};

export type SearchContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};
