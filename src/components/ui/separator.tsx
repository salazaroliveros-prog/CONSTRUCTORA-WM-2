import React from "react";
import { cn } from "../../utils/cn";

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient?: boolean;
}

export function Separator({
  className,
  gradient = false,
  ...props
}: SeparatorProps) {
  return (
    <div
      className={cn(
        "my-4 h-px bg-border",
        gradient && "bg-linear-to-r from-transparent via-border to-transparent",
        className
      )}
      {...props}
    />
  );
}

