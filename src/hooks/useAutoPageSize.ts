import { useState, useEffect } from 'react';

/**
 * Calculates how many items fit in the available viewport height.
 * @param itemHeightPx  Approximate height of one item in pixels
 * @param reservedPx    Pixels reserved for header, toolbar, pagination, etc.
 * @param minItems      Minimum items per page (fallback)
 */
export function useAutoPageSize(
  itemHeightPx: number,
  reservedPx: number = 280,
  minItems: number = 4
): number {
  const [pageSize, setPageSize] = useState<number>(() => {
    const available = window.innerHeight - reservedPx;
    return Math.max(minItems, Math.floor(available / itemHeightPx));
  });

  useEffect(() => {
    const calc = () => {
      const available = window.innerHeight - reservedPx;
      setPageSize(Math.max(minItems, Math.floor(available / itemHeightPx)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [itemHeightPx, reservedPx, minItems]);

  return pageSize;
}
