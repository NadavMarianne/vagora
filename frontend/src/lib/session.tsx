// Who is using the app, and which step they're at: logged out, email not verified yet,
// no vagora profile yet, or ready. The screens follow this (see src/app/_layout.tsx).
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";

export type Profile = { username: string; display_name: string };

export type Session =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "unverified"; user: User }
  | { state: "no-profile"; user: User }
  | { state: "ready"; user: User; profile: Profile }
  | { state: "error"; message: string };

type SessionContext = {
  session: Session;
  /** Checks again with Firebase and the backend, for example after verifying an email. */
  refresh: () => Promise<void>;
  /** Called after profile setup, so the app moves on without asking the backend again. */
  setProfile: (profile: Profile) => void;
};

const Context = createContext<SessionContext | null>(null);

async function lookUp(user: User | null): Promise<Session> {
  if (user === null) return { state: "signed-out" };
  if (!user.emailVerified) return { state: "unverified", user };
  try {
    const profile = await api<Profile>("/me");
    return { state: "ready", user, profile };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { state: "no-profile", user };
    if (error instanceof ApiError && error.status === 403) return { state: "unverified", user };
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return { state: "error", message };
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(
    () => onAuthStateChanged(auth, async (user) => setSession(await lookUp(user))),
    [],
  );

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      await user.reload();
      // A fresh token, so the backend sees a newly verified email.
      await user.getIdToken(true);
    }
    setSession(await lookUp(auth.currentUser));
  }, []);

  const setProfile = useCallback((profile: Profile) => {
    const user = auth.currentUser;
    if (user) setSession({ state: "ready", user, profile });
  }, []);

  return <Context value={{ session, refresh, setProfile }}>{children}</Context>;
}

export function useSession(): SessionContext {
  const context = useContext(Context);
  if (context === null) throw new Error("useSession must be used inside SessionProvider.");
  return context;
}
