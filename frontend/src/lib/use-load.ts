// Loads data for a screen, again each time the screen comes back into view
// (for example after creating a market and returning to the list), and again at once whenever
// something changes for you while the screen is open (live updates, see live.tsx).
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { useLive } from "@/lib/live";

export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const { version } = useLive();
  const onScreen = useRef(false);

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
      onScreen.current = true;
      reload();
      return () => {
        onScreen.current = false;
      };
    }, [reload]),
  );

  // Something changed for you: reload if this screen is the one on display.
  // Screens behind it reload when they come back into view.
  useEffect(() => {
    if (version > 0 && onScreen.current) reload();
  }, [version, reload]);

  return { data, error, reload };
}
