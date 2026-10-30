// Loads data for a screen, again each time the screen comes back into view
// (for example after creating a market and returning to the list).
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ApiError } from "@/lib/api";

export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, reload };
}
