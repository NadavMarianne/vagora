// The bell in the top corner of every screen, a line drawing in the theme's colors. A dot means
// there's something unread.
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Tappable } from "@/components/tappable";
import { useNotifications } from "@/lib/notifications";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

export function NotificationBell() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const { unread } = useNotifications();
  return (
    <Tappable
      onPress={() => router.navigate("/notifications")}
      style={styles.bell}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
          stroke={t.colors.text}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
          stroke={t.colors.text}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {unread > 0 && <View style={styles.dot} />}
    </Tappable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    bell: { padding: 7 },
    dot: {
      position: "absolute",
      top: 5,
      right: 6,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: t.colors.primary,
      borderWidth: 2,
      borderColor: t.colors.background,
    },
  });
