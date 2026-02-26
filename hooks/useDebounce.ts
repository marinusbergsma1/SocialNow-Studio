
import { useRef, useCallback } from 'react';

/**
 * Returns a debounced version of the provided callback.
 * The callback will only execute after `delay` ms of inactivity.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    return useCallback(
        ((...args: any[]) => {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => callback(...args), delay);
        }) as any,
        [callback, delay]
    );
}
