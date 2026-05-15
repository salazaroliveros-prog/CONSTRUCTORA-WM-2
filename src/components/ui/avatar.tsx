import React, { useState } from "react";
import { cn } from "../../utils/cn";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
}

export function Avatar({
  className,
  src,
  alt,
  size = "md",
  fallback,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-14 w-14 text-lg",
  };

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-[var(--color-neutral-200)] ring-2 ring-[var(--color-surface-solid)]",
        sizes[size],
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--color-neutral-300)] text-[var(--color-neutral-600)] font-bold">
          {fallback || (alt?.charAt(0) || "?")}
        </div>
      )}
    </div>
  );
}