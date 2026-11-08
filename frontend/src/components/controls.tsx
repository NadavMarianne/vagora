// Form controls for settings: foldable sections, switches, and choice chips.
import { useEffect, useRef, useState } from "react";
import { type HostInstance, StyleSheet, Switch, Text, View } from "react-native";

import { Inside, newFoldId, useFoldPlace, useFoldRegistry } from "@/components/folds";
import { Tappable } from "@/components/tappable";
import { useRevealView } from "@/components/ui";
import { useStyles, useTheme } from "@/lib/theme";
import type { Theme } from "@/lib/themes";

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
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(startOpen);
  const [id] = useState(newFoldId);
  const place = useFoldPlace();
  const registry = useFoldRegistry();
  const box = useRef<HostInstance>(null);
  const reveal = useRevealView();

  // Tell the page while this section is open, so back can close it.
  useEffect(() => {
    if (!open || !registry) return;
    registry.opened({
      id,
      parentId: place.parentId,
      depth: place.depth,
      openedAt: Date.now(),
      close: () => setOpen(false),
    });
    return () => registry.closed(id);
  }, [open, registry, id, place.parentId, place.depth]);

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
          <Inside place={place} parentId={id}>
            {children}
          </Inside>
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
  const styles = useStyles(makeStyles);
  const t = useTheme();
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.colors.primary, false: t.colors.border }}
        thumbColor={value ? t.colors.onPrimary : t.colors.muted}
      />
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
  const styles = useStyles(makeStyles);
  function press(value: T) {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    foldable: {
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      boxShadow: t.shadow.card || undefined,
    },
    foldableHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
    foldableArrow: { fontSize: 16, color: t.colors.primary, width: 16 },
    foldableTitle: {
      fontSize: 16,
      fontFamily: t.fonts.bold,
      color: t.colors.text,
      flexShrink: 1,
      textTransform: t.upperTitles ? "uppercase" : "none",
    },
    foldableBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 14 },
    toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { fontSize: 14, fontFamily: t.fonts.bold, color: t.colors.text, flexShrink: 1 },
    chipsBlock: { gap: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderWidth: t.borderWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.chip === 0 ? 0 : 16,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    chipText: { color: t.colors.text, fontFamily: t.fonts.regular },
    chipTextOn: { color: t.colors.onPrimary, fontFamily: t.fonts.bold },
  });
