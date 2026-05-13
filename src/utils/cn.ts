import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx + tailwind-merge, handling conflicts.
 * Extracted from duplicated inline definitions across components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}