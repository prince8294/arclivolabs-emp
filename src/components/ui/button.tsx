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
    primary: "border border-violet-300/20 bg-gradient-to-r from-[#8f72eb] to-[#a77ee7] text-white shadow-lg shadow-violet-950/30 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl hover:shadow-violet-950/35",
    secondary: "border border-white/10 bg-white/[0.035] text-slate-200 shadow-sm shadow-black/10 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.07]",
    ghost: "text-slate-400 hover:bg-white/[0.055] hover:text-white",
  };
  const sizes = {
    default: "min-h-11 px-4 py-2.5 text-sm",
    sm: "min-h-9 px-3 py-2 text-sm",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
