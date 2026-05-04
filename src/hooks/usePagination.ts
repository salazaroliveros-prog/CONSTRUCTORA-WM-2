import { useState, useMemo } from 'react';

interface PaginationResult<T> {
  currentItems: T[];
  currentPage: number;
  totalPages: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  itemsPerPage: number;
  startIndex: number;
  totalItems: number;
}

export function usePagination<T>(items: T[], itemsPerPage: number = 8): PaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  // Reset to page 1 if current page is out of bounds (after filtering for example)
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const currentItems = useMemo(() => {
    const begin = (currentPage - 1) * itemsPerPage;
    const end = begin + itemsPerPage;
    return items.slice(begin, end);
  }, [items, currentPage, itemsPerPage]);

  const nextPage = () => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  };

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    currentItems,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    itemsPerPage,
    startIndex: (currentPage - 1) * itemsPerPage,
    totalItems: items.length
  };
}
