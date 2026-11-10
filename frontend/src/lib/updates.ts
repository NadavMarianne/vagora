// Over-the-air updates, loaded as soon as the app opens (decision 0029).
// By default a new update downloads on one open and is used on the next. Here the app checks
// while it starts, and if an update arrives in time it reloads into it, so one open is enough.
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";

// How long opening may wait for an update. After that the app opens as it is, and a downloaded
// update is used on the next open (never a reload in the middle of using the app).
const WAIT_MS = 5000;

// Expo Go and the dev server have no over-the-air updates.
const enabled = Updates.isEnabled && !__DEV__;

/** True while the app is still checking for an update on opening. */
export function useCheckingForUpdate(): boolean {
  const [checking, setChecking] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let waited = false;
    const stopWaiting = () => {
      waited = true;
      setChecking(false);
    };
    const timer = setTimeout(stopWaiting, WAIT_MS);

    (async () => {
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) {
          const { isNew } = await Updates.fetchUpdateAsync();
          if (isNew && !waited) {
            await Updates.reloadAsync();
            return;
          }
        }
      } catch {
        // No internet or the update server is down: open the version we have.
      }
      clearTimeout(timer);
      stopWaiting();
    })();

    return () => clearTimeout(timer);
  }, []);

  return checking;
}
