// frontend/src/hooks/useLocalStorage.ts
import { useState, useEffect, useCallback } from "react";

const STORAGE_EVENT_NAME = "local-storage-update";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));

          window.dispatchEvent(
            new CustomEvent(STORAGE_EVENT_NAME, { detail: { key } })
          );
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  useEffect(() => {
    const handleStorageChange = (event: any) => {
      if (event.detail?.key === key) {
        setStoredValue(readValue());
      }
    };

    window.addEventListener(STORAGE_EVENT_NAME, handleStorageChange);
    window.addEventListener("storage", (e) => {
      if (e.key === key) setStoredValue(readValue());
    });

    return () => {
      window.removeEventListener(STORAGE_EVENT_NAME, handleStorageChange);
      window.removeEventListener("storage", () => {});
    };
  }, [key, readValue]);

  return [storedValue, setValue];
}
