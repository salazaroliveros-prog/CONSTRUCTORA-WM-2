import React from "react";

/**
 * Utility: cn (classnames with tailwind-merge)
 * Combines conditional class names and merges Tailwind conflicts.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}