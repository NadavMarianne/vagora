// Picks an amount of chips with a slider: shortcut buttons above it (like half the pot), and a
// button at its end for the most (like all-in). Sliding all the way, or pressing that button,
// moves the slider to the end and makes the button shine.
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { Tappable } from "@/components/tappable";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

/** The table's own colors, the same in every theme, like real chips and felt. */
export const POKER = {
  fold: ["#DC2626", "#FFFFFF"] as [string, string],
  check: ["#16A34A", "#FFFFFF"] as [string, string],
  call: ["#2563EB", "#FFFFFF"] as [string, string],
  gold: ["#E8B923", "#2B1D00"] as [string, string],
};

export function AmountSlider({
  label,
  min,
  max,
  value,
  onChange,
  step = 1,
  shortcuts = [],
  maxLabel,
}: {
  label?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** The slider moves in steps of this many chips (the ends are always reachable). */
  step?: number;
  /** Buttons that set an amount, like "½ pot". Those out of range are dimmed. */
  shortcuts?: { label: string; value: number }[];
  /** The button at the end of the slider, for the most. */
  maxLabel: string;
}) {
  const styles = useStyles(makeStyles);
  const t = useTheme();
  const atMax = value >= max;

  function slide(raw: number) {
    if (raw >= max - step / 2) return onChange(max);
    const stepped = min + Math.round((raw - min) / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  }

  return (
    <View style={styles.block}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Text style={styles.amount}>{value.toLocaleString()}</Text>
      {shortcuts.length > 0 && (
        <View style={styles.shortcuts}>
          {shortcuts.map((s) => {
            const usable = s.value >= min && s.value < max;
            const on = usable && s.value === value;
            return (
              <Tappable
                key={s.label}
                disabled={!usable}
                onPress={() => onChange(s.value)}
                style={[styles.shortcut, on && styles.shortcutOn, !usable && styles.dim]}
                accessibilityRole="button"
              >
                <Text style={[styles.shortcutText, on && styles.shortcutTextOn]}>{s.label}</Text>
              </Tappable>
            );
          })}
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.slider}>
          {max > min && (
            <Slider
              minimumValue={min}
              maximumValue={max}
              value={value}
              onValueChange={slide}
              minimumTrackTintColor={POKER.gold[0]}
              maximumTrackTintColor={t.colors.border}
              thumbTintColor={POKER.gold[0]}
            />
          )}
        </View>
        <MaxButton label={maxLabel} on={atMax} onPress={() => onChange(max)} />
      </View>
    </View>
  );
}

/** The end button. Once picked, it fills with gold and a light sweeps across it, again and again. */
function MaxButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const [shine] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  // The button's width, so the light crosses all of it.
  const [width, setWidth] = useState(90);

  useEffect(() => {
    if (!on) {
      shine.stopAnimation();
      shine.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.12, duration: 120, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    sweep.start();
    return () => sweep.stop();
  }, [on, shine, pop]);

  const shift = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, width + 40],
  });
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.max, on && styles.maxOn]}
      >
        <Text style={[styles.maxText, on && styles.maxTextOn]}>{label}</Text>
        {on && (
          <Animated.View
            pointerEvents="none"
            style={[styles.glint, { transform: [{ translateX: shift }, { rotate: "20deg" }] }]}
          />
        )}
      </Tappable>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    block: { gap: 8 },
    label: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.text },
    amount: {
      fontSize: 28,
      fontFamily: t.fonts.bold,
      color: t.colors.text,
      textAlign: "center",
    },
    shortcuts: { flexDirection: "row", gap: 6 },
    shortcut: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: t.radius.button,
      borderWidth: 1,
      borderColor: POKER.gold[0],
    },
    shortcutOn: { backgroundColor: POKER.gold[0] },
    shortcutText: { fontSize: 13, fontFamily: t.fonts.bold, color: t.colors.text },
    shortcutTextOn: { color: POKER.gold[1] },
    dim: { opacity: 0.35 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    slider: { flex: 1 },
    max: {
      minWidth: 84,
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: t.radius.button,
      borderWidth: 2,
      borderColor: POKER.gold[0],
      overflow: "hidden",
    },
    maxOn: {
      backgroundColor: POKER.gold[0],
      boxShadow: `0 0 14px ${POKER.gold[0]}`,
    },
    maxText: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.text },
    maxTextOn: { color: POKER.gold[1] },
    glint: {
      position: "absolute",
      top: -20,
      bottom: -20,
      left: 0,
      width: 18,
      backgroundColor: "rgba(255,255,255,0.65)",
    },
  });
