import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-cyan-950 text-cyan-400 border-cyan-800",
    secondary: "border-transparent bg-slate-800 text-slate-200",
    destructive: "border-transparent bg-rose-950 text-rose-400 border-rose-800",
    outline: "text-slate-300 border-slate-800",
  };

  return (
    <div className={cn(base, variants[variant], className)} {...props} />
  );
}

export { Badge };
