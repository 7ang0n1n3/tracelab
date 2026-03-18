import { clsx } from "clsx";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const variants: Record<Variant, string> = {
  primary: "bg-accent hover:bg-accent-bright text-white",
  ghost: "text-muted hover:text-slate-200 hover:bg-bg-elevated",
  danger: "bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-700/40",
  outline: "border border-border text-slate-300 hover:bg-bg-elevated",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
