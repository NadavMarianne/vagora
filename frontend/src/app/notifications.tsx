import { Alert, StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { Body, Button, Info, levelColors, Screen } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";
import { openPage } from "@/lib/open-page";
import type { AppNotification } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { useStyles, useTheme } from "@/lib/theme";

export default function NotificationsScreen() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const { list, unread, markRead, markAllRead, dismiss, dismissAll } = useNotifications();

  function open(notification: AppNotification) {
    markRead(notification.id);
    openPage(notification.path || "/");
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
        <View key={n.id} style={[styles.row, { borderLeftColor: levelColors(t, n.level)[0] }]}>
          <Tappable style={styles.text} onPress={() => open(n)} accessibilityRole="button">
            <View style={styles.titleLine}>
              {!n.read && (
                <View style={[styles.dot, { backgroundColor: levelColors(t, n.level)[0] }]} />
              )}
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    actions: { flexDirection: "row", gap: 12 },
    action: { flex: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingLeft: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      // Colored by how important it is: red, orange, green, or blue.
      borderLeftWidth: 4,
    },
    text: { flex: 1, gap: 2 },
    titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    message: { fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, flexShrink: 1 },
    unread: { fontFamily: t.fonts.bold },
    when: { fontFamily: t.fonts.regular, fontSize: 13, color: t.colors.muted },
    dismiss: { padding: 8 },
    dismissText: { fontFamily: t.fonts.regular, fontSize: 18, color: t.colors.muted },
  });
