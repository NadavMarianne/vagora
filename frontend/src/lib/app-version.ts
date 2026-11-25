// When the backend says this app is too old (decision 0029): the whole app then shows "Please
// update" instead of its screens (see please-update.tsx).
import { useSyncExternalStore } from "react";

/** Set once the backend has said the app is too old: where to download the new APK, if known. */
type TooOld = { apkUrl: string | null };

let state: TooOld | null = null;
const listeners = new Set<() => void>();

/** The backend answered that this app is too old. */
export function tooOld(apkUrl: string | null) {
  if (state && state.apkUrl === apkUrl) return;
  state = { apkUrl };
  listeners.forEach((listener) => listener());
}

/** Whether the app is too old, and where its new version is. */
export function useTooOld(): TooOld | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
