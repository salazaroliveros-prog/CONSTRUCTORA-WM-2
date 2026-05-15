import React from "react";
import { cn } from "../../utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient" | "dark";
  hoverable?: boolean;
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hoverable = false, asChild, ...props }, ref) => {
    const variants = {
      default: "bg-[var(--color-surface)] border-[var(--color-border)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-border-hover)]",
      glass: "bg-glass backdrop-blur-xl border-[var(--glass-border)] shadow-glass",
      gradient: "bg-gradient-to-br from-[var(--color-neutral-900)] via-[var(--color-neutral-800)] to-[var(--color-neutral-900)] border-[rgba(255,255,255,0.1)] shadow-xl",
      dark: "bg-surface-dark border-[rgba(255,255,255,0.05)] backdrop-blur-md shadow-2xl",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-3xl transition-all duration-500 ease-out",
          variants[variant],
          hoverable && "hover:-translate-y-1.5 cursor-pointer",
          className
        )}
        {...props}
      >
        {variant === "gradient" && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--color-secondary)_8%,transparent),transparent_70%)] pointer-events-none" />
        )}
        {props.children}
      </div>
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-bold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-[var(--color-neutral-500)]", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };