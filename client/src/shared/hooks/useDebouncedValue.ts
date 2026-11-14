import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it has stopped changing for `delayMs`.
 * Used to avoid firing an API request on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
