// Your markets in the menu, in your order. Tap one to open it; drag its grip (⋮⋮) up or down to
// move it. The new order is saved on your account (see the menu).
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";
import type { Market } from "@/lib/types";

export function DraggableMarkets({
  markets,
  selectedId,
  onOpen,
  onReorder,
  onDragging,
}: {
  markets: Market[];
  /** The market you're in, highlighted. */
  selectedId: string | null;
  onOpen: (market: Market) => void;
  onReorder: (markets: Market[]) => void;
  /** Told when a drag starts and ends, so the menu stops scrolling while one is going on. */
  onDragging: (dragging: boolean) => void;
}) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const [order, setOrder] = useState(markets);
  const [dragged, setDragged] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragY] = useState(() => new Animated.Value(0));
  // A row's height, to know how far a drag has moved a market.
  const [rowHeight, setRowHeight] = useState(52);
  // The same values for the touch handlers, which run between renders.
  const live = useRef({
    order,
    rowHeight,
    dragged: null as number | null,
    hover: null as number | null,
  });
  useEffect(() => {
    live.current.order = order;
    live.current.rowHeight = rowHeight;
  }, [order, rowHeight]);

  // A fresh list from the backend, unless a drag is going on.
  useEffect(() => {
    // Take the new list from the backend (it may have changed elsewhere).
    if (live.current.dragged === null) setOrder(markets);
  }, [markets]);

  function grip(index: number) {
    const end = () => {
      const from = live.current.dragged;
      const to = live.current.hover;
      live.current.dragged = live.current.hover = null;
      setDragged(null);
      setHover(null);
      dragY.setValue(0);
      onDragging(false);
      if (from === null || to === null || from === to) return;
      const next = [...live.current.order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setOrder(next);
      onReorder(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        live.current.dragged = live.current.hover = index;
        setDragged(index);
        setHover(index);
        dragY.setValue(0);
        onDragging(true);
      },
      onPanResponderMove: (_, g) => {
        dragY.setValue(g.dy);
        const last = live.current.order.length - 1;
        const step = live.current.rowHeight;
        const target = Math.max(0, Math.min(last, index + Math.round(g.dy / step)));
        if (target !== live.current.hover) {
          live.current.hover = target;
          setHover(target);
        }
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }

  /** How far a row moves aside to make room for the one being dragged. */
  function shift(index: number): number {
    if (dragged === null || hover === null || index === dragged) return 0;
    if (dragged < index && index <= hover) return -rowHeight;
    if (hover <= index && index < dragged) return rowHeight;
    return 0;
  }

  return (
    <View>
      {/* The grips' touch handlers read the refs only during a drag, never while drawing. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {order.map((market, index) => {
        const isDragged = index === dragged;
        const selected = String(market.id) === selectedId;
        return (
          <Animated.View
            key={market.id}
            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              if (index === 0 && height !== rowHeight) setRowHeight(height);
            }}
            style={[
              styles.row,
              index > 0 && styles.line,
              selected && styles.selected,
              isDragged && styles.lifted,
              { transform: [{ translateY: isDragged ? dragY : shift(index) }] },
            ]}
          >
            <Tappable
              onPress={() => onOpen(market)}
              style={styles.open}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.name, selected && styles.selectedText]}>{market.name}</Text>
              <Text style={styles.detail}>
                {market.my_balance.toLocaleString()} {market.currency_name}
              </Text>
            </Tappable>
            {order.length > 1 && (
              <View
                {...grip(index).panHandlers}
                style={styles.grip}
                accessibilityLabel={`Drag to move ${market.name}`}
              >
                <Text style={[styles.gripText, { color: t.colors.muted }]}>⋮⋮</Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.background,
    },
    line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    // Where you are: a colored bar on the left and a tinted background.
    selected: {
      backgroundColor: t.colors.surfaceAlt,
      borderLeftWidth: 4,
      borderLeftColor: t.colors.primary,
    },
    // The row being dragged floats above the others.
    lifted: {
      zIndex: 10,
      elevation: 8,
      backgroundColor: t.colors.surface,
      boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)",
    },
    open: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 13,
      paddingLeft: 10,
      paddingRight: 4,
    },
    name: { fontSize: 16, fontFamily: t.fonts.bold, color: t.colors.text, flexShrink: 1 },
    selectedText: { color: t.colors.primary },
    detail: { fontSize: 13, fontFamily: t.fonts.regular, color: t.colors.muted },
    grip: { paddingHorizontal: 10, paddingVertical: 13 },
    gripText: { fontSize: 16, letterSpacing: -3 },
  });
