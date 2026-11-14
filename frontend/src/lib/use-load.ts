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
// After a moment passes with nothing changed: try again this often, this many times.
const RETRY_MS = 2000;
const RETRIES = 5;

/** Reloads when the next of these moments comes, like a deadline running out, so the screen
 * shows what happened without anyone touching it. */
export function useReloadAt(moments: (string | null | undefined)[], reload: () => void) {
  // One string, so the effect only restarts when the moments really change.
  const key = moments.filter(Boolean).join("|");
  // Reloads since the moments last changed. A phone's clock can run a little ahead of the
  // backend's, so a reload can come too early; then it tries again a few times.
  const [reloads, setReloads] = useState({ key, count: 0 });
  const tries = reloads.key === key ? reloads.count : 0;
  useEffect(() => {
    const now = Date.now();
    const times = key
      .split("|")
      .filter(Boolean)
      .map((m) => Date.parse(m));
    const next = times.filter((t) => t > now).sort((a, b) => a - b)[0];
    // Only one that just passed: older ones were reloaded for long ago.
    const passed = times.some((t) => t <= now && now - t < RETRY_MS * (RETRIES + 2));
    let wait: number;
    if (passed && tries < RETRIES) wait = RETRY_MS;
    else if (next !== undefined) wait = Math.min(next - now + 1000, LONGEST_WAIT_MS);
    else return;
    // A second late, so the backend sees the time as passed.
    const timer = setTimeout(() => {
      reload();
      setReloads((r) => ({ key, count: (r.key === key ? r.count : 0) + 1 }));
    }, wait);
    return () => clearTimeout(timer);
  }, [key, reload, tries]);
}
