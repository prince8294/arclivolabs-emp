import type { ButtonHTMLAttributes } from "react";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
};

export function Button({
  className = "",
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-accent text-white shadow-lg shadow-accent/15 hover:bg-violet-500",
    secondary: "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
    ghost: "text-slate-400 hover:bg-white/[0.06] hover:text-white",
  };
  const sizes = {
    default: "min-h-11 px-4 py-2.5 text-sm",
    sm: "min-h-9 px-3 py-2 text-sm",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
