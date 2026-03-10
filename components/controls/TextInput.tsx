"use client";

import { cn } from "@/lib/utils";

type TextInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  error?: boolean;
};

export default function TextInput({ error, className, disabled, ...props }: TextInputProps) {
  return (
    <input
      type="text"
      className={cn(
        "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2",
        error
          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
          : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
        disabled && "pointer-events-none cursor-not-allowed opacity-60",
        "placeholder:text-slate-500",
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
