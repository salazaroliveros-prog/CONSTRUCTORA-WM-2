import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-[1.02] shadow-lg",
        secondary: "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.6)] hover:-translate-y-0.5",
        ghost: "bg-transparent text-white/60 hover:bg-white/10 hover:text-white",
        outline: "border border-white/20 bg-transparent text-white hover:bg-white/10",
        danger: "bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/40",
        premium: "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg hover:scale-[1.02]",
      },
      size: {
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-10 px-4 py-2.5 text-sm",
        lg: "h-12 px-6 py-3 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  glowEffect?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, glowEffect, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          buttonVariants({ variant, size, className }),
          glowEffect && "shadow-lg hover:shadow-xl hover:shadow-secondary/25"
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };

