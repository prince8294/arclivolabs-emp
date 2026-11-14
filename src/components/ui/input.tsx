import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  trailing?: ReactNode;
};

export function Input({ label, error, id, className = "", trailing, ...props }: InputProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          className={`min-h-12 w-full rounded-xl border bg-[#111827] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-accent focus:ring-4 focus:ring-accent/10 ${
            error ? "border-rose-400/70" : "border-white/10"
          } ${trailing ? "pr-12" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          {...props}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
