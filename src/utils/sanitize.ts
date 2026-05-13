/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Input sanitization utilities for the ERP application.
 * Prevents XSS, injection attacks, and ensures data integrity.
 */

/**
 * Sanitizes a string by removing potentially dangerous HTML/script content.
 * @param input - The string to sanitize
 * @returns A sanitized string safe for display and storage
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  const str = String(input);
  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove event handlers
  sanitized = sanitized.replace(/\s*(on\w+)\s*=\s*["']?[\s\S]*?["']?/gi, '');
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:/gi, 'data-blocked:');
  // Remove HTML tags but preserve text content
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  // Trim and limit length
  sanitized = sanitized.trim().slice(0, 2000);
  return sanitized;
}

/**
 * Sanitizes a number input, returning a fallback value if invalid.
 * @param input - The value to sanitize as a number
 * @param fallback - Default value if parsing fails (default: 0)
 * @returns A valid number
 */
export function sanitizeNumber(input: unknown, fallback: number = 0): number {
  if (typeof input === 'number' && !isNaN(input) && isFinite(input)) {
    return Math.round(input * 100) / 100; // Round to 2 decimal places
  }
  const parsed = parseFloat(String(input));
  return isNaN(parsed) || !isFinite(parsed) ? fallback : Math.round(parsed * 100) / 100;
}

/**
 * Sanitizes an email address string.
 * @param email - The email to sanitize
 * @returns Sanitized email or empty string
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  const sanitized = sanitizeString(email).toLowerCase().trim();
  // Basic email format validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized) ? sanitized : '';
}

/**
 * Sanitizes a NIT (tax ID) string - allows alphanumeric with dashes.
 * @param nit - The NIT to sanitize
 * @returns Sanitized NIT
 */
export function sanitizeNIT(nit: string | undefined | null): string {
  if (!nit) return '';
  return sanitizeString(nit).replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 20);
}

/**
 * Sanitizes a phone number - allows digits, plus, spaces, dashes, parentheses.
 * @param phone - The phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return sanitizeString(phone).replace(/[^0-9+\-\s\(\)]/g, '').slice(0, 20);
}

/**
 * Truncates a string to a maximum length with an ellipsis.
 * @param input - The string to truncate
 * @param maxLength - Maximum character length (default: 255)
 * @returns Truncated string
 */
export function truncateString(input: string | undefined | null, maxLength: number = 255): string {
  if (!input) return '';
  const str = String(input);
  return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str;
}

/**
 * Validates a URL string.
 * @param url - The URL to validate
 * @returns True if valid URL
 */
export function isValidUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}