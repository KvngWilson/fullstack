/**
 * Advanced Memoization & Performance Utilities
 * 
 * Provides utilities for optimizing component rendering and
 * function memoization to prevent unnecessary recalculations
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Deeply memoize object/array props for comparison
 * 
 * @param {any} value - Value to memoize
 * @param {Array} deps - Dependencies
 * @returns {any} Memoized value
 */
export function useDeepMemo(value, deps) {
  const ref = useRef(value);

  if (!deepEqual(ref.current, value)) {
    ref.current = value;
  }

  return useMemo(() => ref.current, [deps]);
}

/**
 * Simple deep equality check
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Debounced callback with automatic cleanup
 * 
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in ms
 * @param {Array} deps - Dependencies
 * @returns {Function} Debounced function
 */
export function useDebouncedCallback(callback, delay, deps = []) {
  const timeoutRef = useRef(null);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttled callback that limits execution frequency
 * 
 * @param {Function} callback - Function to throttle
 * @param {number} interval - Min interval between calls (ms)
 * @param {Array} deps - Dependencies
 * @returns {Function} Throttled function
 */
export function useThrottledCallback(callback, interval, deps = []) {
  const lastRunRef = useRef(Date.now());

  const throttledCallback = useCallback((...args) => {
    const now = Date.now();
    
    if (now - lastRunRef.current >= interval) {
      lastRunRef.current = now;
      callback(...args);
    }
  }, [callback, interval, ...deps]);

  return throttledCallback;
}

/**
 * Shallow equality check for objects/arrays
 */
export function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => a[key] === b[key]);
}

/**
 * Performance timing hook
 * Measures component render time in development
 * 
 * @param {string} componentName - Name for logging
 */
export function useRenderTime(componentName) {
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const renderTime = Date.now() - startTimeRef.current;
    
    if (import.meta.env.DEV) {
      if (renderTime > 16) { // > 1 frame (60fps)
        console.warn(`⚠️ Slow render [${componentName}]: ${renderTime}ms`);
      } else {
        console.debug(`✅ Fast render [${componentName}]: ${renderTime}ms`);
      }
    }
  });
}

/**
 * Long render tracking for expensive operations
 * 
 * @param {string} taskName - Name of the task
 * @param {Function} fn - Function to measure
 * @param {Array} deps - Dependencies
 */
export function useLongTask(taskName, fn, deps = []) {
  return useCallback(() => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (duration > 50) { // > 50ms is slow
      console.warn(`⚠️ Long task [${taskName}]: ${duration.toFixed(2)}ms`);
    }

    return result;
  }, [taskName, fn, ...deps]);
}

/**
 * Track component mount/unmount
 * Useful for debugging performance issues
 */
export function useComponentLifecycle(componentName) {
  useEffect(() => {
    console.debug(`➕ ${componentName} mounted`);
    
    return () => {
      console.debug(`➖ ${componentName} unmounted`);
    };
  }, [componentName]);
}

/**
 * Memoize expensive selector with dependencies
 * Prevents recalculation if dependencies unchanged
 */
export const useMemoizedSelector = (selector, deps = []) => {
  return useMemo(() => selector, deps);
};

/**
 * Track object identity changes
 * Warns if object recreated on each render
 */
export function useObjectIdentity(obj, name = 'object') {
  const prevRef = useRef(obj);
  
  useEffect(() => {
    if (prevRef.current !== obj) {
      console.warn(`⚠️ ${name} identity changed`);
      prevRef.current = obj;
    }
  }, [obj, name]);
}
