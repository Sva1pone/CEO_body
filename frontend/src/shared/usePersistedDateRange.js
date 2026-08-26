import { useCallback, useState } from "react";

export const DATE_RANGE_STORAGE_KEYS = {
  report: "ceo-body:range:report",
  statistics: "ceo-body:range:statistics",
  weightTrend: "ceo-body:range:weight-trend",
};

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidDateRange(range) {
  return (
    range !== null &&
    typeof range === "object" &&
    isValidDate(range.start) &&
    isValidDate(range.end) &&
    range.start <= range.end
  );
}

function readDateRange(storageKey, defaultRange) {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue === null) return defaultRange;

    const storedRange = JSON.parse(storedValue);
    if (isValidDateRange(storedRange)) return storedRange;

    window.localStorage.removeItem(storageKey);
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      return defaultRange;
    }
  }

  return defaultRange;
}

export function usePersistedDateRange(storageKey, createDefaultRange) {
  const [range, setRange] = useState(() =>
    readDateRange(storageKey, createDefaultRange()),
  );

  const saveRange = useCallback(
    (loadedRange) => {
      if (!isValidDateRange(loadedRange)) return false;

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(loadedRange));
      } catch {
        return false;
      }
      return true;
    },
    [storageKey],
  );

  return { range, setRange, saveRange };
}
