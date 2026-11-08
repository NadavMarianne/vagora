// Your markets in the menu, in your order. Tap one to open it; drag its grip (six dots) up or down
// to move it. The drag runs on the phone's UI thread (gesture handler + Reanimated), so it stays
// smooth, and the rows it passes slide aside. The new order is saved on your account (see the menu).
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Tappable } from "@/components/tappable";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { Market } from "@/lib/types";

// Every row is this tall, so a position is simply a row number.
const ROW = 52;

/** Each market's row number, by its ID. */
type Positions = Record<number, number>;

const toPositions = (markets: Market[]): Positions =>
  Object.fromEntries(markets.map((m, index) => [m.id, index]));

export function DraggableMarkets({
  markets,
  selectedId,
  onOpen,
  onReorder,
}: {
  markets: Market[];
  /** The market you're in, highlighted. */
  selectedId: string | null;
  onOpen: (market: Market) => void;
  onReorder: (markets: Market[]) => void;
}) {
  const positions = useSharedValue<Positions>(toPositions(markets));

  // A fresh list from the backend (it may have changed elsewhere).
  useEffect(() => {
    positions.set(toPositions(markets));
  }, [markets, positions]);

  function dropped(final: Positions) {
    const next = [...markets].sort((a, b) => final[a.id] - final[b.id]);
    if (next.some((m, index) => m.id !== markets[index].id)) onReorder(next);
  }

  return (
    <View style={{ height: markets.length * ROW }}>
      {markets.map((market) => (
        <Row
          key={market.id}
          market={market}
          count={markets.length}
          positions={positions}
          selected={String(market.id) === selectedId}
          onOpen={() => onOpen(market)}
          onDrop={dropped}
        />
      ))}
    </View>
  );
}

function Row({
  market,
  count,
  positions,
  selected,
  onOpen,
  onDrop,
}: {
  market: Market;
  count: number;
  positions: SharedValue<Positions>;
  selected: boolean;
  onOpen: () => void;
  onDrop: (final: Positions) => void;
}) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const id = market.id;
  const top = useSharedValue((positions.get()[id] ?? 0) * ROW);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);

  // When another row takes this one's place, slide to the new place.
  useAnimatedReaction(
    () => positions.get()[id],
    (now, before) => {
      if (now !== before && now !== undefined && !dragging.get()) {
        top.set(withTiming(now * ROW, { duration: 160 }));
      }
    },
  );

  const drag = usePanGesture({
    minDistance: 0,
    onBegin: () => {
      "worklet";
      dragging.set(true);
      start.set(top.get());
    },
    onUpdate: (event) => {
      "worklet";
      const max = (count - 1) * ROW;
      top.set(Math.min(max, Math.max(0, start.get() + event.translationY)));
      // The row the finger is over now; the market there swaps into this one's old place.
      const to = Math.min(count - 1, Math.max(0, Math.round(top.get() / ROW)));
      const from = positions.get()[id];
      if (to !== from) {
        const next: Positions = { ...positions.get() };
        for (const key of Object.keys(next)) {
          if (next[Number(key)] === to) next[Number(key)] = from;
        }
        next[id] = to;
        positions.set(next);
      }
    },
    onFinalize: () => {
      "worklet";
      if (!dragging.get()) return;
      dragging.set(false);
      top.set(withTiming(positions.get()[id] * ROW, { duration: 160 }));
      scheduleOnRN(onDrop, positions.get());
    },
  });

  const placed = useAnimatedStyle(() => ({
    top: top.get(),
    zIndex: dragging.get() ? 10 : 0,
    elevation: dragging.get() ? 8 : 0,
    transform: [{ scale: withTiming(dragging.get() ? 1.03 : 1, { duration: 120 }) }],
  }));

  return (
    <Animated.View style={[styles.row, selected && styles.selected, placed]}>
      <Tappable
        onPress={onOpen}
        style={styles.open}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.name, selected && styles.selectedText]} numberOfLines={1}>
          {market.name}
        </Text>
        <Text style={styles.detail}>
          {market.my_balance.toLocaleString()} {market.currency_name}
        </Text>
      </Tappable>
      {count > 1 && (
        <GestureDetector gesture={drag}>
          <View style={styles.grip} accessibilityLabel={`Drag to move ${market.name}`}>
            {/* Six dots, in two columns of three. */}
            {[0, 1, 2].map((r) => (
              <View key={r} style={styles.dots}>
                <View style={[styles.dot, { backgroundColor: t.colors.muted }]} />
                <View style={[styles.dot, { backgroundColor: t.colors.muted }]} />
              </View>
            ))}
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      position: "absolute",
      left: 0,
      right: 0,
      height: ROW,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    // Where you are: a colored bar on the left and a tinted background.
    selected: {
      backgroundColor: t.colors.surfaceAlt,
      borderLeftWidth: 4,
      borderLeftColor: t.colors.primary,
    },
    open: {
      flex: 1,
      height: ROW,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingLeft: 10,
      paddingRight: 4,
    },
    name: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text, flexShrink: 1 },
    selectedText: { color: t.colors.primary },
    detail: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    grip: { height: ROW, paddingHorizontal: 14, justifyContent: "center", gap: 3 },
    dots: { flexDirection: "row", gap: 3 },
    dot: { width: 4, height: 4, borderRadius: 2 },
  });
