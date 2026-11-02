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

// setTimeout can't wait longer than about 24 days.
const LONGEST_WAIT_MS = 2 ** 31 - 1;

/** Reloads when the next of these moments comes, like a deadline running out, so the screen
 * shows what happened without anyone touching it. */
export function useReloadAt(moments: (string | null | undefined)[], reload: () => void) {
  // One string, so the effect only restarts when the moments really change.
  const key = moments.filter(Boolean).join("|");
  useEffect(() => {
    const now = Date.now();
    const next = key
      .split("|")
      .filter(Boolean)
      .map((m) => Date.parse(m))
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    // A second late, so the backend sees the time as passed.
    const timer = setTimeout(reload, Math.min(next - now + 1000, LONGEST_WAIT_MS));
    return () => clearTimeout(timer);
  }, [key, reload]);
}
