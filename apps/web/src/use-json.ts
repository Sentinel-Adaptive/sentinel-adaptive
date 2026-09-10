import { useEffect, useState } from "react";

import { getJson } from "./api.js";

export function useJson<T>(
  path: string | undefined,
  refresh = 0,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError("Missing identifier");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getJson<T>(path)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, refresh]);

  return { data, error, loading };
}
