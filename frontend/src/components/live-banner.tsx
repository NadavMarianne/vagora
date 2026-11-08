// The pop-up at the top of the screen for live news, like "Dana invited you to Home".
// Tapping it opens the page the news is about. Swiping it sideways dismisses it, and it also
// goes away by itself after a few seconds.
import { useEffect, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tappable } from "@/components/tappable";
import { levelColors } from "@/components/ui";
import { type Banner, useLive } from "@/lib/live";
import { useNotifications } from "@/lib/notifications";
import { peekPage } from "@/lib/open-page";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

const SHOW_FOR_MS = 5000;
// How far a swipe must go, or how fast, to dismiss the banner.
const SWIPE_DISTANCE = 100;
const SWIPE_SPEED = 0.5;

function open(banner: Banner) {
  if (banner.path) return peekPage(banner.path);
  // Older notes without a page: the market, or the home screen.
  const market = banner.reason.match(/^market:(\d+)$/);
  peekPage(market ? `/markets/${market[1]}` : "/");
}

export function LiveBanner() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const { banner, dismissBanner } = useLive();
  const { markRead } = useNotifications();
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
          backgroundColor: levelColors(t, banner.level ?? "info")[0],
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
          if (banner.id) markRead(banner.id);
          open(banner);
        }}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityHint="Opens it. Swipe sideways to dismiss."
      >
        <Text style={[styles.text, { color: levelColors(t, banner.level ?? "info")[1] }]}>
          {banner.message}
        </Text>
        <Text style={[styles.hint, { color: levelColors(t, banner.level ?? "info")[1] }]}>
          Tap to open · swipe to dismiss
        </Text>
      </Tappable>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    banner: {
      position: "absolute",
      left: 12,
      right: 12,
      backgroundColor: t.colors.primary,
      borderRadius: 12,
      padding: 14,
      elevation: 6,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    text: { color: t.colors.background, fontSize: 16, fontFamily: t.fonts.bold },
    hint: {
      fontFamily: t.fonts.regular,
      color: t.colors.background,
      fontSize: 13,
      opacity: 0.85,
      marginTop: 2,
    },
  });
