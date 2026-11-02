// The bell in the top corner of every screen. A blue dot means there's something unread.
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { colors } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Tappable
      onPress={() => router.navigate("/notifications")}
      style={styles.bell}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Text style={styles.icon}>🔔</Text>
      {unread > 0 && <View style={styles.dot} />}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  bell: { padding: 6 },
  icon: { fontSize: 20 },
  dot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
