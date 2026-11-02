import { type Href, router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, colors, Info, Screen } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";
import type { AppNotification } from "@/lib/types";

export default function NotificationsScreen() {
  const { list, unread, markRead, markAllRead, dismiss, dismissAll } = useNotifications();

  function open(notification: AppNotification) {
    markRead(notification.id);
    router.navigate((notification.path || "/") as Href);
  }

  function clearAll() {
    Alert.alert("Dismiss all notifications?", "They’ll be removed from this list.", [
      { text: "Keep them", style: "cancel" },
      { text: "Dismiss all", style: "destructive", onPress: dismissAll },
    ]);
  }

  return (
    <Screen>
      <Info>
        Everything you were notified about, newest first, even what came while the app was closed.
        Tap one to open it.
      </Info>
      {list.length > 0 && (
        <View style={styles.actions}>
          {unread > 0 && (
            <View style={styles.action}>
              <Button title="Mark all as read" kind="secondary" onPress={markAllRead} />
            </View>
          )}
          <View style={styles.action}>
            <Button title="Dismiss all" kind="secondary" onPress={clearAll} />
          </View>
        </View>
      )}
      {list.length === 0 && <Body>No notifications.</Body>}
      {list.map((n) => (
        <View key={n.id} style={styles.row}>
          <Tappable style={styles.text} onPress={() => open(n)} accessibilityRole="button">
            <View style={styles.titleLine}>
              {!n.read && <View style={styles.dot} />}
              <Text style={[styles.message, !n.read && styles.unread]}>{n.message}</Text>
            </View>
            <Text style={styles.when}>{new Date(n.created_at).toLocaleString()}</Text>
          </Tappable>
          <Tappable
            onPress={() => dismiss(n.id)}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.dismissText}>✕</Text>
          </Tappable>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  message: { fontSize: 16, color: colors.text, flexShrink: 1 },
  unread: { fontWeight: "700" },
  when: { fontSize: 13, color: colors.muted },
  dismiss: { padding: 8 },
  dismissText: { fontSize: 18, color: colors.muted },
});
