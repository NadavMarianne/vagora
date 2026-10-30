// The pop-up at the top of the screen for live news, like "Dana invited you to Home".
// Tapping it goes where the news is; it also goes away by itself after a few seconds.
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tappable } from "@/components/tappable";
import { colors } from "@/components/ui";
import { type Banner, useLive } from "@/lib/live";

const SHOW_FOR_MS = 5000;

function open(banner: Banner) {
  const market = banner.reason.match(/^market:(\d+)$/);
  if (market) router.navigate(`/markets/${market[1]}`);
  else router.navigate("/");
}

export function LiveBanner() {
  const { banner, dismissBanner } = useLive();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(dismissBanner, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [banner, dismissBanner]);

  if (!banner) return null;
  return (
    <Tappable
      style={[styles.banner, { top: insets.top + 8 }]}
      onPress={() => {
        dismissBanner();
        open(banner);
      }}
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{banner.message}</Text>
      <Text style={styles.hint}>Tap to open</Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    gap: 2,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { color: colors.background, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.background, fontSize: 13, opacity: 0.85 },
});
