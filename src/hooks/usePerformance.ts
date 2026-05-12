// src/hooks/usePerformance.ts

import { useCallback } from 'react';
import { getPerformanceData, PerformanceData } from '../lib/performanceLib';

/**
 * Hook to access performance data for budget lines.
 * Provides a function to get performance data by code.
 */
export function usePerformance() {
  const getData = useCallback((code: string): PerformanceData => {
    return getPerformanceData(code);
  }, []);

  return { getData };
}
