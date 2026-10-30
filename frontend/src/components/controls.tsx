// Form controls for settings: foldable sections, switches, and choice chips.
import { useEffect, useRef, useState } from "react";
import { type HostInstance, StyleSheet, Switch, Text, View } from "react-native";

import { Deeper, newFoldId, useFoldDepth, useFoldRegistry } from "@/components/folds";
import { Tappable } from "@/components/tappable";
import { colors, useRevealView } from "@/components/ui";

/** A section that opens and closes when its title is tapped. Opening it scrolls it into view.
 * On Android, the back button closes open sections (deepest first) before leaving the page. */
export function Foldable({
  title,
  children,
  startOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [id] = useState(newFoldId);
  const depth = useFoldDepth();
  const registry = useFoldRegistry();
  const box = useRef<HostInstance>(null);
  const reveal = useRevealView();

  // Tell the page while this section is open, so back can close it.
  useEffect(() => {
    if (!open || !registry) return;
    registry.opened({ id, depth, openedAt: Date.now(), close: () => setOpen(false) });
    return () => registry.closed(id);
  }, [open, registry, id, depth]);

  function toggle() {
    if (!open) reveal(box.current);
    setOpen(!open);
  }

  return (
    <View ref={box} style={styles.foldable}>
      <Tappable
        onPress={toggle}
        style={styles.foldableHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.foldableArrow}>{open ? "▾" : "▸"}</Text>
        <Text style={styles.foldableTitle}>{title}</Text>
      </Tappable>
      {open && (
        <View style={styles.foldableBody}>
          <Deeper depth={depth}>{children}</Deeper>
        </View>
      )}
    </View>
  );
}

/** An on/off setting. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

/** A row of chips. With `multiple`, several can be picked. */
export function Chips<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
}: {
  label?: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  multiple?: boolean;
}) {
  function press(value: T) {
    if (!multiple) return onChange([value]);
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <View style={styles.chipsBlock}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chips}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <Tappable
              key={option.value}
              onPress={() => press(option.value)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foldable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  foldableHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  foldableArrow: { fontSize: 16, color: colors.primary, width: 16 },
  foldableTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  foldableBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 14 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  chipsBlock: { gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextOn: { color: colors.background, fontWeight: "600" },
});
