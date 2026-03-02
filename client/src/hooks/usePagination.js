/**
 * usePagination Hook
 * Manages pagination state and navigation
 * 
 * Usage:
 * const { currentPage, totalPages, goToPage, nextPage, prevPage } = usePagination(
 *   { total: 100, perPage: 10 }
 * );
 */

import { useState, useCallback } from 'react';

export function usePagination({ total = 0, perPage = 10 } = {}) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(total / perPage);

  const goToPage = useCallback(
    (page) => {
      const pageNum = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(pageNum);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    totalPages,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    goToPage,
    nextPage,
    prevPage,
    reset,
    offset: (currentPage - 1) * perPage,
    limit: perPage,
  };
}
