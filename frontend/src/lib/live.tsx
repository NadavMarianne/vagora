// Live updates (decision 0020). The backend keeps one small note per person in Firestore,
// `signals/{uid}`, and rewrites it whenever something changes for them. This listens to the
// logged-in person's note: each change makes the open screens reload (see use-load.ts), and a
// note with a message shows a banner.
import {
  doc,
  type Firestore,
  getFirestore,
  initializeFirestore,
  onSnapshot,
} from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { app } from "@/lib/firebase";
import { useSession } from "@/lib/session";

function setUpFirestore(): Firestore {
  try {
    // Long polling instead of WebChannel streams, which React Native doesn't support well.
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    // Already set up (code reloads while developing).
    return getFirestore(app);
  }
}

const db = setUpFirestore();

/** A message to show, and what it's about: "invite", or "market:12" for a market. */
export type Banner = { message: string; reason: string };

type Live = {
  /** Goes up by one each time something changes for you. Screens reload when it does. */
  version: number;
  banner: Banner | null;
  dismissBanner: () => void;
};

const Context = createContext<Live>({ version: 0, banner: null, dismissBanner: () => {} });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const uid = session.state === "ready" ? session.user.uid : null;
  const [version, setVersion] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (!uid) return;
    let first = true;
    return onSnapshot(
      doc(db, "signals", uid),
      (snapshot) => {
        // The first reading is just the note as it already was, not a new change.
        if (first) {
          first = false;
          return;
        }
        setVersion((v) => v + 1);
        const { message, reason } = snapshot.data() ?? {};
        if (typeof message === "string" && message) {
          setBanner({ message, reason: typeof reason === "string" ? reason : "" });
        }
      },
      (error) => console.warn("Live updates stopped:", error.message),
    );
  }, [uid]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  return <Context value={{ version, banner, dismissBanner }}>{children}</Context>;
}

export function useLive(): Live {
  return useContext(Context);
}
