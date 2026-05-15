import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../../utils/cn";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({
  children,
  content,
  side = "top",
  delay = 300,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => setShow(true), delay);
  }, [delay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles = {
    top: "top-full left-1/2 -translate-x-1/2 -mt-1",
    bottom: "bottom-full left-1/2 -translate-x-1/2 -mb-1 rotate-180",
    left: "left-full top-1/2 -translate-y-1/2 -ml-1 rotate-90",
    right: "right-full top-1/2 -translate-y-1/2 -mr-1 -rotate-90",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 px-2.5 py-1.5 text-[10px] font-bold text-[var(--color-neutral-50)] uppercase tracking-wider bg-[var(--color-neutral-900)] rounded-lg whitespace-nowrap",
            "transition-opacity duration-150 animate-fade-in-up",
            sideStyles[side]
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              "absolute w-2 h-2 bg-[var(--color-neutral-900)] rotate-45",
              arrowStyles[side]
            )}
          />
        </div>
      )}
    </div>
  );
}