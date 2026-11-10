// Over-the-air updates, forced as soon as they exist (decision 0029).
// By default a new update downloads on one open and is used on the next, and an app left in the
// background can stay old for days. Here the app checks when it opens and whenever it comes back
// to the screen, and if there is an update it shows "Updating" and reloads into it.
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

// How long to wait for the update server to answer, and for a download. If either takes longer
// (a bad connection), the app carries on as it is and tries again next time it comes back.
const CHECK_MS = 5000;
const DOWNLOAD_MS = 30000;

// Expo Go and the dev server have no over-the-air updates.
const enabled = Updates.isEnabled && !__DEV__;

export type UpdateState = "checking" | "updating" | "ready";

/** Rejects if the promise takes longer than `ms`. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

/** Checks for an update, and if there is one, downloads it and reloads the app into it. */
async function updateIfAvailable(onUpdating: () => void): Promise<void> {
  const { isAvailable } = await within(Updates.checkForUpdateAsync(), CHECK_MS);
  if (!isAvailable) return;
  onUpdating();
  const { isNew } = await within(Updates.fetchUpdateAsync(), DOWNLOAD_MS);
  if (isNew) await Updates.reloadAsync();
}

/** Whether the app is checking for an update, installing one, or ready to use. */
export function useUpdate(): UpdateState {
  const [state, setState] = useState<UpdateState>(enabled ? "checking" : "ready");

  useEffect(() => {
    if (!enabled) return;
    let busy = false;

    async function run() {
      if (busy) return;
      busy = true;
      try {
        await updateIfAvailable(() => setState("updating"));
      } catch {
        // No internet, or too slow: use the version we have and try again next time.
      }
      busy = false;
      setState("ready");
    }

    run();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });
    return () => subscription.remove();
  }, []);

  return state;
}
