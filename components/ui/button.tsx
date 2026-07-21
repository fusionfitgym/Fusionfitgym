import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-cyan-600 text-white shadow hover:bg-cyan-500",
      destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-500",
      outline: "border border-slate-800 bg-slate-900 text-slate-200 shadow-sm hover:bg-slate-800 hover:text-white",
      secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
      ghost: "hover:bg-slate-800 hover:text-slate-100 text-slate-300",
      link: "text-cyan-400 underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
