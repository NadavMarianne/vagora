// The ☰ menu, next to the bell in the top corner of every screen. It slides in from the side:
// Home at the top, then your markets, then this market's members, invites, settings, and leaving
// (when you're in a market). Settings and Log out stay at the bottom. Android's back closes it.
import { type Href, router, usePathname } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Tappable } from "@/components/tappable";
import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { useLive } from "@/lib/live";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { Market } from "@/lib/types";

const PANEL_WIDTH = 300;

/** The market you're in, from the page's address ("/markets/12/..."), or null. */
function currentMarketId(path: string): string | null {
  return path.match(/^\/markets\/(\d+)/)?.[1] ?? null;
}

// Your markets, kept between screens so the menu is complete the moment it opens.
let knownMarkets: Market[] = [];

/** Your markets: what's already known at once, refreshed in the background, and again whenever
 * something changes for you. */
function useMyMarkets(): Market[] {
  const { version } = useLive();
  const [markets, setMarkets] = useState(knownMarkets);
  useEffect(() => {
    let current = true;
    api<Market[]>("/markets")
      .then((loaded) => {
        knownMarkets = loaded;
        if (current) setMarkets(loaded);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [version]);
  return markets;
}

export function MenuButton() {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const markets = useMyMarkets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tappable
        onPress={() => setOpen(true)}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Menu"
      >
        <View style={styles.bars}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.bar, { backgroundColor: t.colors.text }]} />
          ))}
        </View>
      </Tappable>
      {open && <MenuPanel markets={markets} onClose={() => setOpen(false)} />}
    </>
  );
}

function MenuPanel({ markets, onClose }: { markets: Market[]; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const marketId = currentMarketId(path);
  const [error, setError] = useState("");
  const [slide] = useState(() => new Animated.Value(PANEL_WIDTH));

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  }, [slide]);

  const market = markets.find((m) => String(m.id) === marketId);

  function close(then?: () => void) {
    Animated.timing(slide, { toValue: PANEL_WIDTH, duration: 150, useNativeDriver: true }).start(
      () => {
        onClose();
        then?.();
      },
    );
  }

  const go = (href: string) => close(() => router.push(href as Href));

  function leave() {
    Alert.alert(
      "Leave this market?",
      "Your coins stay frozen here. You can rejoin yourself within 30 days and get them back. Your offers without a commitment are removed, and invites you sent are cancelled.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setError("");
            try {
              await api(`/markets/${marketId}/leave`, { method: "POST" });
              close(() => router.replace("/"));
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
            }
          },
        },
      ],
    );
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()}>
      <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel="Close menu" />
      <Animated.View
        style={[
          styles.panel,
          { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateX: slide }] },
        ]}
      >
        {/* Always at the top: home. */}
        <View style={styles.top}>
          <HomeIcon onPress={() => close(() => router.navigate("/"))} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.section}>Your markets</Text>
          {markets.map((m) => (
            <Item
              key={m.id}
              title={m.name}
              detail={`${m.my_balance.toLocaleString()} ${m.currency_name}`}
              selected={String(m.id) === marketId}
              onPress={() => close(() => router.navigate(`/markets/${m.id}`))}
            />
          ))}
          <View style={styles.halfDivider} />
          <Tappable
            onPress={() => go("/markets/new")}
            style={styles.create}
            accessibilityRole="button"
          >
            <Text style={styles.createText}>Create a market</Text>
          </Tappable>

          {marketId && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>{market ? market.name : "This market"}</Text>
              <Item title="Members" onPress={() => go(`/markets/${marketId}/members`)} />
              <Item title="Invite someone" onPress={() => go(`/markets/${marketId}/invite`)} />
              <Item title="Market settings" onPress={() => go(`/markets/${marketId}/settings`)} />
              <Item title="Leave market" danger onPress={leave} />
              {error !== "" && <Text style={styles.error}>{error}</Text>}
            </>
          )}
        </ScrollView>

        {/* Always at the bottom. */}
        <View style={styles.bottom}>
          <Item title="Settings" selected={path === "/settings"} onPress={() => go("/settings")} />
          <Item title="Log out" danger onPress={() => close(() => signOut(auth))} />
        </View>
      </Animated.View>
    </Modal>
  );
}

/** A line drawing of a house, in the theme's colors. */
function HomeIcon({ onPress }: { onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const line = {
    stroke: t.colors.text,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Tappable
      onPress={onPress}
      style={styles.homeButton}
      accessibilityRole="button"
      accessibilityLabel="Home"
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Path d="M3 10.5 12 3l9 7.5" {...line} />
        <Path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" {...line} />
      </Svg>
    </Tappable>
  );
}

function Item({
  title,
  detail,
  selected,
  danger,
  onPress,
}: {
  title: string;
  detail?: string;
  selected?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Tappable
      onPress={onPress}
      style={[styles.item, selected && styles.itemSelected]}
      accessibilityRole="button"
    >
      <Text style={[styles.itemText, danger && styles.danger]}>{title}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
    </Tappable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    button: { padding: 8, marginLeft: 4 },
    bars: { width: 20, gap: 4 },
    bar: { height: 2.5, borderRadius: 2 },
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
    },
    panel: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: PANEL_WIDTH,
      backgroundColor: t.colors.background,
      borderLeftWidth: t.borderWidth,
      borderLeftColor: t.colors.border,
    },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, gap: 4, paddingBottom: 16 },
    section: {
      fontSize: 13,
      fontFamily: t.fonts.accent,
      color: t.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 4,
      marginBottom: 4,
      paddingHorizontal: 8,
    },
    item: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: t.radius.button,
    },
    itemSelected: { backgroundColor: t.colors.surfaceAlt },
    top: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingBottom: 8,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    homeButton: { padding: 8 },
    itemText: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text, flexShrink: 1 },
    detail: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    danger: { color: t.colors.bad },
    // Create a market: set a little apart, and drawn as a dashed outline rather than a row.
    halfDivider: {
      height: 1,
      backgroundColor: t.colors.border,
      marginVertical: 6,
      marginHorizontal: 8,
      width: "45%",
    },
    create: {
      marginTop: 2,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: t.radius.button,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: t.colors.primary,
      alignItems: "center",
    },
    createText: { fontSize: 15, fontFamily: t.fonts.bold, color: t.colors.primary },
    error: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.error, paddingHorizontal: 8 },
    divider: { height: 1, backgroundColor: t.colors.border, marginVertical: 10 },
    bottom: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      gap: 2,
    },
  });
