// Picks a length of time: a unit (seconds, minutes, hours, days), then a number, with a slider
// and a number box that stay in sync.
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Chips } from "@/components/controls";
import { colors, useRevealFocused } from "@/components/ui";

type Unit = "seconds" | "minutes" | "hours" | "days";

const UNIT_SECONDS: Record<Unit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};
// The slider's range in each unit. Longer times use the next unit up.
const UNIT_RANGE: Record<Unit, [number, number]> = {
  seconds: [1, 59],
  minutes: [1, 59],
  hours: [1, 23],
  days: [1, 365],
};
const UNITS: Unit[] = ["seconds", "minutes", "hours", "days"];

/** The biggest unit that shows `seconds` as a whole number. */
function unitFor(seconds: number): Unit {
  return [...UNITS].reverse().find((u) => seconds % UNIT_SECONDS[u] === 0) ?? "seconds";
}

/** "3 days", "1 hour", "45 seconds". */
export function formatDuration(seconds: number): string {
  const unit = unitFor(seconds);
  const count = seconds / UNIT_SECONDS[unit];
  return `${count} ${count === 1 ? unit.slice(0, -1) : unit}`;
}

export function DurationPicker({
  label,
  seconds,
  onChange,
  min,
  max,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
  /** Shortest and longest allowed, in seconds. */
  min: number;
  max: number;
}) {
  const reveal = useRevealFocused();
  const [unit, setUnit] = useState<Unit>(() => unitFor(seconds));
  // What's in the box while typing. Otherwise the box shows the value.
  const [typing, setTyping] = useState<string | null>(null);

  // The units that fit between min and max, and the slider's range in the chosen one.
  const units = UNITS.filter((u) => UNIT_SECONDS[u] <= max && UNIT_SECONDS[u] * 59 >= min);
  const size = UNIT_SECONDS[unit];
  const low = Math.max(UNIT_RANGE[unit][0], Math.ceil(min / size));
  const high = Math.min(UNIT_RANGE[unit][1], Math.floor(max / size));
  const count = Math.round(seconds / size);

  function setCount(next: number, inUnit: Unit = unit) {
    const clamped = Math.min(Math.max(next, low), high);
    onChange(clamped * UNIT_SECONDS[inUnit]);
  }

  function pickUnit(next: Unit) {
    setUnit(next);
    const s = UNIT_SECONDS[next];
    const nextLow = Math.max(UNIT_RANGE[next][0], Math.ceil(min / s));
    const nextHigh = Math.min(UNIT_RANGE[next][1], Math.floor(max / s));
    const nextCount = Math.min(Math.max(count, nextLow), nextHigh);
    setTyping(null);
    onChange(nextCount * s);
  }

  function type(value: string) {
    const digits = value.replace(/\D/g, "");
    setTyping(digits);
    if (digits) setCount(Number(digits));
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.box}
          value={typing ?? String(count)}
          onChangeText={type}
          onFocus={reveal}
          onBlur={() => setTyping(null)}
          keyboardType="number-pad"
        />
        <Text style={styles.unit}>{count === 1 ? unit.slice(0, -1) : unit}</Text>
      </View>
      {high > low && (
        <Slider
          minimumValue={low}
          maximumValue={high}
          step={1}
          value={Math.min(Math.max(count, low), high)}
          onValueChange={(value) => setCount(value)}
          minimumTrackTintColor={colors.primary}
          thumbTintColor={colors.primary}
        />
      )}
      <Chips
        options={units.map((u) => ({
          value: u,
          label: u[0].toUpperCase() + u.slice(1),
        }))}
        selected={[unit]}
        onChange={([chosen]) => pickUnit(chosen)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minWidth: 70,
    color: colors.text,
  },
  unit: { fontSize: 16, color: colors.text },
});
