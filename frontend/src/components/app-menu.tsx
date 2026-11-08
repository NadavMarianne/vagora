// The ☰ menu, next to the bell in the top corner of every screen. It slides in from the side:
// Home at the top, then your markets (drag to reorder), then this market's pages (when you're in
// a market), with the page you're on highlighted. Settings and Log out stay at the bottom.
// Everything opens along its path (see open-page.ts), so back walks outward. Android's back
// closes the menu.
import { usePathname } from "expo-router";
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

import { DraggableMarkets } from "@/components/draggable-markets";
import { Tappable } from "@/components/tappable";
import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { useLive } from "@/lib/live";
import { openPage } from "@/lib/open-page";
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

function MenuPanel({ markets: known, onClose }: { markets: Market[]; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  // Your markets, in your order. A drag changes the order here at once, before it's saved.
  const [markets, setMarkets] = useState(known);
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

  const go = (href: string) => close(() => openPage(href));
  const [dragging, setDragging] = useState(false);
  // Which of this market's pages you're on, to highlight it.
  const on = (section: string) => path.startsWith(`/markets/${marketId}/${section}`);

  function saveOrder(next: Market[]) {
    setMarkets(next);
    knownMarkets = next;
    api("/markets/order", { method: "PUT", body: { market_ids: next.map((m) => m.id) } }).catch(
      () => setError("Couldn’t save the new order. Try again."),
    );
  }

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
              close(() => openPage("/"));
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
            }
          },
        },
      ],
    );
  }

  return (
    // Translucent bars: Android otherwise starts the panel below the status bar, and the
    // padding for it would count the status bar twice.
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
    >
      <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel="Close menu" />
      <Animated.View
        style={[
          styles.panel,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 12 },
          { transform: [{ translateX: slide }] },
        ]}
      >
        {/* Always at the top: home. */}
        <View style={styles.top}>
          <HomeIcon onPress={() => close(() => openPage("/"))} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          scrollEnabled={!dragging}
        >
          <Text style={styles.section}>Your markets</Text>
          <DraggableMarkets
            markets={markets}
            selectedId={marketId}
            onOpen={(m) => close(() => openPage(`/markets/${m.id}`))}
            onReorder={saveOrder}
            onDragging={setDragging}
          />
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
              <Item
                first
                title="Store"
                selected={on("store") || on("proposals")}
                onPress={() => go(`/markets/${marketId}/store`)}
              />
              <Item
                title="Orders"
                selected={on("orders")}
                onPress={() => go(`/markets/${marketId}/orders`)}
              />
              <Item
                title="Members"
                selected={on("members")}
                onPress={() => go(`/markets/${marketId}/members`)}
              />
              <Item
                title="Invite someone"
                selected={on("invite")}
                onPress={() => go(`/markets/${marketId}/invite`)}
              />
              <Item
                title="Market settings"
                selected={on("settings")}
                onPress={() => go(`/markets/${marketId}/settings`)}
              />
              <Item title="Leave market" danger onPress={leave} />
              {error !== "" && <Text style={styles.error}>{error}</Text>}
            </>
          )}
        </ScrollView>

        {/* Always at the bottom. */}
        <View style={styles.bottom}>
          <Item
            first
            title="Settings"
            selected={path === "/settings"}
            onPress={() => go("/settings")}
          />
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
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
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
  first,
  onPress,
}: {
  /** The first in its group: no thin line above it. */
  first?: boolean;
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
      style={[styles.item, !first && styles.itemLine, selected && styles.itemSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.itemText, danger && styles.danger, selected && styles.selectedText]}>
        {title}
      </Text>
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
    content: { paddingHorizontal: 16, paddingBottom: 16 },
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
      paddingVertical: 13,
      paddingHorizontal: 10,
    },
    // A thin line between buttons; sections get a thicker one (see `divider`).
    itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    // Where you are: a colored bar on the left and a tinted background.
    itemSelected: {
      backgroundColor: t.colors.surfaceAlt,
      borderLeftWidth: 4,
      borderLeftColor: t.colors.primary,
      paddingLeft: 6,
    },
    selectedText: { color: t.colors.primary },
    // The very top of the menu: home, as a wide bar across the menu, easy to press.
    top: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      marginBottom: 8,
      borderBottomWidth: 3,
      borderBottomColor: t.colors.border,
    },
    homeButton: {
      height: 52,
      borderRadius: t.radius.button,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
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
    divider: { height: 3, backgroundColor: t.colors.border, marginVertical: 12, borderRadius: 2 },
    bottom: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 3,
      borderTopColor: t.colors.border,
    },
  });
