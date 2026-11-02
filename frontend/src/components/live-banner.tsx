// The pop-up at the top of the screen for live news, like "Dana invited you to Home".
// Tapping it opens the page the news is about. Swiping it sideways dismisses it, and it also
// goes away by itself after a few seconds.
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tappable } from "@/components/tappable";
import { colors } from "@/components/ui";
import { type Banner, useLive } from "@/lib/live";

const SHOW_FOR_MS = 5000;
// How far a swipe must go, or how fast, to dismiss the banner.
const SWIPE_DISTANCE = 100;
const SWIPE_SPEED = 0.5;

function open(banner: Banner) {
  if (banner.path) return router.navigate(banner.path as Href);
  // Older notes without a page: the market, or the home screen.
  const market = banner.reason.match(/^market:(\d+)$/);
  router.navigate(market ? `/markets/${market[1]}` : "/");
}

export function LiveBanner() {
  const { banner, dismissBanner } = useLive();
  const insets = useSafeAreaInsets();
  const [offset] = useState(() => new Animated.Value(0));

  // Each new banner starts in place.
  useEffect(() => {
    offset.setValue(0);
    if (!banner) return;
    const timer = setTimeout(dismissBanner, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [banner, dismissBanner, offset]);

  // Made once. dismissBanner never changes (see live.tsx), so it's safe to use inside.
  const [swipe] = useState(() =>
    PanResponder.create({
      // Only a sideways drag is a swipe, so a tap still opens the banner.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: offset }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_DISTANCE || Math.abs(g.vx) > SWIPE_SPEED) {
          Animated.timing(offset, {
            toValue: Math.sign(g.dx || g.vx) * 500,
            duration: 150,
            useNativeDriver: false,
          }).start(() => dismissBanner());
        } else {
          Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  );

  if (!banner) return null;
  return (
    <Animated.View
      {...swipe.panHandlers}
      style={[
        styles.banner,
        {
          top: insets.top + 8,
          transform: [{ translateX: offset }],
          opacity: offset.interpolate({
            inputRange: [-300, 0, 300],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          }),
        },
      ]}
    >
      <Tappable
        onPress={() => {
          dismissBanner();
          open(banner);
        }}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityHint="Opens it. Swipe sideways to dismiss."
      >
        <Text style={styles.text}>{banner.message}</Text>
        <Text style={styles.hint}>Tap to open · swipe to dismiss</Text>
      </Tappable>
    </Animated.View>
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
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { color: colors.background, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.background, fontSize: 13, opacity: 0.85, marginTop: 2 },
});
