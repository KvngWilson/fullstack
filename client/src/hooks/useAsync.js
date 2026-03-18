/**
 * useAsync Hook
 * Handles async operations (loading, error, data states)
 *
 * Usage:
 * const { data, isLoading, error } = useAsync(
 *   () => fetchProducts(),
 *   [dependencyArray]
 * );
 */

import { useEffect, useState, useCallback } from "react";

export function useAsync(asyncFunction, immediate = true) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Execute the async function
  const execute = useCallback(async () => {
    setStatus("pending");
    setData(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setData(response);
      setStatus("success");
      return response;
    } catch (err) {
      setError(err);
      setStatus("error");
      throw err;
    }
  }, [asyncFunction]);

  // Call execute on component mount if immediate is true
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return {
    execute,
    status,
    isLoading: status === "pending",
    isSuccess: status === "success",
    isError: status === "error",
    data,
    error,
  };
}
