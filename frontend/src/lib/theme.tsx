// The look you picked, for every screen. Comes from your profile (saved on your account), and
// changing it in Settings redraws the whole app at once.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { type Profile, useSession } from "@/lib/session";
import { DEFAULT_THEME, type Theme, type ThemeId, themeById } from "@/lib/themes";

type ThemeContext = {
  theme: Theme;
  /** Switches the look now, and saves it on your account. */
  setTheme: (id: ThemeId) => Promise<void>;
};

const Context = createContext<ThemeContext>({
  theme: DEFAULT_THEME,
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { session, setProfile } = useSession();
  const saved = session.state === "ready" ? session.profile.theme : undefined;
  // A pick shows at once, before the backend has answered.
  const [picked, setPicked] = useState<ThemeId | null>(null);
  const theme = themeById(picked ?? saved);

  const setTheme = useCallback(
    async (id: ThemeId) => {
      setPicked(id);
      try {
        setProfile(await api<Profile>("/me", { method: "PATCH", body: { theme: id } }));
      } finally {
        setPicked(null);
      }
    },
    [setProfile],
  );

  return <Context value={{ theme, setTheme }}>{children}</Context>;
}

export function useTheme(): Theme {
  return useContext(Context).theme;
}

export function useSetTheme() {
  return useContext(Context).setTheme;
}

/** A component's styles, made from the current theme and remade only when it changes.
 * Write `makeStyles` outside the component: `const makeStyles = (t: Theme) => ({ ... })`. */
export function useStyles<T>(makeStyles: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => makeStyles(theme), [makeStyles, theme]);
}
