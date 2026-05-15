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
        default: "bg-primary text-white shadow-md hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5",
        secondary: "bg-secondary text-primary shadow-md hover:bg-secondary-light hover:shadow-lg hover:-translate-y-0.5",
        ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        outline: "border border-neutral-200 bg-transparent hover:bg-neutral-50 hover:border-neutral-300",
        danger: "bg-error text-white shadow-md hover:bg-red-600 hover:shadow-lg",
        premium: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5",
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