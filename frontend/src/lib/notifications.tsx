// Your notifications list (backend/app/notifications.py): loaded when you log in, and again
// whenever something changes for you (live updates). On opening the app, anything new since you
// last looked gets a banner: the message itself, or "You have N new notifications".
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { LEVEL_RANK } from "@/components/ui";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";

type Notifications = {
  list: AppNotification[];
  unread: number;
  reload: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  dismissAll: () => Promise<void>;
};

const Context = createContext<Notifications | null>(null);

// The newest notification already seen on this phone, per person, so opening the app only
// announces what's new.
const seenKey = (uid: string) => `notifications-seen-until:${uid}`;

async function readSeen(uid: string): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(uid: string, list: AppNotification[]) {
  const newest = Math.max(0, ...list.map((n) => Date.parse(n.created_at)));
  AsyncStorage.setItem(seenKey(uid), String(newest)).catch(() => {});
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const uid = session.state === "ready" ? session.user.uid : null;
  const { version, showBanner } = useLive();
  const [list, setList] = useState<AppNotification[]>([]);
  // The first load after logging in is the one that announces what came while you were away.
  const opened = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      if (opened.current !== uid) {
        opened.current = uid;
        // Loading your markets first catches them up, which sends any news whose time came
        // while the app was closed (a missed deadline, for example).
        await api("/markets");
        const loaded = await api<AppNotification[]>("/notifications");
        const seen = await readSeen(uid);
        const fresh = loaded.filter((n) => !n.read && Date.parse(n.created_at) > seen);
        if (fresh.length === 1) {
          const [only] = fresh;
          showBanner({
            message: only.message,
            reason: "",
            path: only.path,
            id: only.id,
            level: only.level,
          });
        } else if (fresh.length > 1) {
          // Colored like the most important of them.
          const level = fresh
            .map((n) => n.level)
            .reduce((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a));
          showBanner({
            message: `You have ${fresh.length} new notifications`,
            reason: "",
            path: "/notifications",
            level,
          });
        }
        setList(loaded);
        writeSeen(uid, loaded);
        return;
      }
      const loaded = await api<AppNotification[]>("/notifications");
      setList(loaded);
      // While the app is open, news already came as live banners.
      writeSeen(uid, loaded);
    } catch {
      // The list catches up on the next change or when the app opens again.
    }
  }, [uid, showBanner]);

  // When you log in, and whenever something changes for you.
  useEffect(() => {
    if (!uid) {
      opened.current = null;
      return;
    }
    // Loads data from the backend and updates the list when it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [uid, version, reload]);

  const markRead = useCallback(async (id: number) => {
    setList((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await api(`/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setList((l) => l.map((n) => ({ ...n, read: true })));
    await api("/notifications/read-all", { method: "POST" }).catch(() => {});
  }, []);

  const dismiss = useCallback(async (id: number) => {
    setList((l) => l.filter((n) => n.id !== id));
    await api(`/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const dismissAll = useCallback(async () => {
    setList([]);
    await api("/notifications", { method: "DELETE" }).catch(() => {});
  }, []);

  const unread = list.filter((n) => !n.read).length;
  return (
    <Context value={{ list, unread, reload, markRead, markAllRead, dismiss, dismissAll }}>
      {children}
    </Context>
  );
}

export function useNotifications(): Notifications {
  const context = useContext(Context);
  if (!context) throw new Error("useNotifications must be used inside NotificationsProvider");
  return context;
}
