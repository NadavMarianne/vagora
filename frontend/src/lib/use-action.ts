// Runs something a person tapped, and keeps its error next to it: each part of a page has its
// own `useAction`, so a mistake shows under the button that caused it, not somewhere else.
import { useState } from "react";

import { ApiError } from "@/lib/api";

/** A mistake the app spots before asking the backend, like a missing price. */
export class Mistake extends Error {}

export function useAction(after?: () => Promise<unknown> | void) {
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await after?.();
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof Mistake
          ? e.message
          : "Something went wrong. Try again.",
      );
    }
  }

  return { run, error };
}
